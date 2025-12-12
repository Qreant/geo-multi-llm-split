/**
 * LLM Service - Handles API calls to Gemini and OpenAI
 * Ported from Google Apps Script V2.17
 */

import axios from 'axios';
import https from 'https';

// HTTPS agent that ignores certificate errors (for redirect resolution)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const CONFIG = {
  TEMPERATURE: parseFloat(process.env.TEMPERATURE) || 0.1,
  MAX_OUTPUT_TOKENS: parseInt(process.env.MAX_OUTPUT_TOKENS) || 56000,
  OPENAI_MAX_TOKENS: 16000,
  RETRY_DELAY_MS: 500, // Increased from 50ms for more reliable retries
  RATE_LIMIT_RETRY_DELAY_MS: 5000, // 5 seconds for rate limit errors (increased from 2s)
  MAX_RETRIES: 5, // Increased from 3 for better reliability
  API_TIMEOUT_MS: 300000 // 5 minutes - increased from 2 minutes for large aggregations
};

// Note: Rate limiting removed after testing showed 100 parallel requests work without errors
// Both Gemini and OpenAI handle high parallelism well on paid tiers

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Extract domain from page title (many titles have format "Page Title | SiteName" or "Page Title - Company.com")
 * Returns a domain-like URL if extraction succeeds, null otherwise
 */
function extractDomainFromTitle(title) {
  if (!title || typeof title !== 'string') return null;

  // Common separators between page title and site name
  const separators = [' | ', ' - ', ' — ', ' – ', ' : '];

  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      const lastPart = parts[parts.length - 1].trim();

      // Check if last part looks like a domain or company name
      if (lastPart.includes('.') && lastPart.length < 50) {
        // Looks like a domain (e.g., "tesla.com")
        const domain = lastPart.toLowerCase().replace(/\s+/g, '');
        return `https://${domain}`;
      } else if (lastPart.length > 0 && lastPart.length < 30) {
        // Company name - convert to likely domain
        const domainGuess = lastPart.toLowerCase()
          .replace(/[^a-z0-9]/g, '')  // Remove non-alphanumeric
          .replace(/\s+/g, '');
        if (domainGuess.length >= 3) {
          return `https://${domainGuess}.com`;
        }
      }
    }
  }

  // Try to find domain-like patterns in the title itself
  const domainPattern = /([a-z0-9][-a-z0-9]*\.(?:com|org|net|io|co|gov|edu|fr|de|uk|ca|au|jp)[a-z]*)/i;
  const match = title.match(domainPattern);
  if (match) {
    return `https://${match[1].toLowerCase()}`;
  }

  return null;
}

/**
 * Batch resolve Vertex AI redirect URLs
 * Follows redirects and captures the final URL
 */
