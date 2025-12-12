/**
 * PR Insights Aggregator Service - V3
 * Enhanced methodology with:
 * - Explicit Reputation Opportunities (standalone, not just source-linked)
 * - Explicit Competitive Opportunities (when brand loses to competitors)
 * - Improved source classification fallback with domain heuristics
 * - Rebalanced scoring weights
 * - Source-centric approach for visibility gaps
 * - Minimum citation threshold to filter noise (>= 3 citations required)
 */

// CONFIGURATION: Minimum citations required for a source to be included
// Based on analysis: 54.6% of sources have only 1 citation and are noise
// Threshold of 2 keeps 45.4% of sources, threshold of 3 keeps 26.8%
const MIN_CITATIONS_THRESHOLD = 3;

/**
 * Check if an entity name matches the target brand (including product variations)
 * e.g., "Nike Pegasus" matches target "Nike"
 */
function isSameBrandFamily(entityName, targetBrand) {
  if (!entityName || !targetBrand) return false;

  const entity = entityName.toLowerCase().trim();
  const target = targetBrand.toLowerCase().trim();

  // Exact match
  if (entity === target) return true;

  // One contains the other (handles "Nike" matching "Nike Pegasus", "Nike Air Max", etc.)
  if (entity.includes(target)) return true;
  if (target.includes(entity)) return true;

  return false;
}

/**
 * Extract domain from URL
 */
function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Domain-based heuristic for source authority when classification fails
 * @param {string} domain - The source domain
 * @returns {Object} { sourceType, authorityScore }
 */
function getSourceAuthorityFromDomain(domain) {
  if (!domain) return { sourceType: 'Other', authorityScore: 0.30 };

  const domainLower = domain.toLowerCase();

  // Journalism - major news outlets
  const journalismDomains = [
    'reuters.com', 'nytimes.com', 'washingtonpost.com', 'wsj.com', 'bbc.com', 'bbc.co.uk',
    'theguardian.com', 'forbes.com', 'bloomberg.com', 'cnbc.com', 'cnn.com', 'apnews.com',
    'usatoday.com', 'latimes.com', 'economist.com', 'ft.com', 'lemonde.fr', 'lesechos.fr',
    'lefigaro.fr', 'liberation.fr', 'bfmtv.com', 'corriere.it', 'repubblica.it', 'ilsole24ore.com',
    'ansa.it', 'spiegel.de', 'zeit.de', 'sueddeutsche.de', 'faz.net', 'elpais.com', 'elmundo.es',
    'techcrunch.com', 'theverge.com', 'wired.com', 'arstechnica.com', 'engadget.com',
    'cnet.com', 'zdnet.com', 'venturebeat.com', 'businessinsider.com', 'axios.com',
    'politico.com', 'theatlantic.com', 'newyorker.com', 'time.com', 'newsweek.com'
  ];

  // Government/NGO
  const govDomains = [
    '.gov', '.gov.uk', '.gov.fr', '.gov.it', '.gov.de', 'europa.eu',
    'un.org', 'who.int', 'worldbank.org', 'imf.org', 'oecd.org',
    'energy.gov', 'epa.gov', 'fda.gov', 'sec.gov', 'ftc.gov', 'transportation.gov'
  ];

  // Academic/Research
  const academicDomains = [
    '.edu', '.ac.uk', '.edu.au', 'nature.com', 'science.org', 'sciencedirect.com',
    'springer.com', 'ieee.org', 'acm.org', 'researchgate.net', 'academia.edu',
    'arxiv.org', 'pubmed.gov', 'ncbi.nlm.nih.gov', 'jstor.org', 'mckinsey.com',
    'bcg.com', 'bain.com', 'deloitte.com', 'pwc.com', 'ey.com', 'kpmg.com'
  ];

  // Aggregator/Encyclopedic
  const aggregatorDomains = [
    'wikipedia.org', 'britannica.com', 'investopedia.com', 'statista.com',
    'crunchbase.com', 'pitchbook.com', 'zoominfo.com', 'owler.com',
    'comparably.com', 'g2.com', 'capterra.com', 'softwareadvice.com',
    'trustradius.com', 'gartner.com', 'forrester.com', 'idc.com'
  ];

  // Review Sites
  const reviewDomains = [
    'glassdoor.com', 'indeed.com', 'trustpilot.com', 'yelp.com', 'tripadvisor.com',
    'consumerreports.org', 'jdpower.com', 'edmunds.com', 'kbb.com', 'caranddriver.com',
    'motortrend.com', 'autotrader.com', 'carfax.com', 'cars.com', 'autoblog.com',
    'topgear.com', 'automobile-propre.com', 'caradisiac.com', 'largus.fr', 'autoplus.fr',
    'solarreviews.com', 'energysage.com', 'solarpowerworldonline.com'
  ];

  // Social/UGC
  const socialDomains = [
    'reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'tiktok.com', 'medium.com', 'substack.com',
    'quora.com', 'stackexchange.com', 'stackoverflow.com', 'discord.com'
  ];

  // Corporate/Brand sites
  const corporateDomains = [
    'tesla.com', 'ford.com', 'gm.com', 'bmw.com', 'mercedes-benz.com', 'volkswagen.com',
    'toyota.com', 'honda.com', 'nissan.com', 'hyundai.com', 'kia.com', 'rivian.com',
    'lucidmotors.com', 'apple.com', 'google.com', 'microsoft.com', 'amazon.com'
  ];

  // Check against each category
  for (const d of journalismDomains) {
    if (domainLower.includes(d.replace('.com', '').replace('.', ''))) {
      return { sourceType: 'Journalism', authorityScore: 0.95 };
    }
  }

  for (const d of govDomains) {
    if (domainLower.includes(d)) {
      return { sourceType: 'Government/NGO', authorityScore: 0.85 };
    }
  }

  for (const d of academicDomains) {
    if (domainLower.includes(d.replace('.', ''))) {
      return { sourceType: 'Academic/Research', authorityScore: 0.90 };
    }
  }

  for (const d of aggregatorDomains) {
    if (domainLower.includes(d.replace('.com', '').replace('.org', ''))) {
      return { sourceType: 'Aggregator/Encyclopedic', authorityScore: 0.65 };
    }
  }

  for (const d of reviewDomains) {
    if (domainLower.includes(d.replace('.com', '').replace('.org', '').replace('.fr', ''))) {
      return { sourceType: 'Review Sites', authorityScore: 0.60 };
    }
  }

  for (const d of socialDomains) {
    if (domainLower.includes(d.replace('.com', ''))) {
      return { sourceType: 'Social/UGC', authorityScore: 0.40 };
    }
  }

  for (const d of corporateDomains) {
    if (domainLower.includes(d.replace('.com', ''))) {
      return { sourceType: 'Corporate Blogs & Content', authorityScore: 0.55 };
    }
  }

  return { sourceType: 'Other', authorityScore: 0.30 };
}

