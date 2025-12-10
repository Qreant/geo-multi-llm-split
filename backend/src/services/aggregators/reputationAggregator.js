/**
 * Reputation Analysis Aggregator
 * Simplified version - can be enhanced with full Google Apps Script logic
 */

/**
 * Aggregate reputation analysis from raw LLM responses
 */
export function aggregateReputationAnalysis(rawResponses, config) {
  const sentimentTopics = {
    positive_topics: [],
    negative_topics: [],
    neutral_topics: []
  };

  const sourcesMap = new Map();
  const topicsMap = new Map();

  // Process each response
  rawResponses.forEach(response => {
    const { question, gemini, openai } = response;

    // Process Gemini response
    if (gemini.data && gemini.data.raw_response) {
      processResponse(gemini.data, gemini.sources, 'gemini', question, topicsMap, sourcesMap);
    }

    // Process OpenAI response
    if (openai.data && openai.data.raw_response) {
      processResponse(openai.data, openai.sources, 'openai', question, topicsMap, sourcesMap);
    }
  });

  // Convert maps to arrays and organize by sentiment
  topicsMap.forEach((topic, key) => {
    const avgSentiment = topic.sentimentScores.reduce((a, b) => a + b, 0) / topic.sentimentScores.length;

    const topicData = {
      topic: topic.name,
      frequency: topic.frequency,
      sentiment_score: avgSentiment,
      quotes: topic.quotes,
      sources: topic.sources
    };

    if (avgSentiment > 0.6) {
      sentimentTopics.positive_topics.push(topicData);
    } else if (avgSentiment < 0.4) {
      sentimentTopics.negative_topics.push(topicData);
    } else {
      sentimentTopics.neutral_topics.push(topicData);
    }
  });

  // Sort by frequency
  sentimentTopics.positive_topics.sort((a, b) => b.frequency - a.frequency);
  sentimentTopics.negative_topics.sort((a, b) => b.frequency - a.frequency);
  sentimentTopics.neutral_topics.sort((a, b) => b.frequency - a.frequency);

  // Generate source analysis
  const sourcesArray = Array.from(sourcesMap.values());
  const sourceAnalysis = generateSourceAnalysis(sourcesArray);

  return {
    entity: config.entity,
    sentiment_topics: sentimentTopics,
    source_analysis: sourceAnalysis,
    sources: sourcesArray, // Include individual sources for detailed domain list
    questions: rawResponses.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Process a single LLM response
 */
function processResponse(data, sources, llmSource, question, topicsMap, sourcesMap) {
  // Extract topics from response
  const response = data.raw_response || '';

  // Simple sentiment analysis based on keywords
  const sentimentScore = calculateSimpleSentiment(response);

  // Extract key phrases as topics
  const topics = extractTopics(response, question.question);

  topics.forEach(topic => {
    if (!topicsMap.has(topic)) {
      topicsMap.set(topic, {
        name: topic,
        frequency: 0,
        sentimentScores: [],
        quotes: [],
        sources: []
      });
    }

    const topicData = topicsMap.get(topic);
    topicData.frequency++;
    topicData.sentimentScores.push(sentimentScore);
    topicData.quotes.push({
      text: response.substring(0, 200),
      llm: llmSource
    });
  });

  // Process sources
  if (sources && Array.isArray(sources)) {
    sources.forEach(source => {
      if (!sourcesMap.has(source.url)) {
        sourcesMap.set(source.url, {
          url: source.url,
          title: source.title || source.domain,
          domain: source.domain,
          cited_by: []
        });
      }

      const sourceData = sourcesMap.get(source.url);
      if (!sourceData.cited_by.includes(llmSource)) {
        sourceData.cited_by.push(llmSource);
      }
    });
  }
}

/**
 * Simple sentiment calculation
 */
function calculateSimpleSentiment(text) {
  const positive = ['good', 'great', 'excellent', 'reliable', 'trusted', 'popular', 'best', 'strong', 'positive', 'worth'];
  const negative = ['bad', 'poor', 'unreliable', 'worst', 'issues', 'problems', 'concerns', 'weak', 'negative'];

  const lowerText = text.toLowerCase();
  let score = 0.5; // Neutral baseline

  positive.forEach(word => {
    const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
    score += count * 0.05;
  });

  negative.forEach(word => {
    const count = (lowerText.match(new RegExp(word, 'g')) || []).length;
    score -= count * 0.05;
  });

  return Math.max(0, Math.min(1, score));
}

/**
 * Extract topics from response
 */
function extractTopics(response, question) {
  // Simple topic extraction based on keywords
  const topics = [];

  // Common reputation topics
  const topicKeywords = {
    'Quality': ['quality', 'high-quality', 'premium'],
    'Reliability': ['reliable', 'reliability', 'dependable'],
    'Value': ['value', 'affordable', 'price', 'cost'],
    'Customer Service': ['customer service', 'support', 'service'],
    'Innovation': ['innovative', 'innovation', 'advanced'],
    'Reviews': ['reviews', 'ratings', 'feedback']
  };

  const lowerResponse = response.toLowerCase();

  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => lowerResponse.includes(keyword))) {
      topics.push(topic);
    }
  });

  return topics.length > 0 ? topics : ['General Reputation'];
}

/**
 * Generate source analysis
 */
function generateSourceAnalysis(sources) {
  const sourceTypes = {
    'Journalism': 0,
    'Corporate Blogs & Content': 0,
    'Social / UGC': 0,
    'Aggregators / Encyclopedic': 0,
    'Other': 0
  };

  sources.forEach(source => {
    const type = classifySourceType(source.domain);
    sourceTypes[type]++;
  });

  return {
    total_sources: sources.length,
    source_type_distribution: sourceTypes,
    unique_domains: sources.length
  };
}

/**
 * Classify source type based on domain
 */
function classifySourceType(domain) {
  const journalism = ['bbc', 'cnn', 'nytimes', 'reuters', 'bloomberg', 'forbes', 'techcrunch'];
  const corporate = ['blog', 'company', 'official'];
  const social = ['reddit', 'twitter', 'facebook', 'youtube', 'trustpilot'];
  const aggregator = ['wikipedia', 'comparison', 'review', 'nerdwallet'];

  const lowerDomain = domain.toLowerCase();

  if (journalism.some(keyword => lowerDomain.includes(keyword))) {
    return 'Journalism';
  }
  if (corporate.some(keyword => lowerDomain.includes(keyword))) {
    return 'Corporate Blogs & Content';
  }
  if (social.some(keyword => lowerDomain.includes(keyword))) {
    return 'Social / UGC';
  }
  if (aggregator.some(keyword => lowerDomain.includes(keyword))) {
    return 'Aggregators / Encyclopedic';
  }

  return 'Other';
}
