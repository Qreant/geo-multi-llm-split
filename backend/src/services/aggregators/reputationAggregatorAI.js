/**
 * AI-Powered Reputation Analysis Aggregator
 * Matches Google Apps Script V2.17 logic exactly
 * Uses Gemini to extract concepts, sentiment topics, and sources
 * Includes keyword-based fallback when AI fails
 */

import { callGeminiForJSON } from '../llmService.js';
import { parseJSON } from '../../utils/jsonParser.js';
import { extractDomainInfo } from '../sourceClassifier.js';

/**
 * Keyword-based fallback for sentiment extraction when AI fails
 * Extracts basic sentiment topics from raw responses using keyword matching
 */
function extractSentimentFromKeywords(rawResponses, entity) {
  console.log('[ReputationAggregator] Using keyword-based fallback extraction');

  // Positive indicators
  const positiveKeywords = [
    'excellent', 'great', 'best', 'good', 'quality', 'reliable', 'popular',
    'trusted', 'innovative', 'comfortable', 'durable', 'stylish', 'premium',
    'recommended', 'favorite', 'leading', 'top', 'outstanding', 'superior',
    'value', 'worth', 'love', 'amazing', 'impressive', 'renowned'
  ];

  // Negative indicators
  const negativeKeywords = [
    'expensive', 'overpriced', 'poor', 'bad', 'issue', 'problem', 'complaint',
    'disappointing', 'concern', 'criticism', 'controversy', 'inconsistent',
    'cheap', 'flimsy', 'uncomfortable', 'narrow', 'limited', 'declining',
    'struggle', 'fail', 'worse', 'lacking', 'avoid'
  ];

  const positiveTopics = new Map();
  const negativeTopics = new Map();
  const neutralTopics = new Map();

  rawResponses.forEach(response => {
    const rawText = (response.gemini?.data?.raw_response || response.openai?.data?.raw_response || '').toLowerCase();
    const sources = response.gemini?.sources || response.openai?.sources || [];
    const llm = response.gemini?.data ? 'Gemini' : 'OpenAI';

    // Extract sentences
    const sentences = rawText.split(/[.!?]+/).filter(s => s.trim().length > 20);

    sentences.forEach(sentence => {
      const sentenceTrimmed = sentence.trim();

      // Check for positive keywords
      positiveKeywords.forEach(keyword => {
        if (sentenceTrimmed.includes(keyword)) {
          const topicKey = keyword.charAt(0).toUpperCase() + keyword.slice(1);
          if (!positiveTopics.has(topicKey)) {
            positiveTopics.set(topicKey, {
              topic: `${entity} - ${topicKey}`,
              frequency: 0,
              sentiment_score: 0.7,
              quotes: [],
              sources: [],
              cited_by: new Set()
            });
          }
          const topic = positiveTopics.get(topicKey);
          topic.frequency += 1;
          topic.cited_by.add(llm);
          if (topic.quotes.length < 3 && sentenceTrimmed.length < 100) {
            topic.quotes.push(sentenceTrimmed.substring(0, 80));
          }
          sources.forEach(s => {
            if (!topic.sources.find(ts => ts.url === s.url)) {
              topic.sources.push(s);
            }
          });
        }
      });

      // Check for negative keywords
      negativeKeywords.forEach(keyword => {
        if (sentenceTrimmed.includes(keyword)) {
          const topicKey = keyword.charAt(0).toUpperCase() + keyword.slice(1);
          if (!negativeTopics.has(topicKey)) {
            negativeTopics.set(topicKey, {
              topic: `${entity} - ${topicKey}`,
              frequency: 0,
              sentiment_score: -0.6,
              quotes: [],
              sources: [],
              cited_by: new Set()
            });
          }
          const topic = negativeTopics.get(topicKey);
          topic.frequency += 1;
          topic.cited_by.add(llm);
          if (topic.quotes.length < 3 && sentenceTrimmed.length < 100) {
            topic.quotes.push(sentenceTrimmed.substring(0, 80));
          }
          sources.forEach(s => {
            if (!topic.sources.find(ts => ts.url === s.url)) {
              topic.sources.push(s);
            }
          });
        }
      });
    });
  });

  // Normalize frequencies and convert to arrays
  const totalResponses = rawResponses.length || 1;

  const formatTopics = (topicsMap) => {
    return Array.from(topicsMap.values())
      .map(t => ({
        topic: t.topic,
        frequency: Math.min(t.frequency / totalResponses, 1),
        sentiment_score: t.sentiment_score,
        quotes: t.quotes.slice(0, 3),
        sources: t.sources.slice(0, 5),
        cited_by: Array.from(t.cited_by)
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
  };

  const result = {
    positive_topics: formatTopics(positiveTopics),
    negative_topics: formatTopics(negativeTopics),
    neutral_topics: formatTopics(neutralTopics)
  };

  console.log('[ReputationAggregator] Fallback extracted:', {
    positive: result.positive_topics.length,
    negative: result.negative_topics.length,
    neutral: result.neutral_topics.length
  });

  return result;
}

/**
 * Build concept extraction prompt (matches Google Apps Script)
 */
function buildConceptExtractionPrompt(rawResponsesWithSources, entity) {
  const responsesText = rawResponsesWithSources
    .map((r, idx) => {
      const responseText = r.gemini?.data?.raw_response || r.openai?.data?.raw_response || JSON.stringify(r);
      const sources = r.gemini?.sources || r.openai?.sources || [];
      const llm = r.gemini?.data ? 'Gemini' : 'OpenAI';
      return `[Response ${idx + 1} - ${llm}]\n${responseText}\nSources: ${JSON.stringify(sources)}`;
    })
    .join('\n\n---\n\n');

  return `You are analyzing brand reputation data for: ${entity}

Raw LLM responses from multiple questions (with source citations):
NOTE: Each response is labeled with which LLM (Gemini or OpenAI) generated it.
${responsesText}

Task:
1. Extract TOP 10 recurring concepts/themes (e.g., "Technical Performance", "Price Point", "Customer Service")
2. Calculate frequency (0.0 to 1.0 = proportion mentioning it)
3. Categorize sentiment: "positive", "negative", or "mixed"
4. Extract 2-3 key phrases for each concept (keep phrases under 80 chars)
5. **FOR ALL CONCEPTS (positive, negative, and mixed):** Extract source URLs with domain and title
6. **Track which LLM(s) mentioned each concept** using cited_by field

Additionally:
7. Categorize into positive_topics, negative_topics, and neutral_topics
8. For each topic: frequency (0-1), sentiment_score (-1 to 1), quotes (keep quotes under 80 chars each)
9. **FOR ALL TOPICS (positive, negative, and neutral):** Extract source URLs with domain and title
10. **Track which LLM(s) mentioned each topic** using cited_by field
11. **Return UP TO 5 most significant topics per sentiment category** (sorted by frequency)
12. **IMPORTANT**: Return at least 1 topic per category if any relevant sentiment exists in the raw responses. Even if there are fewer than 5 strong topics, include what you find.

Output ONLY valid JSON:
{
  "concepts": [
    {
      "concept": "Customer Service",
      "frequency": 0.45,
      "sentiment": "positive",
      "key_phrases": ["excellent support", "responsive team"],
      "cited_by": ["Gemini", "OpenAI"]
    },
    {
      "concept": "Data Accuracy",
      "frequency": 0.6,
      "sentiment": "negative",
      "key_phrases": ["inaccuracies", "errors in reports"],
      "cited_by": ["Gemini"],
      "sources": [
        {
          "url": "https://www.consumeraffairs.com/finance/brand.html",
          "domain": "consumeraffairs.com",
          "title": "Reviews - Data Accuracy Issues"
        }
      ]
    }
  ],
  "sentiment_topics": {
    "positive_topics": [
      {
        "topic": "Credit Monitoring Tools",
        "frequency": 0.67,
        "sentiment_score": 0.85,
        "quotes": ["comprehensive monitoring", "excellent alerts"],
        "cited_by": ["Gemini", "OpenAI"],
        "sources": [
          {
            "url": "https://www.consumeraffairs.com/finance/credit-monitoring.html",
            "domain": "consumeraffairs.com",
            "title": "Best Credit Monitoring Services"
          }
        ]
      }
    ],
    "negative_topics": [
      {
        "topic": "Data Accuracy Issues",
        "frequency": 0.6,
        "sentiment_score": -0.7,
        "quotes": ["reports contain errors", "inaccurate information"],
        "cited_by": ["Gemini"],
        "sources": [
          {
            "url": "https://www.consumeraffairs.com/finance/brand.html",
            "domain": "consumeraffairs.com",
            "title": "Consumer Complaints"
          }
        ]
      }
    ],
    "neutral_topics": []
  }
}

Return maximum 10 concepts (sorted by frequency) and up to 5 topics per sentiment category (sorted by frequency). Include at least 1 topic per category if any sentiment exists.`;
}

/**
 * Extract full sources list from raw responses
 */
function extractFullSourcesList(rawResponses) {
  const sourcesMap = new Map();

  rawResponses.forEach(response => {
    // Extract from Gemini
    if (response.gemini?.sources) {
      response.gemini.sources.forEach(source => {
        if (source.url) {
          // Get enhanced domain info including YouTube channel
          const domainInfo = extractDomainInfo(source.url);
          sourcesMap.set(source.url, {
            url: source.url,
            domain: domainInfo.isYouTube && domainInfo.channelName
              ? `youtube.com/${domainInfo.channelName}`
              : (source.domain || domainInfo.domain),
            title: source.title || source.domain || '',
            relevance_score: source.relevance_score || 0,
            source_type: source.source_type || 'Other',
            classification_confidence: source.classification_confidence,
            classification_reasoning: source.classification_reasoning,
            youtube_channel: source.youtube_channel || domainInfo.channelName || null,
            isYouTube: domainInfo.isYouTube
          });
        }
      });
    }

    // Extract from OpenAI
    if (response.openai?.sources) {
      response.openai.sources.forEach(source => {
        if (source.url) {
          // Get enhanced domain info including YouTube channel
          const domainInfo = extractDomainInfo(source.url);
          sourcesMap.set(source.url, {
            url: source.url,
            domain: domainInfo.isYouTube && domainInfo.channelName
              ? `youtube.com/${domainInfo.channelName}`
              : (source.domain || domainInfo.domain),
            title: source.title || source.domain || '',
            relevance_score: source.relevance_score || 0,
            source_type: source.source_type || 'Other',
            classification_confidence: source.classification_confidence,
            classification_reasoning: source.classification_reasoning,
            youtube_channel: source.youtube_channel || domainInfo.channelName || null,
            isYouTube: domainInfo.isYouTube
          });
        }
      });
    }
  });

  return Array.from(sourcesMap.values());
}

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
 * Extract top domains by frequency
 */
function extractTopDomains(rawResponses) {
  const domainCounts = new Map();
  let totalSources = 0;

  rawResponses.forEach(response => {
    const sources = [
      ...(response.gemini?.sources || []),
      ...(response.openai?.sources || [])
    ];

    sources.forEach(source => {
      const domain = source.domain || extractDomain(source.url);
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      totalSources++;
    });
  });

  return Array.from(domainCounts.entries())
    .map(([domain, count]) => ({
      domain,
      frequency: totalSources > 0 ? count / totalSources : 0
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}

/**
 * Generate source analysis from classified sources
 * Matches Google Apps Script V2.17 categorizeAllSources_ logic
 */
function generateSourceAnalysis(rawResponses) {
  const allSources = extractFullSourcesList(rawResponses);

  // Initialize source type counts (using 9-type taxonomy)
  const sourceTypes = {
    'Journalism': 0,
    'Corporate Blogs & Content': 0,
    'Owned Media': 0,
    'Social / UGC': 0,
    'Aggregators / Encyclopedic': 0,
    'Academic/Research': 0,
    'Government/NGO': 0,
    'Press Release': 0,
    'Paid/Advertorial': 0,
    'Other': 0
  };

  // Count source types from classified sources
  rawResponses.forEach(response => {
    // Check both Gemini and OpenAI sources
    const sources = [
      ...(response.gemini?.sources || []),
      ...(response.openai?.sources || [])
    ];

    sources.forEach(source => {
      const sourceType = source.source_type || 'Other';
      if (sourceTypes.hasOwnProperty(sourceType)) {
        sourceTypes[sourceType]++;
      } else {
        sourceTypes['Other']++;
      }
    });
  });

  return {
    total_sources: allSources.length,
    source_type_distribution: sourceTypes,
    unique_domains: new Set(allSources.map(s => s.domain)).size
  };
}

/**
 * Aggregate reputation analysis using AI (matches Google Apps Script)
 */
export async function aggregateReputationAnalysis(rawResponses, config) {
  console.log('[ReputationAggregator] Starting AI-powered aggregation');
  console.log('[ReputationAggregator] Raw responses count:', rawResponses.length);

  if (rawResponses.length === 0) {
    console.log('[ReputationAggregator] No raw responses provided');
    return {
      category_check: !!config.category,
      category: config.category || '',
      entity: config.entity,
      concepts: [],
      sentiment_topics: {
        positive_topics: [],
        negative_topics: [],
        neutral_topics: []
      },
      top_domains_used: [],
      full_sources_list: [],
      source_analysis: generateSourceAnalysis([]),
      questions: 0
    };
  }

  try {
    // Build AI extraction prompt
    const prompt = buildConceptExtractionPrompt(rawResponses, config.entity);

    // Call Gemini 2.5 Flash for extraction (more reliable for complex JSON)
    console.log('[ReputationAggregator] Calling Gemini 2.5 Flash for concept extraction...');
    const response = await callGeminiForJSON(prompt, process.env.GEMINI_API_KEY, 'gemini-2.5-flash');

    console.log('[ReputationAggregator] Gemini response received, length:', response?.text?.length || 0);

    // Parse JSON response
    const analysis = parseJSON(response.text);

    if (!analysis) {
      console.error('[ReputationAggregator] Failed to parse Gemini response');
      console.error('[ReputationAggregator] Response text (first 500 chars):', response.text?.substring(0, 500));
      console.error('[ReputationAggregator] Response text (last 500 chars):', response.text?.substring(response.text.length - 500));
      throw new Error('Failed to parse AI extraction response');
    }

    console.log('[ReputationAggregator] Successfully parsed analysis');
    console.log('[ReputationAggregator] Concepts:', analysis.concepts?.length || 0);

    // Normalize sentiment_topics: rename mixed_topics to neutral_topics if present
    if (analysis.sentiment_topics) {
      if (analysis.sentiment_topics.mixed_topics && !analysis.sentiment_topics.neutral_topics) {
        analysis.sentiment_topics.neutral_topics = analysis.sentiment_topics.mixed_topics;
        delete analysis.sentiment_topics.mixed_topics;
      }
    }

    console.log('[ReputationAggregator] Positive topics:', analysis.sentiment_topics?.positive_topics?.length || 0);
    console.log('[ReputationAggregator] Negative topics:', analysis.sentiment_topics?.negative_topics?.length || 0);
    console.log('[ReputationAggregator] Neutral topics:', analysis.sentiment_topics?.neutral_topics?.length || 0);

    // Extract full sources list
    const fullSourcesList = extractFullSourcesList(rawResponses);

    // Merge grounded sources if available
    if (response.groundedSources && response.groundedSources.length > 0) {
      fullSourcesList.push(...response.groundedSources);
    }

    return {
      category_check: !!config.category,
      category: config.category || '',
      entity: config.entity,
      concepts: analysis.concepts || [],
      sentiment_topics: analysis.sentiment_topics || {
        positive_topics: [],
        negative_topics: [],
        neutral_topics: []
      },
      top_domains_used: extractTopDomains(rawResponses),
      full_sources_list: fullSourcesList,
      source_analysis: generateSourceAnalysis(rawResponses),
      questions: rawResponses.length,
      grounded_sources: response.groundedSources || []
    };

  } catch (error) {
    console.error('[ReputationAggregator] Error during aggregation:', error);
    console.log('[ReputationAggregator] Attempting keyword-based fallback extraction...');

    // Use keyword-based fallback to extract at least some sentiment topics
    const fallbackSentiment = extractSentimentFromKeywords(rawResponses, config.entity);

    // Return fallback structure with keyword-extracted topics
    return {
      category_check: !!config.category,
      category: config.category || '',
      entity: config.entity,
      concepts: [],
      sentiment_topics: fallbackSentiment,
      top_domains_used: extractTopDomains(rawResponses),
      full_sources_list: extractFullSourcesList(rawResponses),
      source_analysis: generateSourceAnalysis(rawResponses),
      questions: rawResponses.length,
      error: error.message,
      fallback_used: true
    };
  }
}