/**
 * Calculate source authority score based on source type
 * With fallback to domain heuristics when classification fails
 * @param {string} sourceType - The source type classification
 * @param {string} domain - The source domain (for fallback)
 * @param {string} classificationConfidence - Classification confidence level
 * @returns {number} Authority score (0-1)
 */
function getSourceAuthorityScore(sourceType, domain = '', classificationConfidence = 'high') {
  // If classification failed or is low confidence, use domain heuristics
  if (!sourceType || sourceType === 'Other' || classificationConfidence === 'low') {
    const heuristic = getSourceAuthorityFromDomain(domain);
    return heuristic.authorityScore;
  }

  const authorityMap = {
    'Journalism': 0.95,
    'Academic/Research': 0.90,
    'Government/NGO': 0.85,
    'Press Release': 0.70,
    'Aggregator/Encyclopedic': 0.65,
    'Review Sites': 0.60,
    'Corporate Blogs & Content': 0.55,
    'Social/UGC': 0.40,
    'Other': 0.30
  };
  return authorityMap[sourceType] || 0.30;
}

/**
 * Get effective source type (with domain fallback)
 */
function getEffectiveSourceType(sourceType, domain, classificationConfidence) {
  if (!sourceType || sourceType === 'Other' || classificationConfidence === 'low') {
    const heuristic = getSourceAuthorityFromDomain(domain);
    return heuristic.sourceType;
  }
  return sourceType;
}

/**
 * Calculate impact score for a SOURCE based on its role in visibility gaps
 * REBALANCED WEIGHTS V3:
 * - Reduced citation dominance (was 60 max, now 40 max)
 * - Increased rank gap importance (was 10 max, now 15 max)
 * - Added reputation issue boost
 * @param {Object} sourceData - Aggregated data about the source
 * @returns {number} Impact score (0-100)
 */
function calculateSourceImpactScore(sourceData) {
  const {
    totalCitations,
    visibilityGapCitations,
    competitiveLossCitations,
    reputationIssueCitations = 0,
    avgRankGap,
    sourceType,
    domain,
    classificationConfidence,
    citedByBothLLMs
  } = sourceData;

  // Base score from citation frequency (0-20 points) - REDUCED from 30
  const citationScore = Math.min(totalCitations * 3, 20);

  // Visibility gap impact (0-20 points) - REDUCED from 30
  const visibilityGapScore = Math.min(visibilityGapCitations * 5, 20);

  // Competitive loss impact (0-25 points) - kept same, high priority
  const competitiveLossScore = Math.min(competitiveLossCitations * 10, 25);

  // Reputation issue impact (0-15 points) - NEW
  const reputationScore = Math.min(reputationIssueCitations * 8, 15);

  // Rank gap bonus (0-15 points) - INCREASED from 10
  const rankGapScore = avgRankGap ? Math.min(avgRankGap * 3, 15) : 0;

  // Source authority bonus (0-10 points) - with domain fallback
  const authorityScore = getSourceAuthorityScore(sourceType, domain, classificationConfidence) * 10;

  // Dual LLM citation bonus (5 points if cited by both Gemini and OpenAI)
  const dualLLMBonus = citedByBothLLMs ? 5 : 0;

  const totalScore = citationScore + visibilityGapScore + competitiveLossScore +
                     reputationScore + rankGapScore + authorityScore + dualLLMBonus;

  return Math.min(Math.round(totalScore), 100);
}

/**
 * Calculate impact score for REPUTATION opportunity
 * Based on frequency and sentiment severity
 */
function calculateReputationImpactScore(issue) {
  const { frequency, sentimentScore, sourceCount } = issue;

  // Frequency component (0-35 points) - how often mentioned
  const frequencyScore = Math.min(frequency * 50, 35);

  // Sentiment severity (0-35 points) - how negative
  const sentimentSeverity = Math.abs(sentimentScore);
  const sentimentScoreValue = Math.min(sentimentSeverity * 45, 35);

  // Source backing (0-20 points) - credibility
  const sourceScore = Math.min(sourceCount * 5, 20);

  // Base score for any detected issue (10 points)
  const baseScore = 10;

  const totalScore = baseScore + frequencyScore + sentimentScoreValue + sourceScore;
  return Math.min(Math.round(totalScore), 100);
}

/**
 * Calculate impact score for COMPETITIVE opportunity
 * Based on loss frequency and competitor strength
 */