async function batchResolveRedirects(urlsToResolve) {
  const redirectMap = {};

  if (!urlsToResolve || urlsToResolve.length === 0) {
    return redirectMap;
  }

  // Filter to only Vertex AI redirect URLs
  const vertexUrls = urlsToResolve.filter(item =>
    item.url && item.url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')
  );

  if (vertexUrls.length === 0) {
    return redirectMap;
  }

  console.log(`   📡 Resolving ${vertexUrls.length} Vertex AI redirect URLs...`);

  // Follow redirects and capture final URL
  const requests = vertexUrls.map(({ url, sourceDomain }) =>
    axios.get(url, {
      maxRedirects: 10,  // Follow up to 10 redirects
      validateStatus: () => true, // Accept all responses
      timeout: 8000,
      httpsAgent: httpsAgent,
      // Don't download content, just get headers
      responseType: 'stream'
    }).then(response => {
      // Immediately destroy the stream to avoid downloading content
      if (response.data && response.data.destroy) {
        response.data.destroy();
      }
      return {
        finalUrl: response.request?.res?.responseUrl || response.config?.url || url,
        sourceDomain
      };
    }).catch(error => {
      // Even on error, we might have followed some redirects
      if (error.request?.res?.responseUrl) {
        return {
          finalUrl: error.request.res.responseUrl,
          sourceDomain
        };
      }
      // Try to get Location header from error response
      if (error.response?.headers?.location) {
        return {
          finalUrl: error.response.headers.location,
          sourceDomain
        };
      }
      return { finalUrl: null, sourceDomain };
    })
  );

  const responses = await Promise.all(requests);

  responses.forEach((response, index) => {
    const originalUrl = vertexUrls[index].url;
    const sourceTitle = vertexUrls[index].sourceDomain; // This is actually the page title
    const finalUrl = response?.finalUrl;

    // Helper to get fallback URL from title
    const getFallbackUrl = () => {
      // First try to extract domain from title (e.g., "Powerwall | Tesla" -> https://tesla.com)
      const extractedDomain = extractDomainFromTitle(sourceTitle);
      if (extractedDomain) {
        return extractedDomain;
      }
      // If title looks like a valid URL, use it
      if (sourceTitle && sourceTitle.trim()) {
        if (sourceTitle.startsWith('http')) {
          return sourceTitle;
        }
        // If it looks like a domain, make it a URL
        if (sourceTitle.includes('.') && !sourceTitle.includes(' ')) {
          return `https://${sourceTitle.replace(/^www\./, '')}`;
        }
      }
      // Last resort: return null to indicate we couldn't extract anything
      return null;
    };

    // Check if we got a useful resolved URL
    if (finalUrl && !finalUrl.includes('vertexaisearch.cloud.google.com')) {
      // Check if it's a Google Search page (not useful)
      if (finalUrl.includes('google.com/search') || finalUrl.includes('google.com/url')) {
        // Fallback to domain extracted from title
        const fallbackUrl = getFallbackUrl();
        if (fallbackUrl) {
          redirectMap[originalUrl] = fallbackUrl;
          console.log(`   ⚠️  ${originalUrl.substring(0, 50)}... -> Google search (using: ${extractDomain(fallbackUrl)})`);
        } else {
          // No fallback available - mark as unresolved but don't keep Vertex URL
          redirectMap[originalUrl] = `unresolved://${sourceTitle || 'unknown'}`;
          console.log(`   ⚠️  ${originalUrl.substring(0, 50)}... -> Google search (no fallback)`);
        }
      } else {
        // Use the final resolved URL
        redirectMap[originalUrl] = finalUrl;
      }
    } else {
      // Resolution failed, fallback to domain extracted from title
      const fallbackUrl = getFallbackUrl();
      if (fallbackUrl) {
        redirectMap[originalUrl] = fallbackUrl;
        console.log(`   ⚠️  ${originalUrl.substring(0, 50)}... -> Failed (using: ${extractDomain(fallbackUrl)})`);
      } else {
        // No fallback available - mark as unresolved but don't keep Vertex URL
        redirectMap[originalUrl] = `unresolved://${sourceTitle || 'unknown'}`;
        console.log(`   ⚠️  ${originalUrl.substring(0, 50)}... -> Failed (no fallback)`);
      }
    }
  });

  const resolvedCount = Object.values(redirectMap).filter(url =>
    !url.includes('vertexaisearch.cloud.google.com')
  ).length;
  console.log(`   ✅ Resolved ${resolvedCount}/${vertexUrls.length} redirect URLs`);

  return redirectMap;
}

/**
 * Resolve a single Vertex AI redirect URL - exported for re-resolution utility
 */
export async function resolveVertexRedirect(url, sourceTitle = '') {
  if (!url || !url.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')) {
    return url;
  }

  // Helper to get fallback URL from title
  const getFallbackUrl = () => {
    const extractedDomain = extractDomainFromTitle(sourceTitle);
    if (extractedDomain) return extractedDomain;
    if (sourceTitle && sourceTitle.trim()) {
      if (sourceTitle.startsWith('http')) return sourceTitle;
      if (sourceTitle.includes('.') && !sourceTitle.includes(' ')) {
        return `https://${sourceTitle.replace(/^www\./, '')}`;
      }
    }
    return null;
  };

  try {
    const response = await axios.get(url, {
      maxRedirects: 10,
      validateStatus: () => true,
      timeout: 8000,
      httpsAgent: httpsAgent,
      responseType: 'stream'
    });

    // Destroy stream immediately
    if (response.data?.destroy) {
      response.data.destroy();
    }

    const finalUrl = response.request?.res?.responseUrl || url;

    // Check if resolution was successful
    if (finalUrl && !finalUrl.includes('vertexaisearch.cloud.google.com')) {
      if (finalUrl.includes('google.com/search') || finalUrl.includes('google.com/url')) {
        // Fallback to domain extracted from title
        const fallbackUrl = getFallbackUrl();
        return fallbackUrl || `unresolved://${sourceTitle || 'unknown'}`;
      }
      return finalUrl;
    }

    // Fallback to domain extracted from title
    const fallbackUrl = getFallbackUrl();
    return fallbackUrl || `unresolved://${sourceTitle || 'unknown'}`;
  } catch (error) {
    // Fallback to domain extracted from title
    const fallbackUrl = getFallbackUrl();
    return fallbackUrl || `unresolved://${sourceTitle || 'unknown'}`;
  }
}

