/**
 * Source Classification Service
 * AI-powered source type classification using Gemini API
 * Based on Google Apps Script V2.13+ source classification system
 */

import axios from 'axios';

/**
 * 10 Approved Source Types (EXACT strings required)
 */
const APPROVED_SOURCE_TYPES = [
  'Corporate Blogs & Content',
  'Journalism',
  'Government/NGO',
  'Aggregators / Encyclopedic',
  'Academic/Research',
  'Owned Media',
  'Competitor Media',
  'Paid/Advertorial',
  'Social / UGC',
  'Press Release'
];

/**
 * Build source classification prompt for Gemini API
 * @param {Array} sources - Array of source objects {url, title, domain}
 * @param {string} brandName - Entity being monitored
 * @param {Array} competitors - List of competitor names
 * @returns {string} Formatted prompt for classification
 */
function buildSourceClassificationPrompt(sources, brandName, competitors = []) {
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

  // Build competitor list for ownership detection
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
    },
    {
      "id": 1,
      "source_type": "Owned Media",
      "competitor_name": null,
      "confidence": "high",
      "reasoning": "Official ${brandName} website"
    },
    {
      "id": 2,
      "source_type": "Competitor Media",
      "competitor_name": "CompetitorName",
      "confidence": "high",
      "reasoning": "Official website of competitor CompetitorName"
    }
  ]
}