function calculateCompetitiveImpactScore(competitorData) {
  const { lossCount, winCount, topCompetitorWins, questionsCount } = competitorData;

  // Loss rate component (0-40 points)
  const lossRate = questionsCount > 0 ? lossCount / questionsCount : 0;
  const lossRateScore = Math.min(lossRate * 60, 40);

  // Absolute loss count (0-30 points)
  const lossCountScore = Math.min(lossCount * 5, 30);

  // Top competitor dominance (0-20 points)
  const dominanceScore = topCompetitorWins > 3 ? Math.min(topCompetitorWins * 4, 20) : 0;

  // Base score for any competitive gap (10 points)
  const baseScore = 10;

  const totalScore = baseScore + lossRateScore + lossCountScore + dominanceScore;
  return Math.min(Math.round(totalScore), 100);
}

/**
 * Get impact label from score
 */
function getImpactLabel(score) {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

/**
 * Get priority tier from impact score
 */
function getPriorityTier(impactScore) {
  if (impactScore >= 70) {
    return {
      tier: 'Critical',
      label: 'High-Impact Priority Targets',
      urgency: 1,
      color: 'red'
    };
  } else if (impactScore >= 50) {
    return {
      tier: 'High Priority',
      label: 'Important Outreach Targets',
      urgency: 2,
      color: 'orange'
    };
  } else if (impactScore >= 30) {
    return {
      tier: 'Medium Priority',
      label: 'Secondary Targets',
      urgency: 3,
      color: 'yellow'
    };
  } else {
    return {
      tier: 'Low Priority',
      label: 'Monitor Only',
      urgency: 4,
      color: 'gray'
    };
  }
}

/**
 * Extract ALL visibility gaps from multi-market data
 * ENHANCED: Better detection of competitive losses (when rank > 1, not just null)
 */
function extractAllVisibilityGaps(allAggregated, targetEntity) {
  const gaps = [];

  if (allAggregated && typeof allAggregated === 'object') {
    // Check if it's direct visibility data (single market legacy)
    if (allAggregated.visibility?.not_ranked_first_questions) {
      const notRankedFirst = allAggregated.visibility.not_ranked_first_questions || [];
      notRankedFirst.forEach(q => {
        const gap = extractGapFromQuestion(q, targetEntity, 'default', 'default');
        if (gap) gaps.push(gap);
      });
    }

    // Check for market-based structure
    Object.entries(allAggregated).forEach(([marketCode, marketData]) => {
      if (marketCode === 'visibility' || marketCode === 'competitive' ||
          marketCode === 'reputation' || marketCode === 'competitive_metrics' ||
          marketCode === 'competitive_opportunities') {
        return; // Skip non-market keys
      }

      if (marketData?.categories) {
        Object.entries(marketData.categories).forEach(([categoryId, catData]) => {
          const notRankedFirst = catData?.visibility?.not_ranked_first_questions || [];
          notRankedFirst.forEach(q => {
            const gap = extractGapFromQuestion(q, targetEntity, marketCode, categoryId);
            if (gap) gaps.push(gap);
          });
        });
      }
    });
  }

  return gaps;
}

/**
 * Extract gap data from a single question
 * ENHANCED: Better competitive detection
 */
function extractGapFromQuestion(q, targetEntity, marketCode, categoryId) {
  const llmResponses = q.llm_responses || {};
  const geminiResp = llmResponses.gemini;
  const openaiResp = llmResponses.openai;

  // ENHANCED: Competitive detection - when rank is null AND another entity was chosen
  // OR when a different entity was explicitly chosen over target
  const geminiIsCompetitive = (geminiResp?.rank === null && geminiResp?.chosenEntity) ||
                               (geminiResp?.chosenEntity && !isSameBrandFamily(geminiResp.chosenEntity, targetEntity));
  const openaiIsCompetitive = (openaiResp?.rank === null && openaiResp?.chosenEntity) ||
                               (openaiResp?.chosenEntity && !isSameBrandFamily(openaiResp.chosenEntity, targetEntity));
  const isCompetitive = geminiIsCompetitive || openaiIsCompetitive;

  // Get rank and competitor info
  let currentRank = null;
  let topCompetitor = null;
  let topCompetitorComment = null;
  const sources = [];
  const citedByLLMs = new Set();

  // Process Gemini response
  if (geminiResp) {
    if (!geminiIsCompetitive && geminiResp.rank !== 1) {
      currentRank = geminiResp.target_rank || geminiResp.rank;
      topCompetitor = geminiResp.top_brand;
      topCompetitorComment = geminiResp.top_brand_comment;
    } else if (geminiIsCompetitive) {
      topCompetitor = geminiResp.chosenEntity || geminiResp.top_brand;
      topCompetitorComment = geminiResp.top_brand_comment;
    }
    if (geminiResp.sources) {
      geminiResp.sources.forEach(s => {
        sources.push({
          ...s,
          citedBy: 'gemini',
          classificationConfidence: s.classification_confidence
        });
        citedByLLMs.add('gemini');
      });
    }
  }

  // Process OpenAI response
  if (openaiResp) {
    if (!openaiIsCompetitive && openaiResp.rank !== 1 && !currentRank) {
      currentRank = openaiResp.target_rank || openaiResp.rank;
      if (!topCompetitor) {
        topCompetitor = openaiResp.top_brand;
        topCompetitorComment = openaiResp.top_brand_comment;
      }
    } else if (openaiIsCompetitive && !topCompetitor) {
      topCompetitor = openaiResp.chosenEntity || openaiResp.top_brand;
      topCompetitorComment = openaiResp.top_brand_comment;
    }
    if (openaiResp.sources) {
      openaiResp.sources.forEach(s => {
        sources.push({
          ...s,
          citedBy: 'openai',
          classificationConfidence: s.classification_confidence
        });
        citedByLLMs.add('openai');
      });
    }
  }

  // Filter out same-brand competitors
  if (topCompetitor && isSameBrandFamily(topCompetitor, targetEntity)) {
    topCompetitor = null;
    topCompetitorComment = null;
  }

  // Skip if brand was actually ranked first (or no gap found)
  if (!isCompetitive && (currentRank === 1 || currentRank === null)) {
    return null;
  }

  return {
    question: q.question,
    questionType: isCompetitive ? 'competitive' : 'visibility',
    marketCode,
    categoryId,
    currentRank: isCompetitive ? null : currentRank,
    rankGap: isCompetitive ? 5 : (currentRank - 1), // Competitive losses get gap of 5
    topCompetitor,
    topCompetitorComment,
    sources,
    citedByLLMs: Array.from(citedByLLMs)
  };
}

/**
 * Extract reputation issues from negative topics across ALL markets
 */
function extractAllReputationIssues(allAggregated, targetEntity) {
  const issues = [];
  const seenTopics = new Set();

  // Helper to process reputation data
  const processReputationData = (reputationData, marketCode = 'default') => {
    if (!reputationData?.sentiment_topics?.negative_topics) return;

    reputationData.sentiment_topics.negative_topics.forEach(topic => {
      // Deduplicate by topic name (aggregate across markets)
      const topicKey = topic.topic?.toLowerCase() || '';
      if (seenTopics.has(topicKey)) {
        // Merge with existing
        const existing = issues.find(i => i.topic.toLowerCase() === topicKey);
        if (existing) {
          existing.frequency = Math.max(existing.frequency, topic.frequency || 0.5);
          existing.sentimentScore = Math.min(existing.sentimentScore, topic.sentiment_score || -0.5);
          existing.markets.push(marketCode);
          if (topic.sources) existing.sources.push(...topic.sources);
          if (topic.quotes) existing.quotes.push(...topic.quotes);
        }
        return;
      }

      seenTopics.add(topicKey);
      issues.push({
        topic: topic.topic,
        frequency: topic.frequency || 0.5,
        sentimentScore: topic.sentiment_score || -0.5,
        quotes: topic.quotes || [],
        sources: topic.sources || [],
        markets: [marketCode]
      });
    });
  };

  // Check legacy structure
  if (allAggregated.reputation) {
    processReputationData(allAggregated.reputation, 'global');
  }

  // Check multi-market structure
  Object.entries(allAggregated).forEach(([marketCode, marketData]) => {
    if (marketCode === 'reputation' || marketCode === 'visibility' ||
        marketCode === 'competitive' || marketCode === 'competitive_metrics' ||
        marketCode === 'competitive_opportunities') {
      return;
    }

    if (marketData?.reputation) {
      processReputationData(marketData.reputation, marketCode);
    }
  });

  return issues;
}

/**
 * Extract competitive analysis across ALL markets
 * Returns aggregated competitor performance data
 */
function extractAllCompetitiveData(allAggregated, targetEntity, gaps) {
  const competitorMap = new Map();

  // Process from gaps (competitive losses)
  gaps.filter(g => g.questionType === 'competitive' && g.topCompetitor).forEach(gap => {
    const competitor = gap.topCompetitor;
    if (!competitorMap.has(competitor)) {
      competitorMap.set(competitor, {
        competitor,
        wins: 0,
        losses: 0,
        questions: [],
        markets: new Set(),
        categories: new Set()
      });
    }

    const data = competitorMap.get(competitor);
    data.wins++;
    data.questions.push({
      question: gap.question,
      market: gap.marketCode,
      category: gap.categoryId
    });
    data.markets.add(gap.marketCode);
    data.categories.add(gap.categoryId);
  });

  // Also check competitive_metrics if available
  const processCompetitiveMetrics = (metrics, marketCode = 'default') => {
    if (!metrics?.win_loss_analysis) return;

    Object.entries(metrics.win_loss_analysis).forEach(([competitor, stats]) => {
      if (isSameBrandFamily(competitor, targetEntity)) return;

      if (!competitorMap.has(competitor)) {
        competitorMap.set(competitor, {
          competitor,
          wins: 0,
          losses: 0,
          questions: [],
          markets: new Set(),
          categories: new Set()
        });
      }

      const data = competitorMap.get(competitor);
      data.wins += stats.wins || 0;
      data.losses += stats.losses || 0;
      data.markets.add(marketCode);
    });
  };

  if (allAggregated.competitive_metrics) {
    processCompetitiveMetrics(allAggregated.competitive_metrics, 'global');
  }

  Object.entries(allAggregated).forEach(([marketCode, marketData]) => {
    if (marketData?.categories) {
      Object.entries(marketData.categories).forEach(([categoryId, catData]) => {
        if (catData?.competitive?.metrics) {
          processCompetitiveMetrics(catData.competitive.metrics, marketCode);
        }
      });
    }
  });

  return competitorMap;
}

/**
 * Aggregate sources across ALL visibility gaps and competitive losses
 */
function aggregateSourcesFromGaps(gaps, reputationIssues, targetEntity) {
  const sourceMap = new Map();

  // Process visibility/competitive gaps
  gaps.forEach(gap => {
    gap.sources.forEach(source => {
      const domain = source.domain || extractDomainFromUrl(source.url);
      if (!domain) return;

      if (!sourceMap.has(domain)) {
        const effectiveType = getEffectiveSourceType(
          source.source_type,
          domain,
          source.classificationConfidence
        );
        sourceMap.set(domain, {
          domain,
          sourceType: effectiveType,
          classificationConfidence: source.classificationConfidence,
          totalCitations: 0,
          visibilityGapCitations: 0,
          competitiveLossCitations: 0,
          reputationIssueCitations: 0,
          rankGaps: [],
          questions: [],
          competitors: [],
          citedByLLMs: new Set(),
          urls: new Set(),
          titles: new Set(),
          reputationTopics: []
        });
      }

      const data = sourceMap.get(domain);
      data.totalCitations++;
      data.urls.add(source.url);
      if (source.title) data.titles.add(source.title);
      if (source.citedBy) data.citedByLLMs.add(source.citedBy);

      if (gap.questionType === 'competitive') {
        data.competitiveLossCitations++;
      } else {
        data.visibilityGapCitations++;
        if (gap.rankGap) data.rankGaps.push(gap.rankGap);
      }

      // Track question context
      data.questions.push({
        question: gap.question,
        type: gap.questionType,
        rank: gap.currentRank,
        topCompetitor: gap.topCompetitor,
        market: gap.marketCode,
        category: gap.categoryId
      });

      if (gap.topCompetitor && !data.competitors.includes(gap.topCompetitor)) {
        data.competitors.push(gap.topCompetitor);
      }
    });
  });

  // Process reputation issues
  reputationIssues.forEach(issue => {
    (issue.sources || []).forEach(source => {
      const domain = source.domain || extractDomainFromUrl(source.url);
      if (!domain) return;

      if (!sourceMap.has(domain)) {
        const effectiveType = getEffectiveSourceType(
          source.source_type,
          domain,
          source.classification_confidence
        );
        sourceMap.set(domain, {
          domain,
          sourceType: effectiveType,
          classificationConfidence: source.classification_confidence,
          totalCitations: 0,
          visibilityGapCitations: 0,
          competitiveLossCitations: 0,
          reputationIssueCitations: 0,
          rankGaps: [],
          questions: [],
          competitors: [],
          citedByLLMs: new Set(),
          urls: new Set(),
          titles: new Set(),
          reputationTopics: []
        });
      }

      const data = sourceMap.get(domain);
      data.totalCitations++;
      data.reputationIssueCitations++;
      data.urls.add(source.url);
      if (source.title) data.titles.add(source.title);

      if (!data.reputationTopics.includes(issue.topic)) {
        data.reputationTopics.push(issue.topic);
      }
    });
  });

  return sourceMap;
}

/**
 * Aggregate sources directly from the sources table
 * Used as fallback when visibility gaps aren't available in the expected structure
 */
function aggregateSourcesFromTable(allSources, existingSourceMap) {
  const sourceMap = existingSourceMap || new Map();

  allSources.forEach(source => {
    const domain = source.domain || extractDomainFromUrl(source.url);
    if (!domain) return;

    if (!sourceMap.has(domain)) {
      const effectiveType = getEffectiveSourceType(
        source.source_type,
        domain,
        source.classification_confidence
      );
      sourceMap.set(domain, {
        domain,
        sourceType: effectiveType,
        classificationConfidence: source.classification_confidence,
        totalCitations: 0,
        visibilityGapCitations: 0,
        competitiveLossCitations: 0,
        reputationIssueCitations: 0,
        rankGaps: [],
        questions: [],
        competitors: [],
        citedByLLMs: new Set(),
        urls: new Set(),
        titles: new Set(),
        reputationTopics: []
      });
    }

    const data = sourceMap.get(domain);
    data.totalCitations++;
    data.urls.add(source.url);
    if (source.title) data.titles.add(source.title);

    // Parse cited_by to determine which LLMs cited this source
    if (source.cited_by) {
      try {
        const citedBy = typeof source.cited_by === 'string'
          ? JSON.parse(source.cited_by)
          : source.cited_by;
        if (citedBy.gemini) data.citedByLLMs.add('gemini');
        if (citedBy.openai) data.citedByLLMs.add('openai');
      } catch {
        // Single string format
        data.citedByLLMs.add(source.cited_by);
      }
    }
  });

  return sourceMap;
}

/**
 * Create explicit REPUTATION opportunities (standalone)
 */
function createReputationOpportunities(reputationIssues, targetEntity, startId) {
  const opportunities = [];

  reputationIssues.forEach((issue, index) => {
    const impactScore = calculateReputationImpactScore({
      frequency: issue.frequency,
      sentimentScore: issue.sentimentScore,
      sourceCount: issue.sources?.length || 0
    });

    // Include all reputation issues with meaningful impact
    if (impactScore < 20) return;

    const priority = getPriorityTier(impactScore);

    // Build recommended actions
    const recommendedActions = [];
    if (issue.sentimentScore <= -0.7) {
      recommendedActions.push(`Urgent: Address "${issue.topic}" through executive communications`);
      recommendedActions.push(`Develop crisis response messaging for severe reputation issue`);
    } else if (issue.sentimentScore <= -0.5) {
      recommendedActions.push(`Create content addressing "${issue.topic}" concerns`);
      recommendedActions.push(`Monitor and respond to ${issue.topic} discussions`);
    } else {
      recommendedActions.push(`Proactively communicate improvements related to ${issue.topic}`);
    }
    recommendedActions.push(`Track sentiment changes for "${issue.topic}" over time`);

    opportunities.push({
      id: `REP_${String(startId + index + 1).padStart(3, '0')}`,
      title: `Address "${issue.topic}" reputation issue`,
      description: `Negative sentiment detected with ${Math.round(issue.frequency * 100)}% frequency and ${Math.abs(issue.sentimentScore).toFixed(1)} severity score.`,
      opportunity_type: 'Reputation Issue',
      theme_category: 'Reputation',
      current_state: {
        topic: issue.topic,
        frequency: issue.frequency,
        sentiment_score: issue.sentimentScore,
        source_count: issue.sources?.length || 0,
        markets_affected: issue.markets || ['global']
      },
      scores: {
        impact_score: impactScore / 100,  // Convert to 0-1 scale for frontend
        impact_label: getImpactLabel(impactScore),
        effort_score: 0.5,  // Default medium effort for reputation issues
        effort_label: 'Medium'
      },
      priority,
      recommended_actions: recommendedActions,
      evidence: issue.quotes?.slice(0, 3).map(q => ({ type: 'quote', text: q })) || [],
      sources: issue.sources?.slice(0, 5) || [],
      expected_impact: {
        visibility_increase: Math.round(impactScore * 0.15),  // Up to 15% improvement
        authority_boost: Math.round(impactScore * 0.1),       // Up to 10% improvement
        sentiment_improvement: Math.round(impactScore * 0.25) // Up to 25% improvement (reputation focused)
      },
      metadata: {
        markets: issue.markets || ['global']
      }
    });
  });

  opportunities.sort((a, b) => b.scores.impact_score - a.scores.impact_score);
  return opportunities;
}

/**
 * Create explicit COMPETITIVE opportunities (standalone)
 */
function createCompetitiveOpportunities(competitorMap, gaps, targetEntity, startId) {
  const opportunities = [];

  // Get total competitive questions
  const competitiveGaps = gaps.filter(g => g.questionType === 'competitive');
  const totalCompetitiveQuestions = competitiveGaps.length;

  // Sort competitors by wins (losses for target brand)
  const sortedCompetitors = Array.from(competitorMap.values())
    .sort((a, b) => b.wins - a.wins);

  // Create opportunities for top competitors beating our brand
  sortedCompetitors.forEach((compData, index) => {
    if (compData.wins === 0) return;

    const impactScore = calculateCompetitiveImpactScore({
      lossCount: compData.wins, // Their wins = our losses
      winCount: compData.losses, // Their losses = our wins
      topCompetitorWins: compData.wins,
      questionsCount: totalCompetitiveQuestions
    });

    if (impactScore < 25) return;

    const priority = getPriorityTier(impactScore);

    // Build recommended actions
    const recommendedActions = [
      `Analyze ${compData.competitor}'s messaging and positioning`,
      `Create comparison content highlighting advantages over ${compData.competitor}`,
      `Address specific attributes where ${compData.competitor} is preferred`
    ];

    if (compData.wins >= 5) {
      recommendedActions.unshift(`PRIORITY: Develop counter-positioning strategy vs ${compData.competitor}`);
    }

    opportunities.push({
      id: `COMP_${String(startId + index + 1).padStart(3, '0')}`,
      title: `Counter ${compData.competitor} competitive positioning`,
      description: `${compData.competitor} was chosen over ${targetEntity} in ${compData.wins} competitive question${compData.wins > 1 ? 's' : ''}.`,
      opportunity_type: 'Competitive Positioning Gap',
      theme_category: 'Competitive',
      current_state: {
        competitor: compData.competitor,
        competitor_wins: compData.wins,
        questions_contested: compData.questions.length,
        markets_affected: Array.from(compData.markets),
        categories_affected: Array.from(compData.categories)
      },
      scores: {
        impact_score: impactScore / 100,  // Convert to 0-1 scale for frontend
        impact_label: getImpactLabel(impactScore),
        effort_score: 0.6,  // Medium-high effort for competitive positioning
        effort_label: 'Medium'
      },
      priority,
      recommended_actions: recommendedActions,
      sample_questions: compData.questions.slice(0, 5),
      expected_impact: {
        visibility_increase: Math.round(impactScore * 0.2),   // Up to 20% improvement
        authority_boost: Math.round(impactScore * 0.15),      // Up to 15% improvement
        sentiment_improvement: Math.round(impactScore * 0.1)  // Up to 10% improvement
      },
      metadata: {
        markets: Array.from(compData.markets),
        categories: Array.from(compData.categories)
      }
    });
  });

  opportunities.sort((a, b) => b.scores.impact_score - a.scores.impact_score);
  return opportunities;
}

/**
 * Convert source map to prioritized opportunity list (Source Outreach)
 */
function convertToSourceOpportunities(sourceMap, targetEntity) {
  const opportunities = [];

  sourceMap.forEach((data, domain) => {
    // Calculate derived metrics
    const avgRankGap = data.rankGaps.length > 0
      ? data.rankGaps.reduce((a, b) => a + b, 0) / data.rankGaps.length
      : 0;

    const citedByBothLLMs = data.citedByLLMs.has('gemini') && data.citedByLLMs.has('openai');

    // Calculate impact score with domain fallback
    const impactScore = calculateSourceImpactScore({
      totalCitations: data.totalCitations,
      visibilityGapCitations: data.visibilityGapCitations,
      competitiveLossCitations: data.competitiveLossCitations,
      reputationIssueCitations: data.reputationIssueCitations,
      avgRankGap,
      sourceType: data.sourceType,
      domain: domain,
      classificationConfidence: data.classificationConfidence,
      citedByBothLLMs
    });

    // Filter out low-citation sources (noise reduction)
    if (data.totalCitations < MIN_CITATIONS_THRESHOLD) return;

    // Only include sources with meaningful impact
    if (impactScore < 15) return;

    const priority = getPriorityTier(impactScore);

    // Determine primary opportunity type - use exact names frontend expects
    let opportunityType = 'AI Visibility Gap';  // Default for source outreach
    if (data.competitiveLossCitations > data.visibilityGapCitations) {
      opportunityType = 'Competitive Positioning Gap';
    } else if (data.visibilityGapCitations > 0) {
      opportunityType = 'AI Visibility Gap';
    } else if (data.reputationIssueCitations > 0) {
      opportunityType = 'Reputation Issue';
    }

    // Build description - always show total citations as fallback
    const parts = [];
    if (data.visibilityGapCitations > 0) {
      parts.push(`${data.visibilityGapCitations} visibility gaps`);
    }
    if (data.competitiveLossCitations > 0) {
      parts.push(`${data.competitiveLossCitations} competitive losses`);
    }
    if (data.reputationIssueCitations > 0) {
      parts.push(`${data.reputationIssueCitations} reputation issues`);
    }
    // Fallback if no specific citation types but have total citations
    if (parts.length === 0 && data.totalCitations > 0) {
      parts.push(`${data.totalCitations} AI responses`);
    }
    const description = parts.length > 0
      ? `Source cited in ${parts.join(', ')}. ${citedByBothLLMs ? 'Cited by both Gemini and OpenAI.' : ''}`.trim()
      : `High-authority source with ${data.totalCitations} citations.`;

    // Build recommended actions based on source type
    const recommendedActions = [];
    if (data.sourceType === 'Journalism') {
      recommendedActions.push(`Pitch updated story or correction to ${domain}`);
      recommendedActions.push(`Provide exclusive data/interview to journalist`);
    } else if (data.sourceType === 'Aggregator/Encyclopedic') {
      recommendedActions.push(`Submit updated brand information to ${domain}`);
      recommendedActions.push(`Ensure brand profile is complete and accurate`);
    } else if (data.sourceType === 'Review Sites') {
      recommendedActions.push(`Address negative reviews on ${domain}`);
      recommendedActions.push(`Encourage satisfied customers to leave reviews`);
    } else {
      recommendedActions.push(`Reach out to ${domain} for content update`);
      recommendedActions.push(`Create compelling content for potential link/citation`);
    }

    if (data.competitors.length > 0) {
      recommendedActions.push(`Create comparison content vs ${data.competitors[0]}`);
    }

    // Build sources array from urls and domain data
    const urlList = Array.from(data.urls).slice(0, 10);
    const titleList = Array.from(data.titles);
    const sources = urlList.map((url, i) => ({
      url,
      domain,
      title: titleList[i] || domain,
      source_type: data.sourceType,
      cited_by: Array.from(data.citedByLLMs)
    }));

    opportunities.push({
      id: `SRC_${String(opportunities.length + 1).padStart(3, '0')}`,
      domain,
      title: `Update presence on ${domain}`,
      description,
      opportunity_type: opportunityType,
      theme_category: 'Source Outreach',
      source_type: data.sourceType,
      current_state: {
        total_citations: data.totalCitations,
        visibility_gap_citations: data.visibilityGapCitations,
        competitive_loss_citations: data.competitiveLossCitations,
        reputation_issue_citations: data.reputationIssueCitations,
        avg_rank_gap: Math.round(avgRankGap * 10) / 10,
        cited_by_both_llms: citedByBothLLMs
      },
      scores: {
        impact_score: impactScore / 100,  // Convert to 0-1 scale for frontend
        impact_label: getImpactLabel(impactScore),
        effort_score: 0.4,  // Default low-medium effort for source outreach
        effort_label: 'Low'
      },
      priority,
      competitors_mentioned: data.competitors.slice(0, 5),
      reputation_topics: data.reputationTopics,
      recommended_actions: recommendedActions,
      sources,  // Now properly populated with source objects
      urls: urlList,
      sample_questions: data.questions.slice(0, 5).map(q => ({
        question: q.question,
        type: q.type,
        rank: q.rank,
        top_competitor: q.topCompetitor
      })),
      expected_impact: {
        visibility_increase: Math.round(impactScore * 0.25),  // Up to 25% improvement
        authority_boost: Math.round(impactScore * 0.2),       // Up to 20% improvement
        sentiment_improvement: Math.round(impactScore * 0.1)  // Up to 10% improvement
      },
      metadata: {
        unique_urls: data.urls.size,
        markets_affected: [...new Set(data.questions.map(q => q.market))],
        categories_affected: [...new Set(data.questions.map(q => q.category))]
      }
    });
  });

  // Sort by impact score descending
  opportunities.sort((a, b) => b.scores.impact_score - a.scores.impact_score);

  return opportunities;
}

/**
 * Generate summary statistics
 */
function generateSummary(allOpportunities, gaps, reputationIssues, competitorMap) {
  const priorityCounts = {
    critical: allOpportunities.filter(o => o.priority.tier === 'Critical').length,
    high_priority: allOpportunities.filter(o => o.priority.tier === 'High Priority').length,
    medium_priority: allOpportunities.filter(o => o.priority.tier === 'Medium Priority').length,
    low_priority: allOpportunities.filter(o => o.priority.tier === 'Low Priority').length
  };

  const typeCounts = {
    source_outreach: allOpportunities.filter(o => o.theme_category === 'Source Outreach').length,
    reputation: allOpportunities.filter(o => o.theme_category === 'Reputation').length,
    competitive: allOpportunities.filter(o => o.theme_category === 'Competitive').length
  };

  const sourceTypeCounts = {};
  allOpportunities.filter(o => o.source_type).forEach(o => {
    const type = o.source_type || 'Other';
    sourceTypeCounts[type] = (sourceTypeCounts[type] || 0) + 1;
  });

  const visibilityGaps = gaps.filter(g => g.questionType === 'visibility');
  const competitiveLosses = gaps.filter(g => g.questionType === 'competitive');

  return {
    total_opportunities: allOpportunities.length,
    priority_summary: priorityCounts,
    type_summary: typeCounts,
    source_type_distribution: sourceTypeCounts,
    gap_summary: {
      total_visibility_gaps: visibilityGaps.length,
      total_competitive_losses: competitiveLosses.length,
      total_reputation_issues: reputationIssues.length,
      total_competitors_beating_brand: competitorMap.size,
      avg_rank_gap: visibilityGaps.length > 0
        ? Math.round(visibilityGaps.reduce((sum, g) => sum + (g.rankGap || 0), 0) / visibilityGaps.length * 10) / 10
        : 0
    }
  };
}

/**
 * Main PR Insights aggregation function - V3
 * Enhanced with explicit Reputation and Competitive opportunities
 * @param {Object} aggregatedAnalysis - Full aggregated analysis (can be multi-market)
 * @param {Object} config - Configuration with entity, competitors, etc.
 * @param {Array} allSources - All classified sources from LLM responses (optional)
 * @returns {Object} PR Insights structure
 */
export function aggregatePRInsights(aggregatedAnalysis, config, allSources = []) {
  console.log('[PRInsightsAggregator V3] Starting enhanced aggregation');
  console.log('[PRInsightsAggregator V3] Available keys:', Object.keys(aggregatedAnalysis));

  const targetEntity = config.entity;

  // Step 1: Extract ALL visibility gaps and competitive losses across ALL markets/categories
  const gaps = extractAllVisibilityGaps(aggregatedAnalysis, targetEntity);
  console.log(`[PRInsightsAggregator V3] Extracted ${gaps.length} total gaps`);

  const visibilityGaps = gaps.filter(g => g.questionType === 'visibility');
  const competitiveLosses = gaps.filter(g => g.questionType === 'competitive');
  console.log(`[PRInsightsAggregator V3] ${visibilityGaps.length} visibility gaps, ${competitiveLosses.length} competitive losses`);

  // Step 2: Extract ALL reputation issues across ALL markets
  const reputationIssues = extractAllReputationIssues(aggregatedAnalysis, targetEntity);
  console.log(`[PRInsightsAggregator V3] Extracted ${reputationIssues.length} reputation issues`);

  // Step 3: Extract competitive data
  const competitorMap = extractAllCompetitiveData(aggregatedAnalysis, targetEntity, gaps);
  console.log(`[PRInsightsAggregator V3] Identified ${competitorMap.size} competitors beating brand`);

  // Step 4: Aggregate by source domain
  let sourceMap = aggregateSourcesFromGaps(gaps, reputationIssues, targetEntity);
  console.log(`[PRInsightsAggregator V3] Aggregated ${sourceMap.size} unique source domains from gaps`);

  // Step 4b: If we have allSources but no visibility gaps, aggregate sources directly from the sources table
  // This handles reports where visibility data doesn't have missed_opportunities structure
  if (allSources.length > 0 && gaps.length === 0) {
    console.log(`[PRInsightsAggregator V3] Using ${allSources.length} sources from sources table (no gaps found)`);
    sourceMap = aggregateSourcesFromTable(allSources, sourceMap);
    console.log(`[PRInsightsAggregator V3] After merging: ${sourceMap.size} unique source domains`);
  }

  // Step 5: Create ALL opportunity types
  const reputationOpportunities = createReputationOpportunities(reputationIssues, targetEntity, 0);
  console.log(`[PRInsightsAggregator V3] Created ${reputationOpportunities.length} reputation opportunities`);

  const competitiveOpportunities = createCompetitiveOpportunities(competitorMap, gaps, targetEntity, 0);
  console.log(`[PRInsightsAggregator V3] Created ${competitiveOpportunities.length} competitive opportunities`);

  const sourceOpportunities = convertToSourceOpportunities(sourceMap, targetEntity);
  console.log(`[PRInsightsAggregator V3] Created ${sourceOpportunities.length} source opportunities`);

  // Step 6: Combine all opportunities
  const allOpportunities = [
    ...reputationOpportunities,
    ...competitiveOpportunities,
    ...sourceOpportunities
  ];

  // Re-sort all by impact score
  allOpportunities.sort((a, b) => b.scores.impact_score - a.scores.impact_score);

  // Step 7: Generate summary
  const summary = generateSummary(allOpportunities, gaps, reputationIssues, competitorMap);

  // Handle case where no opportunities found
  if (allOpportunities.length === 0) {
    console.log('[PRInsightsAggregator V3] No opportunities found');
    return {
      analysis_type: 'pr_insights',
      entity: config.entity,
      generated_at: new Date().toISOString(),
      total_opportunities: 0,
      message: 'No significant visibility, competitive, or reputation gaps identified. Current positioning is strong.',
      priority_summary: summary.priority_summary,
      type_summary: summary.type_summary,
      gap_summary: summary.gap_summary,
      opportunities: []
    };
  }

  console.log(`[PRInsightsAggregator V3] Priority distribution: Critical=${summary.priority_summary.critical}, High=${summary.priority_summary.high_priority}, Medium=${summary.priority_summary.medium_priority}, Low=${summary.priority_summary.low_priority}`);
  console.log(`[PRInsightsAggregator V3] Type distribution: Reputation=${summary.type_summary.reputation}, Competitive=${summary.type_summary.competitive}, Source=${summary.type_summary.source_outreach}`);

  return {
    analysis_type: 'pr_insights',
    entity: config.entity,
    generated_at: new Date().toISOString(),
    ...summary,
    opportunities: allOpportunities
  };
}
