/**
 * Model Providers
 * Unified LLM API adapters for Gemini, OpenAI, and DeepSeek
 */

import axios from 'axios';
import { API_ENDPOINTS, BENCHMARK_CONFIG, getTimeout, FAILURE_REASONS } from '../config.js';
import { extractDomainInfo } from './dataLoader.js';

/**
 * Build source classification prompt (adapted from sourceClassifier.js)
 * @param {Array} sources - Array of source objects
 * @param {string} brandName - Entity being monitored
 * @param {Array} competitors - List of competitor names
 * @returns {string} Formatted prompt
 */
export function buildClassificationPrompt(sources, brandName = 'TestBrand', competitors = []) {
  const sourcesList = sources.map((s, idx) => {
    const domainInfo = extractDomainInfo(s.url);
    return {
      id: idx,
      url: s.url || '',
      title: s.title || '',
      domain: s.domain || domainInfo.domain,
      is_youtube: domainInfo.isYouTube,
      youtube_channel: domainInfo.channelName || null
    };
  });

  const competitorList = competitors.length > 0
    ? competitors.join(', ')
    : 'other major players in the category';

  return `You are classifying source types for brand reputation monitoring.

Brand being monitored: "${brandName}"
Competitors: ${competitorList}

Sources to classify:
${JSON.stringify(sourcesList, null, 2)}

<INSTRUCTIONS>
You MUST classify each source into EXACTLY ONE of these 10 categories.
Use the EXACT string value shown - no variations allowed.

APPROVED SOURCE TYPES (use these EXACT strings):
1. "Corporate Blogs & Content" - Company blogs, corporate content marketing, business blogs (NOT ${brandName} or competitors)
2. "Journalism" - Professional news organizations, newspapers, news websites, news magazines
3. "Government/NGO" - Official government websites, non-profit organizations, regulatory bodies
4. "Aggregators / Encyclopedic" - Wikipedia, aggregate sites, encyclopedias, knowledge bases
5. "Academic/Research" - Academic journals, research papers, university publications
6. "Owned Media" - ${brandName}'s own websites, blogs, social media accounts, corporate properties
7. "Competitor Media" - Competitors' official websites and properties: ${competitorList}
8. "Paid/Advertorial" - Sponsored content, native advertising, paid placements
9. "Social / UGC" - User-generated content, social media posts, forums, review sites
10. "Press Release" - Official press releases, PR distribution sites

CRITICAL CLASSIFICATION RULES:
- If a source is from ${brandName}'s domain → "Owned Media"
- If a source is from ${competitorList}'s domains → "Competitor Media"
- "Owned Media" and "Competitor Media" take priority over "Corporate Blogs & Content"
- News aggregators that compile from other sources → "Aggregators / Encyclopedic"
- Original reporting by professional journalists → "Journalism"
- Review platforms (Trustpilot, G2, etc.) → "Social / UGC"

IMPORTANT - YouTube Channel Classification:
- YouTube channels should be classified based on WHO RUNS THE CHANNEL
- YouTube channels of news organizations (BBC, CNN, Reuters, etc.) → "Journalism"
- YouTube channels of ${brandName} → "Owned Media"
- YouTube channels of competitors (${competitorList}) → "Competitor Media"
- YouTube channels of other companies/brands → "Corporate Blogs & Content"
- YouTube channels of universities/researchers → "Academic/Research"
- YouTube channels of government agencies/NGOs → "Government/NGO"
- YouTube channels of individual creators/influencers → "Social / UGC"

If the source is "Competitor Media", also specify "competitor_name" with the competitor's name.

Confidence levels:
- "high" = Domain clearly matches category (e.g., nytimes.com → Journalism)
- "medium" = Domain pattern matches but not well-known
- "low" = Had to infer from title only or ambiguous domain

Output format (JSON only, no markdown):
{
  "classifications": [
    {
      "id": 0,
      "source_type": "Journalism",
      "competitor_name": null,
      "confidence": "high",
      "reasoning": "Major news outlet - independent journalism"
    }
  ]
}

Return ONLY the JSON object above. No markdown, no explanations, no additional text.
</INSTRUCTIONS>`;
}