Return ONLY the JSON object above. No markdown, no explanations, no additional text.
</INSTRUCTIONS>`;
}

/**
 * Extract YouTube info from URL including video IDs
 * Handles various YouTube URL formats:
 * - youtube.com/@ChannelName
 * - youtube.com/channel/UC...
 * - youtube.com/c/ChannelName
 * - youtube.com/user/Username
 * - youtube.com/watch?v=VIDEO_ID
 * - youtube.com/shorts/VIDEO_ID
 * - youtu.be/VIDEO_ID
 * @param {string} url - Full URL
 * @returns {Object|null} { channelName, channelId, videoId, isYouTube: true } or null if not YouTube
 */
function extractYouTubeChannel(url) {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');

    // Check if it's a YouTube URL
    if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
      return null;
    }

    const pathname = urlObj.pathname;
    let videoId = null;

    // Extract video ID from various formats
    // /watch?v=VIDEO_ID
    const watchParam = urlObj.searchParams.get('v');
    if (watchParam) {
      videoId = watchParam;
    }
    // /shorts/VIDEO_ID
    const shortsMatch = pathname.match(/^\/shorts\/([^\/\?]+)/);
    if (shortsMatch) {
      videoId = shortsMatch[1];
    }
    // youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
      const shortUrlMatch = pathname.match(/^\/([^\/\?]+)/);
      if (shortUrlMatch) {
        videoId = shortUrlMatch[1];
      }
    }

    // Handle @username format (most common now)
    const handleMatch = pathname.match(/^\/@([^\/]+)/);
    if (handleMatch) {
      return {
        channelName: `@${handleMatch[1]}`,
        channelId: null,
        videoId,
        isYouTube: true
      };
    }

    // Handle /channel/UC... format
    const channelIdMatch = pathname.match(/^\/channel\/([^\/]+)/);
    if (channelIdMatch) {
      return {
        channelName: null,
        channelId: channelIdMatch[1],
        videoId,
        isYouTube: true
      };
    }

    // Handle /c/ChannelName format
    const customUrlMatch = pathname.match(/^\/c\/([^\/]+)/);
    if (customUrlMatch) {
      return {
        channelName: customUrlMatch[1],
        channelId: null,
        videoId,
        isYouTube: true
      };
    }

    // Handle /user/Username format (legacy)
    const userMatch = pathname.match(/^\/user\/([^\/]+)/);
    if (userMatch) {
      return {
        channelName: userMatch[1],
        channelId: null,
        videoId,
        isYouTube: true
      };
    }

    // It's a YouTube URL but we couldn't extract channel (e.g., video URL)
    // Return with video ID if available
    return {
      channelName: null,
      channelId: null,
      videoId,
      isYouTube: true
    };
  } catch (e) {
    return null;
  }
}

/**
 * Extract domain from URL, with special handling for YouTube channels
 * @param {string} url - Full URL
 * @returns {string} Domain name or YouTube channel name
 */
function extractDomain(url) {
  if (!url) return '';
  try {
    // Check for YouTube channel
    const ytChannel = extractYouTubeChannel(url);
    if (ytChannel && ytChannel.channelName) {
      return `youtube.com/${ytChannel.channelName}`;
    }

    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}

/**
 * Extract enhanced domain info including YouTube channel and video data
 * @param {string} url - Full URL
 * @returns {Object} { domain, isYouTube, channelName, channelId, videoId }
 */
export function extractDomainInfo(url) {
  if (!url) return { domain: '', isYouTube: false, channelName: null, channelId: null, videoId: null };

  try {
    const ytChannel = extractYouTubeChannel(url);
    const urlObj = new URL(url);
    const baseDomain = urlObj.hostname.replace(/^www\./, '');

    if (ytChannel) {
      return {
        domain: ytChannel.channelName ? `youtube.com/${ytChannel.channelName}` : baseDomain,
        isYouTube: true,
        channelName: ytChannel.channelName,
        channelId: ytChannel.channelId,
        videoId: ytChannel.videoId
      };
    }

    return {
      domain: baseDomain,
      isYouTube: false,
      channelName: null,
      channelId: null,
      videoId: null
    };
  } catch (e) {
    return { domain: url, isYouTube: false, channelName: null, channelId: null, videoId: null };
  }
}

/**
 * Call Gemini API for source classification with retry logic
 * @param {string} prompt - Classification prompt
 * @param {string} apiKey - Gemini API key
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Object>} Classification results
 */
async function callGeminiForClassification(prompt, apiKey, retryCount = 0) {
  const MAX_RETRIES = 2;
  // Use Flash Lite for classification - simpler task, faster and cheaper
  const model = 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8000,
      responseMimeType: 'application/json'
    }
  };

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 second timeout per batch (smaller batches now)
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No response text from Gemini API');
    }

    // Parse JSON response
    const parsed = JSON.parse(text);
    return parsed;
  } catch (error) {
    // Retry on timeout or 5xx errors
    const isRetryable = error.code === 'ECONNABORTED' ||
                        error.message?.includes('timeout') ||
                        (error.response?.status >= 500 && error.response?.status < 600);

    if (isRetryable && retryCount < MAX_RETRIES) {
      const delay = (retryCount + 1) * 2000; // 2s, 4s backoff
      console.log(`   🔄 Retrying classification in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiForClassification(prompt, apiKey, retryCount + 1);
    }

    if (error.response) {
      console.error('Gemini API Error:', error.response.status, error.response.data);
      throw new Error(`Gemini API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      console.error('Source classification error:', error.message);
      throw error;
    }
  }
}

/**
 * Classify a batch of sources using Gemini API
 * @param {Array} sourceBatch - Batch of source objects
 * @param {string} brandName - Entity being monitored
 * @param {string} apiKey - Gemini API key
 * @param {number} batchOffset - Offset for ID mapping
 * @param {Array} competitors - List of competitor names
 * @returns {Promise<Array>} Classified sources batch
 */
async function classifyBatch(sourceBatch, brandName, apiKey, batchOffset, competitors = []) {
  const prompt = buildSourceClassificationPrompt(sourceBatch, brandName, competitors);
  const result = await callGeminiForClassification(prompt, apiKey);

  const classifications = result.classifications || [];
  return sourceBatch.map((source, idx) => {
    const classification = classifications.find(c => c.id === idx);
    const domainInfo = extractDomainInfo(source.url);

    const baseResult = {
      ...source,
      domain: domainInfo.domain, // Use enhanced domain (includes YouTube channel name)
      isYouTube: domainInfo.isYouTube,
      youtubeChannel: domainInfo.channelName
    };

    if (classification) {
      return {
        ...baseResult,
        source_type: classification.source_type || 'Other',
        competitor_name: classification.competitor_name || null,
        classification_confidence: classification.confidence || 'low',
        classification_reasoning: classification.reasoning || ''
      };
    } else {
      return {
        ...baseResult,
        source_type: 'Other',
        competitor_name: null,
        classification_confidence: 'low',
        classification_reasoning: 'No classification returned'
      };
    }
  });
}

/**
 * Classify sources using Gemini API with batching for large lists
 * @param {Array} sources - Array of source objects {url, title, domain, cited_by}
 * @param {string} brandName - Entity being monitored
 * @param {string} apiKey - Gemini API key
 * @param {Array} competitors - List of competitor names for ownership detection
 * @returns {Promise<Array>} Sources with classifications added
 */
export async function classifySourceTypes(sources, brandName, apiKey, competitors = []) {
  if (!sources || sources.length === 0) {
    return sources;
  }

  if (!apiKey) {
    console.warn('No Gemini API key provided for source classification. Skipping classification.');
    return sources.map(s => ({
      ...s,
      source_type: 'Other',
      competitor_name: null,
      classification_confidence: 'low',
      classification_reasoning: 'No API key provided'
    }));
  }

  try {
    console.log(`🔍 Classifying ${sources.length} sources using Gemini API...`);
    if (competitors.length > 0) {
      console.log(`   📊 Competitor detection enabled for: ${brandName} (Owned Media) vs ${competitors.join(', ')} (Competitor Media)`);
    }

    // Batch sources for classification (100 per batch)
    const BATCH_SIZE = 100;
    const classifiedSources = [];

    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
      const batch = sources.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(sources.length / BATCH_SIZE);

      if (totalBatches > 1) {
        console.log(`   📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} sources)...`);
      }

      try {
        const classifiedBatch = await classifyBatch(batch, brandName, apiKey, i, competitors);
        classifiedSources.push(...classifiedBatch);
      } catch (batchError) {
        console.error(`   ⚠️ Batch ${batchNum} failed:`, batchError.message);
        // Add fallback classification for failed batch
        batch.forEach(source => {
          classifiedSources.push({
            ...source,
            source_type: 'Other',
            competitor_name: null,
            classification_confidence: 'low',
            classification_reasoning: `Batch classification failed: ${batchError.message}`
          });
        });
      }

      // No delay needed between batches - Gemini handles rate limiting well
    }

    console.log(`✅ Classified ${classifiedSources.length} sources`);

    // Log distribution
    const typeDistribution = classifiedSources.reduce((acc, s) => {
      acc[s.source_type] = (acc[s.source_type] || 0) + 1;
      return acc;
    }, {});
    console.log('Source type distribution:', typeDistribution);

    return classifiedSources;

  } catch (error) {
    console.error('Error classifying sources:', error.message);
    // Return sources with fallback classification
    return sources.map(s => ({
      ...s,
      source_type: 'Other',
      competitor_name: null,
      classification_confidence: 'low',
      classification_reasoning: `Classification failed: ${error.message}`
    }));
  }
}

/**
 * Generate source analysis from classified sources
 * @param {Array} classifiedSources - Sources with classification
 * @returns {Object} Source analysis object
 */
export function generateSourceAnalysis(classifiedSources) {
  const sourceTypes = {
    'Journalism': 0,
    'Corporate Blogs & Content': 0,
    'Social / UGC': 0,
    'Aggregators / Encyclopedic': 0,
    'Government/NGO': 0,
    'Academic/Research': 0,
    'Owned Media': 0,
    'Competitor Media': 0,
    'Paid/Advertorial': 0,
    'Press Release': 0,
    'Other': 0
  };

  const competitorBreakdown = {};

  classifiedSources.forEach(source => {
    // Count source types
    const type = source.source_type || 'Other';
    if (sourceTypes.hasOwnProperty(type)) {
      sourceTypes[type]++;
    } else {
      sourceTypes['Other']++;
    }

    // Track competitor breakdown for Competitor Media sources
    if (type === 'Competitor Media' && source.competitor_name) {
      competitorBreakdown[source.competitor_name] = (competitorBreakdown[source.competitor_name] || 0) + 1;
    }
  });

  return {
    total_sources: classifiedSources.length,
    source_type_distribution: sourceTypes,
    competitor_breakdown: competitorBreakdown,
    unique_domains: new Set(classifiedSources.map(s => s.domain)).size
  };
}
