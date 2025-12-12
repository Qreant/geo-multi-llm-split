/**
 * PR Insights Aggregator Service - V2
 * Source-centric approach: Aggregates opportunities by source domains
 * Impact-only scoring (no effort scoring)
 * Processes ALL markets and categories
 */

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
 * Calculate source authority score based on source type
 * @param {string} sourceType - The source type classification
 * @returns {number} Authority score (0-1)
 */
function getSourceAuthorityScore(sourceType) {
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
 * Calculate impact score for a source based on its role in visibility gaps
 * @param {Object} sourceData - Aggregated data about the source
 * @returns {number} Impact score (0-100)
 */
function calculateSourceImpactScore(sourceData) {
  const {
    totalCitations,
    visibilityGapCitations,
    competitiveLossCitations,
    avgRankGap,
    sourceType,
    citedByBothLLMs
  } = sourceData;

  // Base score from citation frequency (0-30 points)
  const citationScore = Math.min(totalCitations * 5, 30);

  // Visibility gap impact (0-30 points) - sources cited when brand not ranked first
  const visibilityGapScore = Math.min(visibilityGapCitations * 10, 30);

  // Competitive loss impact (0-25 points) - sources cited when competitor was chosen
  const competitiveLossScore = Math.min(competitiveLossCitations * 12, 25);

  // Rank gap bonus (0-10 points) - higher gaps = higher priority
  const rankGapScore = avgRankGap ? Math.min(avgRankGap * 2, 10) : 0;

  // Source authority bonus (0-10 points)
  const authorityScore = getSourceAuthorityScore(sourceType) * 10;

  // Dual LLM citation bonus (5 points if cited by both Gemini and OpenAI)
  const dualLLMBonus = citedByBothLLMs ? 5 : 0;

  const totalScore = citationScore + visibilityGapScore + competitiveLossScore +
                     rankGapScore + authorityScore + dualLLMBonus;

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
 * @param {Object} allAggregated - All aggregated market data
 * @param {string} targetEntity - The target brand/entity
 * @returns {Array} Array of visibility gap objects with sources
 */
function extractAllVisibilityGaps(allAggregated, targetEntity) {
  const gaps = [];

  // allAggregated structure: { marketCode: { reputation, categories: { catId: { visibility, competitive } } } }
  // OR single market: { visibility: { not_ranked_first_questions }, competitive: {...} }

  // Handle multi-market structure
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
 */
function extractGapFromQuestion(q, targetEntity, marketCode, categoryId) {
  const llmResponses = q.llm_responses || {};
  const geminiResp = llmResponses.gemini;
  const openaiResp = llmResponses.openai;

  // Determine if this is a visibility gap or competitive loss
  const geminiIsCompetitive = geminiResp?.rank === null && geminiResp?.chosenEntity;
  const openaiIsCompetitive = openaiResp?.rank === null && openaiResp?.chosenEntity;
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
        sources.push({ ...s, citedBy: 'gemini' });
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
        sources.push({ ...s, citedBy: 'openai' });
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
 * Extract reputation issues from negative topics
 */
function extractReputationIssues(reputationData, targetEntity) {
  const issues = [];

  if (!reputationData?.sentiment_topics?.negative_topics) {
    return issues;
  }

  const negativeTopics = reputationData.sentiment_topics.negative_topics;

  negativeTopics.forEach(topic => {
    issues.push({
      topic: topic.topic,
      frequency: topic.frequency || 0.5,
      sentimentScore: topic.sentiment_score || -0.5,
      quotes: topic.quotes || [],
      sources: topic.sources || []
    });
  });

  return issues;
}

/**
 * Aggregate sources across ALL visibility gaps and competitive losses
 * This is the core of the source-centric approach
 */
function aggregateSourcesFromGaps(gaps, reputationIssues, targetEntity) {
  const sourceMap = new Map();

  // Process visibility/competitive gaps
  gaps.forEach(gap => {
    gap.sources.forEach(source => {
      const domain = source.domain || extractDomainFromUrl(source.url);
      if (!domain) return;

      if (!sourceMap.has(domain)) {
        sourceMap.set(domain, {
          domain,
          sourceType: source.source_type || 'Other',
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
        sourceMap.set(domain, {
          domain,
          sourceType: source.source_type || 'Other',
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
 * Convert source map to prioritized opportunity list
 */
function convertToOpportunities(sourceMap, targetEntity) {
  const opportunities = [];

  sourceMap.forEach((data, domain) => {
    // Calculate derived metrics
    const avgRankGap = data.rankGaps.length > 0
      ? data.rankGaps.reduce((a, b) => a + b, 0) / data.rankGaps.length
      : 0;

    const citedByBothLLMs = data.citedByLLMs.has('gemini') && data.citedByLLMs.has('openai');

    // Calculate impact score
    const impactScore = calculateSourceImpactScore({
      totalCitations: data.totalCitations,
      visibilityGapCitations: data.visibilityGapCitations,
      competitiveLossCitations: data.competitiveLossCitations,
      avgRankGap,
      sourceType: data.sourceType,
      citedByBothLLMs
    });

    // Only include sources with meaningful impact
    if (impactScore < 15) return;

    const priority = getPriorityTier(impactScore);

    // Determine primary opportunity type
    let opportunityType = 'Source Outreach';
    if (data.competitiveLossCitations > data.visibilityGapCitations) {
      opportunityType = 'Competitive Positioning';
    } else if (data.visibilityGapCitations > 0) {
      opportunityType = 'Visibility Gap';
    } else if (data.reputationIssueCitations > 0) {
      opportunityType = 'Reputation Management';
    }

    // Build description
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
    const description = `Source cited in ${parts.join(', ')}. ${citedByBothLLMs ? 'Cited by both Gemini and OpenAI.' : ''}`;

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
        impact_score: impactScore,
        impact_label: getImpactLabel(impactScore)
      },
      priority,
      competitors_mentioned: data.competitors.slice(0, 5),
      reputation_topics: data.reputationTopics,
      recommended_actions: recommendedActions,
      urls: Array.from(data.urls).slice(0, 10),
      sample_questions: data.questions.slice(0, 5).map(q => ({
        question: q.question,
        type: q.type,
        rank: q.rank,
        top_competitor: q.topCompetitor
      })),
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
function generateSummary(opportunities, gaps, reputationIssues) {
  const priorityCounts = {
    critical: opportunities.filter(o => o.priority.tier === 'Critical').length,
    high_priority: opportunities.filter(o => o.priority.tier === 'High Priority').length,
    medium_priority: opportunities.filter(o => o.priority.tier === 'Medium Priority').length,
    low_priority: opportunities.filter(o => o.priority.tier === 'Low Priority').length
  };

  const sourceTypeCounts = {};
  opportunities.forEach(o => {
    const type = o.source_type || 'Other';
    sourceTypeCounts[type] = (sourceTypeCounts[type] || 0) + 1;
  });

  const visibilityGaps = gaps.filter(g => g.questionType === 'visibility');
  const competitiveLosses = gaps.filter(g => g.questionType === 'competitive');

  return {
    total_opportunities: opportunities.length,
    priority_summary: priorityCounts,
    source_type_distribution: sourceTypeCounts,
    gap_summary: {
      total_visibility_gaps: visibilityGaps.length,
      total_competitive_losses: competitiveLosses.length,
      total_reputation_issues: reputationIssues.length,
      avg_rank_gap: visibilityGaps.length > 0
        ? Math.round(visibilityGaps.reduce((sum, g) => sum + (g.rankGap || 0), 0) / visibilityGaps.length * 10) / 10
        : 0
    }
  };
}

/**
 * Main PR Insights aggregation function - V2
 * Source-centric approach with impact-only scoring
 * @param {Object} aggregatedAnalysis - Full aggregated analysis (can be multi-market)
 * @param {Object} config - Configuration with entity, competitors, etc.
 * @param {Array} allSources - All classified sources from LLM responses (optional)
 * @returns {Object} PR Insights structure
 */
export function aggregatePRInsights(aggregatedAnalysis, config, allSources = []) {
  console.log('[PRInsightsAggregator V2] Starting source-centric aggregation');
  console.log('[PRInsightsAggregator V2] Available keys:', Object.keys(aggregatedAnalysis));

  const targetEntity = config.entity;

  // Step 1: Extract ALL visibility gaps and competitive losses across ALL markets/categories
  const gaps = extractAllVisibilityGaps(aggregatedAnalysis, targetEntity);
  console.log(`[PRInsightsAggregator V2] Extracted ${gaps.length} total gaps`);

  const visibilityGaps = gaps.filter(g => g.questionType === 'visibility');
  const competitiveLosses = gaps.filter(g => g.questionType === 'competitive');
  console.log(`[PRInsightsAggregator V2] ${visibilityGaps.length} visibility gaps, ${competitiveLosses.length} competitive losses`);

  // Step 2: Extract reputation issues
  const reputationIssues = extractReputationIssues(aggregatedAnalysis.reputation, targetEntity);
  console.log(`[PRInsightsAggregator V2] Extracted ${reputationIssues.length} reputation issues`);

  // Step 3: Aggregate by source domain
  const sourceMap = aggregateSourcesFromGaps(gaps, reputationIssues, targetEntity);
  console.log(`[PRInsightsAggregator V2] Aggregated ${sourceMap.size} unique source domains`);

  // Step 4: Convert to prioritized opportunities
  const opportunities = convertToOpportunities(sourceMap, targetEntity);
  console.log(`[PRInsightsAggregator V2] Generated ${opportunities.length} source opportunities`);

  // Step 5: Generate summary
  const summary = generateSummary(opportunities, gaps, reputationIssues);

  // Handle case where no opportunities found
  if (opportunities.length === 0) {
    console.log('[PRInsightsAggregator V2] No opportunities found');
    return {
      analysis_type: 'pr_insights',
      entity: config.entity,
      generated_at: new Date().toISOString(),
      total_opportunities: 0,
      message: 'No significant visibility or competitive gaps identified. Current positioning is strong.',
      priority_summary: summary.priority_summary,
      gap_summary: summary.gap_summary,
      opportunities: []
    };
  }

  console.log(`[PRInsightsAggregator V2] Priority distribution: Critical=${summary.priority_summary.critical}, High=${summary.priority_summary.high_priority}, Medium=${summary.priority_summary.medium_priority}, Low=${summary.priority_summary.low_priority}`);

  return {
    analysis_type: 'pr_insights',
    entity: config.entity,
    generated_at: new Date().toISOString(),
    ...summary,
    opportunities
  };
}