/**
 * Call Gemini API for classification
 * @param {string} prompt - Classification prompt
 * @param {string} apiKey - Gemini API key
 * @param {string} model - Model name (e.g., 'gemini-2.5-flash')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result with data, tokens, and timing
 */
export async function callGemini(prompt, apiKey, model, options = {}) {
  const { timeout = 60000, retryCount = 0 } = options;
  const url = `${API_ENDPOINTS.gemini(model)}?key=${apiKey}`;

  const startTime = Date.now();

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: BENCHMARK_CONFIG.temperature,
      maxOutputTokens: BENCHMARK_CONFIG.tokenLimits[model.includes('lite') ? 'gemini-flash-lite' : 'gemini-flash'] || 8000,
      responseMimeType: 'application/json'
    }
  };

  try {
    const response = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout
    });

    const latencyMs = Date.now() - startTime;
    const candidate = response.data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response text from Gemini API');
    }

    // Extract token usage
    const usageMetadata = response.data?.usageMetadata || {};
    const inputTokens = usageMetadata.promptTokenCount || 0;
    const outputTokens = usageMetadata.candidatesTokenCount || 0;

    // Parse JSON response
    const parsed = JSON.parse(text);

    return {
      success: true,
      data: parsed,
      inputTokens,
      outputTokens,
      latencyMs,
      rawResponse: text
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return handleError(error, latencyMs, 'gemini', retryCount, options.maxRetries || 2);
  }
}

/**
 * Call OpenAI API for classification
 * @param {string} prompt - Classification prompt
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - Model name (e.g., 'gpt-4o')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result with data, tokens, and timing
 */
export async function callOpenAI(prompt, apiKey, model, options = {}) {
  const { timeout = 60000 } = options;
  const startTime = Date.now();

  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a JSON-only assistant. Return ONLY valid JSON with no markdown, explanations, or additional text. Your response must start with { and end with }.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: BENCHMARK_CONFIG.tokenLimits['gpt-4o'] || 16384,
    temperature: BENCHMARK_CONFIG.temperature,
    response_format: { type: 'json_object' }
  };

  try {
    const response = await axios.post(API_ENDPOINTS.openai, requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout
    });

    const latencyMs = Date.now() - startTime;
    const text = response.data?.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('No response text from OpenAI API');
    }

    // Extract token usage
    const usage = response.data?.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;

    // Parse JSON response
    const parsed = JSON.parse(text);

    return {
      success: true,
      data: parsed,
      inputTokens,
      outputTokens,
      latencyMs,
      rawResponse: text
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return handleError(error, latencyMs, 'openai', 0, options.maxRetries || 2);
  }
}

/**
 * Call DeepSeek API for classification (OpenAI-compatible format)
 * @param {string} prompt - Classification prompt
 * @param {string} apiKey - DeepSeek API key
 * @param {string} model - Model name (e.g., 'deepseek-chat')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result with data, tokens, and timing
 */
export async function callDeepSeek(prompt, apiKey, model, options = {}) {
  const { timeout = 60000 } = options;
  const startTime = Date.now();

  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a JSON-only assistant. Return ONLY valid JSON with no markdown, explanations, or additional text. Your response must start with { and end with }.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: BENCHMARK_CONFIG.tokenLimits['deepseek-chat'] || 8192,
    temperature: BENCHMARK_CONFIG.temperature
  };

  try {
    const response = await axios.post(API_ENDPOINTS.deepseek, requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout
    });

    const latencyMs = Date.now() - startTime;

    // DeepSeek may return reasoning in a separate field for deepseek-reasoner
    const choice = response.data?.choices?.[0];
    const text = choice?.message?.content;
    const reasoningContent = choice?.message?.reasoning_content;

    if (!text) {
      throw new Error('No response text from DeepSeek API');
    }

    // Extract token usage
    const usage = response.data?.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;

    // Parse JSON response - need to handle potential markdown wrapper
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to find JSON object directly
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) {
          parsed = JSON.parse(objMatch[0]);
        } else {
          throw new Error('Could not parse JSON from response');
        }
      }
    }

    return {
      success: true,
      data: parsed,
      inputTokens,
      outputTokens,
      latencyMs,
      rawResponse: text,
      reasoningContent: reasoningContent || null
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return handleError(error, latencyMs, 'deepseek', 0, options.maxRetries || 2);
  }
}