/**
 * Call Gemini API for JSON generation (no web search)
 */
export async function callGeminiForJSON(prompt, apiKey, model = 'gemini-2.5-flash') {
  const url = `${GEMINI_ENDPOINT}${model}:generateContent`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: CONFIG.TEMPERATURE,
      maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json"
    }
  };

  // Retry logic with exponential backoff for rate limits
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: CONFIG.API_TIMEOUT_MS
      });

      if (response.data.candidates && response.data.candidates[0]) {
        if (attempt > 0) {
          console.log(`   ✅ Retry ${attempt} successful`);
        }
        return extractGeminiResponse(response.data);
      }

      throw new Error('Unexpected Gemini API response structure');
    } catch (error) {
      const isRateLimit = error.response && error.response.status === 429;
      const isLastAttempt = attempt === CONFIG.MAX_RETRIES - 1;

      if (attempt === 0) {
        console.error('❌ Gemini JSON API Error:', error.message);
        if (error.response) {
          console.error('   Response status:', error.response.status);
          if (isRateLimit) {
            console.error('   Rate limit exceeded - will retry with backoff');
          }
        }
      }

      if (!isLastAttempt) {
        const delay = isRateLimit
          ? CONFIG.RATE_LIMIT_RETRY_DELAY_MS * Math.pow(2, attempt)
          : CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);

        console.log(`   🔄 Retrying in ${delay}ms (attempt ${attempt + 1}/${CONFIG.MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error(`   ❌ All ${CONFIG.MAX_RETRIES} attempts failed`);
      throw new Error(`Gemini JSON API Error: ${error.message}`);
    }
  }
}

// Track Gemini call sequence for debugging
let geminiCallSequence = 0;

/**
 * Call Gemini API with grounding
 */
export async function callGeminiAPI(prompt, apiKey) {
  const callId = ++geminiCallSequence;
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `${GEMINI_ENDPOINT}${model}:generateContent`;

  // Extract question ID from prompt for logging
  const questionMatch = prompt.match(/Question:\s*(.{0,60})/);
  const questionPreview = questionMatch ? questionMatch[1].trim() : 'unknown';

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    tools: [{
      google_search: {}
    }],
    generationConfig: {
      temperature: CONFIG.TEMPERATURE,
      maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS
    }
  };

  // Retry logic with exponential backoff for rate limits
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      const startTime = Date.now();
      const response = await axios.post(url, payload, {
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: CONFIG.API_TIMEOUT_MS
      });
      const duration = Date.now() - startTime;

      if (response.data.candidates && response.data.candidates[0]) {
        const candidate = response.data.candidates[0];
        const finishReason = candidate.finishReason || 'unknown';
        const textLength = candidate.content?.parts?.[0]?.text?.length || 0;

        console.log(`   [Gemini #${callId}] ✅ "${questionPreview}..." | ${duration}ms | ${textLength} chars | finish: ${finishReason}`);

        if (attempt > 0) {
          console.log(`   [Gemini #${callId}] Retry ${attempt} successful`);
        }
        return extractGeminiResponse(response.data);
      }

      // No candidates - log the full response structure
      console.error(`   [Gemini #${callId}] ⚠️ No candidates in response:`, JSON.stringify(response.data, null, 2).substring(0, 500));
      throw new Error('Unexpected Gemini API response structure - no candidates');
    } catch (error) {
      const isRateLimit = error.response && error.response.status === 429;
      const isServerError = error.response && error.response.status >= 500;
      const isLastAttempt = attempt === CONFIG.MAX_RETRIES - 1;

      // Detailed error logging
      console.error(`   [Gemini #${callId}] ❌ "${questionPreview}..." | Error: ${error.message}`);
      if (error.response) {
        console.error(`   [Gemini #${callId}]    Status: ${error.response.status}`);
        if (error.response.data) {
          const errorData = typeof error.response.data === 'string'
            ? error.response.data.substring(0, 300)
            : JSON.stringify(error.response.data, null, 2).substring(0, 300);
          console.error(`   [Gemini #${callId}]    Response: ${errorData}`);
        }
        if (isRateLimit) {
          console.error(`   [Gemini #${callId}]    🚫 RATE LIMIT (429)`);
        }
        if (isServerError) {
          console.error(`   [Gemini #${callId}]    🔥 SERVER ERROR (${error.response.status})`);
        }
      } else if (error.code === 'ECONNABORTED') {
        console.error(`   [Gemini #${callId}]    ⏱️ TIMEOUT`);
      }

      if (!isLastAttempt) {
        // Calculate delay: use longer delay for rate limits, exponential backoff
        const delay = isRateLimit
          ? CONFIG.RATE_LIMIT_RETRY_DELAY_MS * Math.pow(2, attempt)
          : CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);

        console.log(`   [Gemini #${callId}] 🔄 Retrying in ${delay}ms (attempt ${attempt + 1}/${CONFIG.MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Last attempt failed
      console.error(`   [Gemini #${callId}] ❌ All ${CONFIG.MAX_RETRIES} attempts failed`);
      throw new Error(`Gemini API Error: ${error.message}`);
    }
  }
}

/**
 * Extract response text and grounded sources from Gemini response
 */
async function extractGeminiResponse(result) {
  const candidate = result.candidates[0];

  // Extract text from ALL parts (Gemini may split response into multiple parts)
  let text = '';
  if (candidate.content.parts && candidate.content.parts.length > 0) {
    text = candidate.content.parts
      .filter(part => part.text)
      .map(part => part.text)
      .join('');
  }

  // Extract grounded sources
  const groundedSources = [];
  if (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) {
    const urlsToResolve = [];
    const chunks = [];

    candidate.groundingMetadata.groundingChunks.forEach(chunk => {
      if (chunk.web && chunk.web.uri) {
        chunks.push(chunk);
        if (chunk.web.uri.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')) {
          urlsToResolve.push({
            url: chunk.web.uri,
            sourceDomain: chunk.web.title
          });
        }
      }
    });

    // Batch resolve redirects
    const redirectMap = await batchResolveRedirects(urlsToResolve);

    // Process chunks with resolved URLs
    chunks.forEach(chunk => {
      const originalUrl = chunk.web.uri;
      const isVertexRedirect = originalUrl.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/');
      const pageTitle = chunk.web.title || '';

      let resolvedUrl = redirectMap[originalUrl] || originalUrl;
      let domain;
      let sourceType = isVertexRedirect ? 'grounded_resolved' : 'grounded_direct';

      // Handle unresolved:// protocol - extract info from title
      if (resolvedUrl.startsWith('unresolved://')) {
        // Try to get domain from title
        const extractedUrl = extractDomainFromTitle(pageTitle);
        if (extractedUrl) {
          resolvedUrl = extractedUrl;
          domain = extractDomain(extractedUrl);
        } else {
          // Use title as-is for domain display, URL remains unresolved
          domain = pageTitle || 'unknown source';
          resolvedUrl = null; // Mark as no valid URL
        }
        sourceType = 'grounded_unresolved';
      }
      // Handle any Vertex URLs that might have slipped through
      else if (resolvedUrl.includes('vertexaisearch.cloud.google.com')) {
        const extractedUrl = extractDomainFromTitle(pageTitle);
        if (extractedUrl) {
          resolvedUrl = extractedUrl;
          domain = extractDomain(extractedUrl);
        } else {
          domain = pageTitle || 'unknown source';
          resolvedUrl = null;
        }
        sourceType = 'grounded_unresolved';
      } else {
        domain = extractDomain(resolvedUrl);
      }

      groundedSources.push({
        url: resolvedUrl,
        domain: domain,
        title: pageTitle || domain,
        relevance_score: 0.95,
        source_type: sourceType
      });
    });
  }

  return {
    text: text,
    groundedSources: groundedSources
  };
}

/**
 * Get ISO country code from country name
 */
function getCountryISO(countryName) {
  const countryMap = {
    'united states': 'US',
    'usa': 'US',
    'united kingdom': 'GB',
    'uk': 'GB',
    'france': 'FR',
    'germany': 'DE',
    'spain': 'ES',
    'italy': 'IT',
    'canada': 'CA',
    'australia': 'AU',
    'japan': 'JP',
    'china': 'CN',
    'india': 'IN',
    'brazil': 'BR',
    'mexico': 'MX',
    'netherlands': 'NL',
    'sweden': 'SE',
    'norway': 'NO',
    'denmark': 'DK',
    'finland': 'FI',
    'poland': 'PL',
    'belgium': 'BE',
    'switzerland': 'CH',
    'austria': 'AT',
    'portugal': 'PT',
    'greece': 'GR',
    'turkey': 'TR',
    'south korea': 'KR',
    'singapore': 'SG',
    'hong kong': 'HK',
    'new zealand': 'NZ',
    'ireland': 'IE',
    'south africa': 'ZA'
  };

  return countryMap[countryName.toLowerCase()] || null;
}

/**
 * Call OpenAI API with web search
 * Supports both GPT-5 responses API and GPT-4 chat completions API
 */
export async function callOpenAIAPI(prompt, apiKey, config = {}) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-2024-11-20';
  const isGPT5 = model.startsWith('gpt-5');

  // GPT-5 uses the new responses API
  if (isGPT5) {
    return await callGPT5ResponsesAPI(prompt, apiKey, model, config);
  }

  // GPT-4 and older use chat completions API
  return await callGPT4ChatAPI(prompt, apiKey, model, config);
}