/**
 * Handle API errors and categorize them
 * @param {Error} error - The error object
 * @param {number} latencyMs - Time elapsed before error
 * @param {string} provider - Provider name
 * @param {number} retryCount - Current retry count
 * @param {number} maxRetries - Maximum retries
 * @returns {Object} Error result object
 */
function handleError(error, latencyMs, provider, retryCount, maxRetries) {
  let failureReason = FAILURE_REASONS.UNKNOWN;
  let message = error.message;

  if (error.code === 'ECONNABORTED' || message?.includes('timeout')) {
    failureReason = FAILURE_REASONS.TIMEOUT;
  } else if (error.response?.status === 429) {
    failureReason = FAILURE_REASONS.RATE_LIMIT;
  } else if (error.response?.status >= 500 && error.response?.status < 600) {
    failureReason = FAILURE_REASONS.SERVER_ERROR;
  } else if (error.response?.status === 401 || error.response?.status === 403) {
    failureReason = FAILURE_REASONS.AUTH_ERROR;
  } else if (message?.includes('JSON') || message?.includes('parse')) {
    failureReason = FAILURE_REASONS.PARSE_ERROR;
  } else if (message?.includes('token') || message?.includes('length')) {
    failureReason = FAILURE_REASONS.TOKEN_LIMIT;
  }

  return {
    success: false,
    data: null,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs,
    error: message,
    failureReason,
    httpStatus: error.response?.status,
    retryable: [FAILURE_REASONS.TIMEOUT, FAILURE_REASONS.RATE_LIMIT, FAILURE_REASONS.SERVER_ERROR].includes(failureReason)
  };
}

/**
 * Unified provider call with retry logic
 * @param {string} provider - Provider name (gemini, openai, deepseek)
 * @param {string} model - Model name
 * @param {string} prompt - Classification prompt
 * @param {string} apiKey - API key
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result with data, tokens, and timing
 */
export async function callProvider(provider, model, prompt, apiKey, options = {}) {
  const { maxRetries = 2, retryDelayMs = 2000 } = options;

  let lastResult;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = retryDelayMs * Math.pow(2, attempt - 1);
      console.log(`   Retry ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    switch (provider) {
      case 'gemini':
        lastResult = await callGemini(prompt, apiKey, model, { ...options, retryCount: attempt });
        break;
      case 'openai':
        lastResult = await callOpenAI(prompt, apiKey, model, options);
        break;
      case 'deepseek':
        lastResult = await callDeepSeek(prompt, apiKey, model, options);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    if (lastResult.success || !lastResult.retryable) {
      break;
    }
  }

  return lastResult;
}

/**
 * Classify a batch of sources using the specified model
 * @param {Array} sources - Array of source objects
 * @param {Object} modelConfig - Model configuration
 * @param {Object} apiKeys - Object with gemini, openai, deepseek keys
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Classification result with metrics
 */
export async function classifyBatch(sources, modelConfig, apiKeys, options = {}) {
  const { brandName = 'TestBrand', competitors = [] } = options;
  const { provider, model, id: modelId } = modelConfig;

  const apiKey = apiKeys[provider];
  if (!apiKey) {
    throw new Error(`No API key provided for ${provider}`);
  }

  const prompt = buildClassificationPrompt(sources, brandName, competitors);
  const timeout = getTimeout(sources.length);

  const result = await callProvider(provider, model, prompt, apiKey, {
    ...options,
    timeout
  });

  // Extract classifications and match to sources
  let classifications = [];
  let validClassifications = 0;

  if (result.success && result.data?.classifications) {
    classifications = result.data.classifications;
    validClassifications = classifications.length;
  }

  return {
    modelId,
    provider,
    model,
    sourceCount: sources.length,
    success: result.success,
    latencyMs: result.latencyMs,
    latencyPerSource: result.latencyMs / sources.length,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    classificationsReturned: validClassifications,
    classifications,
    failureReason: result.failureReason || null,
    error: result.error || null,
    rawResponse: result.rawResponse
  };
}