/**
 * Call GPT-5 using the new responses API with web_search tool
 */
async function callGPT5ResponsesAPI(prompt, apiKey, model, config) {
  const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';

  const payload = {
    model: model,
    tools: [
      { type: "web_search" }
    ],
    input: prompt
  };

  try {
    const response = await axios.post(RESPONSES_ENDPOINT, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: CONFIG.API_TIMEOUT_MS
    });

    // Extract text from GPT-5 response format
    // Response has output array with message object containing content array
    if (response.data.output && Array.isArray(response.data.output)) {
      const messageOutput = response.data.output.find(o => o.type === 'message');
      if (messageOutput && messageOutput.content && messageOutput.content[0]) {
        const text = messageOutput.content[0].text;

        // Extract sources from tools/web_search if available
        const sources = [];
        // TODO: Extract sources from web_search results if provided in response

        console.log('   ✅ GPT-5 response extracted successfully');
        return {
          text: text,
          groundedSources: sources
        };
      }
    }

    console.error('   ⚠️  Unexpected GPT-5 response structure:', JSON.stringify(response.data, null, 2));
    throw new Error('Unexpected GPT-5 API response structure');
  } catch (error) {
    console.error('❌ OpenAI GPT-5 API Error:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }

    throw new Error(`OpenAI GPT-5 API Error: ${error.message}`);
  }
}

/**
 * Call GPT-4 using chat completions API (without web search)
 */
async function callGPT4ChatAPI(prompt, apiKey, model, config) {
  const payload = {
    model: model,
    messages: [
      {
        role: "system",
        content: "You are a JSON-only assistant. You MUST return ONLY valid JSON with no additional text, explanations, or markdown formatting. Do not wrap JSON in code blocks or add any conversational text before or after the JSON object."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: CONFIG.OPENAI_MAX_TOKENS
  };

  try {
    const response = await axios.post(OPENAI_ENDPOINT, payload, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: CONFIG.API_TIMEOUT_MS
    });

    if (response.data.choices && response.data.choices[0]) {
      return extractOpenAIResponse(response.data);
    }

    throw new Error('Unexpected OpenAI API response structure');
  } catch (error) {
    console.error('❌ OpenAI GPT-4 API Error:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.response && error.response.status >= 400) {
      // Retry once
      console.log('   🔄 Retrying OpenAI API call...');
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));

      try {
        const retryResponse = await axios.post(OPENAI_ENDPOINT, payload, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: CONFIG.API_TIMEOUT_MS
        });

        if (retryResponse.data.choices && retryResponse.data.choices[0]) {
          console.log('   ✅ Retry successful');
          return extractOpenAIResponse(retryResponse.data);
        }
      } catch (retryError) {
        console.error('   ❌ Retry failed:', retryError.message);
        throw new Error(`OpenAI API Error: ${retryError.message}`);
      }
    }

    throw new Error(`OpenAI API Error: ${error.message}`);
  }
}

/**
 * Extract response text and citations from OpenAI response
 */
function extractOpenAIResponse(result) {
  const choice = result.choices[0];
  const text = choice.message.content;

  // Extract citations from annotations or tool_calls
  const citations = [];

  // Check for annotations (citations)
  if (choice.message.annotations) {
    choice.message.annotations.forEach(annotation => {
      if (annotation.type === 'url_citation' && annotation.url_citation) {
        citations.push({
          url: annotation.url_citation.url,
          title: annotation.url_citation.title || extractDomain(annotation.url_citation.url),
          domain: extractDomain(annotation.url_citation.url),
          relevance_score: 0.9,
          source_type: 'openai_citation'
        });
      }
    });
  }

  // Check for tool_calls with web_search
  if (choice.message.tool_calls) {
    choice.message.tool_calls.forEach(toolCall => {
      if (toolCall.type === 'web_search' && toolCall.web_search) {
        const results = toolCall.web_search.results || [];
        results.forEach(result => {
          if (result.url) {
            citations.push({
              url: result.url,
              title: result.title || result.snippet || extractDomain(result.url),
              domain: extractDomain(result.url),
              relevance_score: 0.9,
              source_type: 'openai_web_search'
            });
          }
        });
      }
    });
  }

  return {
    text: text,
    groundedSources: citations
  };
}

/**
 * Simple Gemini call without grounding (for category detection, translation, etc.)
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - Gemini API key
 * @param {Object} options - Optional config {temperature, maxOutputTokens}
 * @returns {string} - The response text
 */
export async function callGemini(prompt, apiKey, options = {}) {
  const model = options.model || 'gemini-2.5-flash';
  const url = `${GEMINI_ENDPOINT}${model}:generateContent`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: options.temperature ?? CONFIG.TEMPERATURE,
      maxOutputTokens: options.maxOutputTokens ?? 4000
    }
  };

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: CONFIG.API_TIMEOUT_MS
      });

      if (response.data.candidates && response.data.candidates[0]) {
        const candidate = response.data.candidates[0];
        if (candidate.content?.parts?.length > 0) {
          return candidate.content.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('');
        }
      }

      throw new Error('Unexpected Gemini API response structure');
    } catch (error) {
      const isRateLimit = error.response?.status === 429;
      const isLastAttempt = attempt === CONFIG.MAX_RETRIES - 1;

      if (!isLastAttempt) {
        const delay = isRateLimit
          ? CONFIG.RATE_LIMIT_RETRY_DELAY_MS * Math.pow(2, attempt)
          : CONFIG.RETRY_DELAY_MS * Math.pow(2, attempt);

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Gemini API Error: ${error.message}`);
    }
  }
}

/**
 * Call Gemini API only (for retries)
 */
export async function callGeminiOnly(prompt, geminiApiKey) {
  return callGeminiAPI(prompt, geminiApiKey).catch(err => ({
    error: true,
    message: err.message,
    text: null,
    groundedSources: []
  }));
}

/**
 * Call both LLMs in parallel with extra retry for Gemini failures
 * If Gemini fails but OpenAI succeeds, we retry Gemini up to 3 more times
 * to maximize data completeness
 */
export async function callBothLLMs(prompt, geminiApiKey, openaiApiKey, config = {}) {
  const GEMINI_EXTRA_RETRIES = 3;
  const GEMINI_RETRY_DELAY = 3000; // 3 seconds between extra retries

  const [geminiResult, openaiResult] = await Promise.all([
    callGeminiAPI(prompt, geminiApiKey).catch(err => ({
      error: true,
      message: err.message,
      text: null,
      groundedSources: []
    })),
    callOpenAIAPI(prompt, openaiApiKey, config).catch(err => ({
      error: true,
      message: err.message,
      text: null,
      groundedSources: []
    }))
  ]);

  // If Gemini failed, retry it independently (don't block OpenAI result)
  let finalGeminiResult = geminiResult;
  if (geminiResult.error && geminiApiKey) {
    console.log(`   [callBothLLMs] ⚠️ Gemini failed, attempting ${GEMINI_EXTRA_RETRIES} extra retries...`);

    for (let i = 0; i < GEMINI_EXTRA_RETRIES; i++) {
      await new Promise(resolve => setTimeout(resolve, GEMINI_RETRY_DELAY));
      console.log(`   [callBothLLMs] 🔄 Gemini extra retry ${i + 1}/${GEMINI_EXTRA_RETRIES}...`);

      try {
        finalGeminiResult = await callGeminiAPI(prompt, geminiApiKey);
        if (!finalGeminiResult.error) {
          console.log(`   [callBothLLMs] ✅ Gemini succeeded on extra retry ${i + 1}`);
          break;
        }
      } catch (err) {
        finalGeminiResult = {
          error: true,
          message: err.message,
          text: null,
          groundedSources: []
        };
      }
    }

    if (finalGeminiResult.error) {
      console.log(`   [callBothLLMs] ❌ Gemini failed after all extra retries`);
    }
  }

  return {
    gemini: finalGeminiResult,
    openai: openaiResult
  };
}
