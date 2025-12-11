/**
 * PR Insights Aggregator Service
 * Ports Google Apps Script V2.18 PR Insights logic to Node.js
 * Generates prioritized improvement opportunities using Impact-Effort Matrix
 */

/**
 * Calculate source quality score based on source authority
 * @param {Array} sources - Array of source objects with source_type
 * @returns {number} Quality score (0-1)
 */
function calculateSourceQuality(sources) {
  if (!sources || sources.length === 0) return 0.3;

  const newsSourceWeight = 0.9; // Journalism, Press Release
  const otherSourceWeight = 0.6;

  let totalWeight = 0;
  sources.forEach(source => {
    const sourceType = source.source_type || '';
    if (sourceType === 'Journalism' || sourceType === 'Press Release' || sourceType === 'Academic/Research') {
      totalWeight += newsSourceWeight;
    } else {
      totalWeight += otherSourceWeight;
    }
  });

  return Math.min(totalWeight / sources.length, 1.0);
}

/**
 * Calculate impact score for an opportunity
 * Formula: frequency(40%) + sentimentGap(30%) + sourceQuality(20%) + competitiveRelevance(10%)
 * @param {Object} data - Opportunity data
 * @returns {number} Impact score (0-1)
 */
function calculateImpactScore(data) {
  const frequency = data.frequency || data.visibility || 0.5;

  let sentimentGap = 0;
  if (data.sentiment_score !== undefined) {
    sentimentGap = Math.abs(data.sentiment_score);
  } else if (data.rank_gap !== undefined) {
    sentimentGap = Math.min(data.rank_gap / 10, 1.0);
  }

  const sourceQuality = calculateSourceQuality(data.sources);
  const competitiveRelevance = data.competitive_choice_percentage || 0.5;

  const impact = (frequency * 0.4) +
                 (sentimentGap * 0.3) +
                 (sourceQuality * 0.2) +
                 (competitiveRelevance * 0.1);

  return Math.min(impact, 1.0);
}

/**
 * Convert impact score to label
 */
function getImpactLabel(score) {
  if (score >= 0.70) return 'High';
  if (score >= 0.40) return 'Medium';
  return 'Low';
}

/**
 * Calculate effort score for an opportunity
 * @param {Object} data - Opportunity data with type and attributes
 * @returns {number} Effort score (0-1)
 */
function calculateEffortScore(data) {
  const type = data.opportunity_type;

  // Reputation opportunities
  if (type === 'reputation') {
    const frequency = data.frequency || 0.5;
    const sourceCount = data.source_count || 3;

    if (frequency >= 0.6 && sourceCount <= 3) return 0.25;
    if (frequency >= 0.6 && sourceCount > 3) return 0.55;
    if (frequency >= 0.3 && frequency < 0.6) return 0.30;
    return 0.25;
  }

  // Visibility opportunities
  if (type === 'visibility') {
    const rank = data.current_rank || 5;
    if (rank === 2) return 0.25;
    if (rank <= 4) return 0.50;
    return 0.75;
  }

  // Competitive opportunities
  if (type === 'competitive') {
    const attribute = (data.attribute || '').toLowerCase();
    if (attribute.includes('feature') || attribute.includes('capability')) return 0.90;
    if (attribute.includes('price') || attribute.includes('cost') || attribute.includes('value')) return 0.60;
    return 0.35;
  }

  // Corporate opportunities
  if (type === 'corporate') {
    const dimension = data.dimension || '';
    if (dimension === 'employer') return 0.95;
    if (dimension === 'dei_social') return 0.65;
    if (dimension === 'leadership') return 0.60;
    return 0.70;
  }

  return 0.50;
}

/**
 * Convert effort score to label
 */
function getEffortLabel(score) {
  if (score < 0.40) return 'Low';
  if (score < 0.70) return 'Medium';
  return 'High';
}

/**
 * Categorize priority using Impact-Effort Matrix
 * @param {number} impactScore - Impact score (0-1)
 * @param {number} effortScore - Effort score (0-1)
 * @returns {Object} Priority object with tier, label, urgency, timeline, color
 */
function categorizePriority(impactScore, effortScore) {
  const highImpact = impactScore >= 0.70;
  const lowEffort = effortScore < 0.40;

  if (highImpact && lowEffort) {
    return {
      tier: 'Critical',
      label: 'Do First - Quick High-Impact Wins',
      urgency: 1,
      timeline: '1-3 months',
      color: 'red'
    };
  } else if (highImpact && !lowEffort) {
    return {
      tier: 'Strategic',
      label: 'Plan Long-term - High-Impact Initiatives',
      urgency: 2,
      timeline: '6-12 months',
      color: 'orange'
    };
  } else if (!highImpact && lowEffort) {
    return {
      tier: 'Quick Wins',
      label: 'Easy Wins - Low-Hanging Fruit',
      urgency: 3,
      timeline: '1-2 months',
      color: 'yellow'
    };
  } else {
    return {
      tier: 'Low Priority',
      label: 'Deprioritize - Low Impact or High Effort',
      urgency: 4,
      timeline: '12+ months or defer',
      color: 'gray'
    };
  }
}

/**
 * Calculate expected impact estimates for an opportunity
 * @param {Object} opportunity - The opportunity object
 * @returns {Object} Expected impact estimates
 */
function calculateExpectedImpact(opportunity) {
  const impactScore = opportunity.scores.impact_score;

  // Visibility Increase: Based on rank gap and competitor positioning
  let visibilityIncrease = 0;
  if (opportunity.opportunity_type === 'AI Visibility Gap') {
    const currentRank = opportunity.current_state?.rank || 5;
    visibilityIncrease = Math.min(0.20, (1 - currentRank/10) * impactScore * 0.15);
  } else if (opportunity.opportunity_type === 'Reputation Issue') {
    visibilityIncrease = impactScore * 0.08;
  } else if (opportunity.opportunity_type === 'Competitive Positioning Gap') {
    visibilityIncrease = impactScore * 0.10;
  }

  // Authority Boost: Based on source quality scores
  const sources = opportunity.sources || [];
  const journalismSources = sources.filter(s => s.source_type === 'Journalism').length;
  const academicSources = sources.filter(s => s.source_type === 'Academic/Research').length;
  const sourceQualityScore = sources.length > 0
    ? (journalismSources * 0.9 + academicSources * 0.95) / sources.length
    : 0.3;
  const authorityBoost = sourceQualityScore * impactScore * 0.12;

  // Sentiment Improvement: Based on current sentiment gaps
  let sentimentImprovement = 0;
  if (opportunity.current_state?.sentiment_score !== undefined) {
    const sentimentGap = Math.abs(opportunity.current_state.sentiment_score);
    sentimentImprovement = sentimentGap * impactScore * 0.20;
  } else if (opportunity.current_state?.frequency) {
    sentimentImprovement = opportunity.current_state.frequency * impactScore * 0.15;
  }

  return {
    visibility_increase: Math.round(visibilityIncrease * 1000) / 10,
    authority_boost: Math.round(authorityBoost * 1000) / 10,
    sentiment_improvement: Math.round(sentimentImprovement * 1000) / 10
  };
}

/**
 * Extract reputation improvement opportunities from negative sentiment topics
 */
function extractReputationOpportunities(reputationAnalysis, config) {
  const opportunities = [];

  if (!reputationAnalysis || !reputationAnalysis.sentiment_topics) {
    return opportunities;
  }

  const negativeTopics = reputationAnalysis.sentiment_topics.negative_topics || [];

  negativeTopics.forEach((topic, index) => {
    const sources = topic.sources || [];
    const frequency = topic.frequency || 0.5;
    const sentimentScore = topic.sentiment_score || -0.5;

    const impactScore = calculateImpactScore({
      frequency: frequency,
      sentiment_score: sentimentScore,
      sources: sources,
      competitive_choice_percentage: 0.5
    });

    const effortScore = calculateEffortScore({
      opportunity_type: 'reputation',
      frequency: frequency,
      source_count: sources.length
    });

    const priority = categorizePriority(impactScore, effortScore);

    const freqPercent = Math.round(frequency * 100);
    const description = `Frequently mentioned negative topic (${freqPercent}% of responses) with sentiment score ${sentimentScore.toFixed(2)}.`;

    const quotes = topic.quotes || [];
    const evidence = quotes.slice(0, 2).map((quote, i) => ({
      type: 'quote',
      text: typeof quote === 'string' ? quote : quote.text || '',
      source_title: sources[i]?.title || 'Source',
      source_url: sources[i]?.url || null
    }));

    const recommendedActions = [];
    if (frequency >= 0.6 && sources.length <= 3) {
      recommendedActions.push('Update content and messaging to directly address this concern');
      recommendedActions.push('Create FAQ or explainer content about this topic');
      recommendedActions.push('Monitor sentiment changes after content updates');
    } else if (frequency >= 0.6) {
      recommendedActions.push('Launch comprehensive transparency initiative (blog series, white paper)');
      recommendedActions.push('Engage directly with key critics to understand specific issues');
      recommendedActions.push('Develop long-term narrative shift strategy with PR team');
    } else {
      recommendedActions.push('Create targeted content addressing this specific concern');
      recommendedActions.push('Pitch corrective stories to relevant publications');
      recommendedActions.push('Monitor for escalation and adjust strategy as needed');
    }

    const opp = {
      id: `REP_${String(index + 1).padStart(3, '0')}`,
      title: `Address '${topic.topic}' reputation issue`,
      description: description,
      opportunity_type: 'Reputation Issue',
      theme_category: 'Reputation Management',
      current_state: {
        metric: `Negative mentions: ${freqPercent}% frequency`,
        frequency: frequency,
        sentiment_score: sentimentScore
      },
      scores: {
        impact_score: impactScore,
        impact_label: getImpactLabel(impactScore),
        effort_score: effortScore,
        effort_label: getEffortLabel(effortScore)
      },
      priority: priority,
      recommended_actions: recommendedActions,
      evidence: evidence,
      sources: sources.map(source => ({
        url: source.url || '',
        domain: source.domain || '',
        title: source.title || '',
        source_type: source.source_type || 'Unknown',
        cited_by: source.cited_by || []
      })),
      metadata: {
        source_question_id: null,
        frequency: frequency,
        sentiment_score: sentimentScore,
        key_phrases: quotes.slice(0, 3).map(q => typeof q === 'string' ? q : q.text || '')
      }
    };

    // Add expected impact
    const expectedImpact = calculateExpectedImpact(opp);
    opp.expected_visibility_increase = expectedImpact.visibility_increase;
    opp.expected_authority_boost = expectedImpact.authority_boost;
    opp.expected_sentiment_improvement = expectedImpact.sentiment_improvement;

    opportunities.push(opp);
  });

  return opportunities;
}

/**
 * Extract visibility improvement opportunities from missed rankings
 * Uses not_ranked_first_questions from visibilityAggregator output
 */
function extractVisibilityOpportunities(visibilityAnalysis, config) {
  const opportunities = [];

  if (!visibilityAnalysis) {
    console.log('[PRInsightsAggregator] No visibility analysis data');
    return opportunities;
  }

  // Map from visibilityAggregator output format: not_ranked_first_questions
  const notRankedFirst = visibilityAnalysis.not_ranked_first_questions || [];
  console.log(`[PRInsightsAggregator] Found ${notRankedFirst.length} not-ranked-first questions`);

  if (notRankedFirst.length === 0) {
    return opportunities;
  }

  // Convert not_ranked_first_questions to missed opportunities format
  const missedOpps = notRankedFirst.map(q => {
    // Get the first LLM response that had the brand not ranked first
    const llmResponses = q.llm_responses || {};
    const geminiResp = llmResponses.gemini;
    const openaiResp = llmResponses.openai;

    // Find the rank from whichever LLM didn't rank the brand first
    let currentRank = 5; // default
    let topRankedEntity = 'Competitor';
    let topRankedComment = '';
    let topSources = [];
    // Track if this is a competitive "choice" question (where competitor was chosen)
    // vs a visibility ranking question (where brand was ranked but not #1)
    let isCompetitive = false;

    // Check Gemini response first
    if (geminiResp && geminiResp.rank !== 1) {
      currentRank = geminiResp.target_rank || geminiResp.rank || 5;
      topRankedEntity = geminiResp.top_brand || 'Competitor';
      topRankedComment = geminiResp.top_brand_comment || geminiResp.rawResponse || '';
      topSources = geminiResp.sources || [];
      // Competitive questions have rank === null and chosenEntity set
      isCompetitive = geminiResp.rank === null && geminiResp.chosenEntity;
    } else if (openaiResp && openaiResp.rank !== 1) {
      currentRank = openaiResp.target_rank || openaiResp.rank || 5;
      topRankedEntity = openaiResp.top_brand || 'Competitor';
      topRankedComment = openaiResp.top_brand_comment || openaiResp.rawResponse || '';
      topSources = openaiResp.sources || [];
      // Competitive questions have rank === null and chosenEntity set
      isCompetitive = openaiResp.rank === null && openaiResp.chosenEntity;
    }

    return {
      question_text: q.question,
      current_rank: typeof currentRank === 'number' ? currentRank : 5,
      top_ranked_entity: topRankedEntity,
      top_ranked_comment: topRankedComment,
      why_missed: topRankedComment,
      top_sources: topSources,
      is_competitive: isCompetitive
    };
  });

  const competitiveCount = missedOpps.filter(o => o.is_competitive).length;
  const visibilityCount = missedOpps.length - competitiveCount;
  console.log(`[PRInsightsAggregator] Converted to ${missedOpps.length} opportunities (${visibilityCount} visibility, ${competitiveCount} competitive)`);
  // brand_visibility is nested under visibility object from visibilityAggregator
  const brandVisibility = visibilityAnalysis.visibility?.visibility || 0.5;

  // Track indices separately for VIS and COMP opportunities
  let visIndex = 0;
  let compIndex = 0;

  missedOpps.forEach((opp) => {
    const currentRank = opp.current_rank || 5;
    const rankGap = currentRank - 1;
    const sources = opp.top_sources || [];
    const isCompetitive = opp.is_competitive || false;

    const impactScore = calculateImpactScore({
      frequency: brandVisibility,
      rank_gap: isCompetitive ? 5 : rankGap, // Competitive losses have higher impact
      sources: sources,
      competitive_choice_percentage: isCompetitive ? 0.7 : 0.5
    });

    const effortScore = calculateEffortScore({
      opportunity_type: isCompetitive ? 'competitive' : 'visibility',
      current_rank: currentRank
    });

    const priority = categorizePriority(impactScore, effortScore);

    const topRankedEntity = opp.top_ranked_entity || 'Competitor';
    const topRankedComment = opp.top_ranked_comment || 'Better positioning and messaging';

    // Different descriptions for competitive vs visibility
    const description = isCompetitive
      ? `Lost competitive comparison. ${topRankedEntity} chosen due to: ${topRankedComment}`
      : `Currently ranked #${currentRank}. ${topRankedEntity} ranks #1 due to: ${topRankedComment}`;

    const winningAttributes = [];
    const comment = topRankedComment.toLowerCase();
    if (comment.includes('feature')) winningAttributes.push('product features');
    if (comment.includes('price') || comment.includes('cost') || comment.includes('value') || comment.includes('afford')) winningAttributes.push('pricing');
    if (comment.includes('support') || comment.includes('service')) winningAttributes.push('customer support');
    if (comment.includes('comfort') || comment.includes('quality')) winningAttributes.push('product quality');
    if (comment.includes('reliab') || comment.includes('durabl')) winningAttributes.push('reliability');
    if (winningAttributes.length === 0) winningAttributes.push('overall positioning');

    const recommendedActions = [];
    if (isCompetitive) {
      // Competitive-specific actions
      recommendedActions.push(`Develop messaging emphasizing ${winningAttributes[0] || 'competitive advantages'}`);
      recommendedActions.push(`Create comparison content: '${config.entity} vs ${topRankedEntity}'`);
      recommendedActions.push('Engage with key publications to update brand positioning');
    } else if (currentRank === 2) {
      recommendedActions.push(`Update messaging to emphasize ${winningAttributes[0] || 'key differentiators'}`);
      recommendedActions.push(`Create comparison content highlighting advantages over ${topRankedEntity}`);
      recommendedActions.push('Engage with top sources to update brand information');
    } else if (currentRank <= 4) {
      recommendedActions.push(`Enhance content strategy around ${winningAttributes[0] || 'competitive advantages'}`);
      recommendedActions.push('Develop thought leadership content for key publications');
      recommendedActions.push('Optimize brand positioning for AI search visibility');
    } else {
      recommendedActions.push(`Major positioning shift needed to compete with ${topRankedEntity}`);
      recommendedActions.push('Conduct comprehensive competitive messaging audit');
      recommendedActions.push('Develop long-term content strategy with PR and marketing teams');
    }

    // Use different ID prefix and increment appropriate counter
    const oppId = isCompetitive
      ? `COMP_${String(++compIndex).padStart(3, '0')}`
      : `VIS_${String(++visIndex).padStart(3, '0')}`;

    const oppObj = {
      id: oppId,
      title: isCompetitive
        ? `Win back '${opp.question_text || 'key comparison'}' against ${topRankedEntity}`
        : `Improve ranking for '${opp.question_text || 'key query'}'`,
      description: description,
      opportunity_type: isCompetitive ? 'Competitive Positioning Gap' : 'AI Visibility Gap',
      theme_category: isCompetitive ? 'Competitive Positioning' : 'AI Search Visibility',
      current_state: isCompetitive ? {
        metric: `Lost to ${topRankedEntity}`,
        competitor_chosen: topRankedEntity,
        choice_percentage: 0.7
      } : {
        metric: `Ranked #${currentRank}`,
        rank: currentRank,
        gap_from_first: rankGap
      },
      competitor_analysis: {
        top_ranked_entity: topRankedEntity,
        winning_attributes: winningAttributes,
        why_they_win: topRankedComment
      },
      scores: {
        impact_score: impactScore,
        impact_label: getImpactLabel(impactScore),
        effort_score: effortScore,
        effort_label: getEffortLabel(effortScore)
      },
      priority: priority,
      recommended_actions: recommendedActions,
      evidence: [{
        type: 'explanation',
        text: opp.why_missed || topRankedComment,
        source_title: 'Competitive Analysis',
        source_url: null
      }],
      sources: sources.map(source => ({
        url: source.url || '',
        domain: source.domain || '',
        title: source.title || '',
        source_type: source.source_type || 'Unknown',
        cited_by: source.cited_by || []
      })),
      metadata: {
        source_question_id: opp.question_id || null,
        visibility_percentage: brandVisibility
      }
    };

    const expectedImpact = calculateExpectedImpact(oppObj);
    oppObj.expected_visibility_increase = expectedImpact.visibility_increase;
    oppObj.expected_authority_boost = expectedImpact.authority_boost;
    oppObj.expected_sentiment_improvement = expectedImpact.sentiment_improvement;

    opportunities.push(oppObj);
  });

  return opportunities;
}

/**
 * Extract competitive positioning opportunities from missed comparisons (actual losses)
 * Note: Pros/cons extraction removed - will be handled separately
 */
function extractCompetitiveOpportunities(metricsAnalysis, opportunitiesAnalysis, config) {
  const opportunities = [];

  // Extract from missed competitive opportunities
  if (opportunitiesAnalysis?.missed_opportunities) {
    const missedOpps = opportunitiesAnalysis.missed_opportunities.opportunities || [];

    missedOpps.forEach((opp, index) => {
      const competitorChosen = opp.competitor_chosen || 'Competitor';
      const choicePercentage = opp.competitive_choice_percentage || 0.6;
      const sources = opp.top_sources || [];

      const impactScore = calculateImpactScore({
        frequency: 0.5,
        sentiment_score: -0.5,
        sources: sources,
        competitive_choice_percentage: choicePercentage
      });

      const whyChosen = opp.why_chosen_explanation || '';
      const effortScore = calculateEffortScore({
        opportunity_type: 'competitive',
        attribute: whyChosen
      });

      const priority = categorizePriority(impactScore, effortScore);
      const description = `Lost competitive comparison. ${competitorChosen} chosen due to: ${whyChosen}`;

      const winningAttributes = [];
      const attribute = whyChosen.toLowerCase();
      if (attribute.includes('feature')) winningAttributes.push('product features');
      if (attribute.includes('price') || attribute.includes('cost')) winningAttributes.push('pricing');
      if (attribute.includes('integration')) winningAttributes.push('integrations');
      if (winningAttributes.length === 0) winningAttributes.push('overall positioning');

      const recommendedActions = [];
      if (attribute.includes('feature') || attribute.includes('capability')) {
        recommendedActions.push('Assess product roadmap to address feature gap');
        recommendedActions.push('Communicate existing capabilities more effectively');
        recommendedActions.push('Consider partnership or development to close gap');
      } else if (attribute.includes('price') || attribute.includes('cost')) {
        recommendedActions.push('Review pricing strategy and value communication');
        recommendedActions.push('Develop messaging around ROI and total cost of ownership');
        recommendedActions.push('Create comparison content highlighting value advantages');
      } else {
        recommendedActions.push(`Develop messaging emphasizing ${winningAttributes[0] || 'competitive advantages'}`);
        recommendedActions.push(`Create comparison content: '${config.entity} vs ${competitorChosen}'`);
        recommendedActions.push('Engage with key publications to update brand positioning');
      }

      const oppObj = {
        id: `COMP_${String(opportunities.length + 1).padStart(3, '0')}`,
        title: `Win back '${opp.question_text || 'key comparison'}' against ${competitorChosen}`,
        description: description,
        opportunity_type: 'Competitive Positioning Gap',
        theme_category: 'Competitive Positioning',
        current_state: {
          metric: `Lost to ${competitorChosen}`,
          competitor_chosen: competitorChosen,
          choice_percentage: choicePercentage
        },
        competitor_analysis: {
          top_ranked_entity: competitorChosen,
          winning_attributes: winningAttributes,
          why_they_win: whyChosen
        },
        scores: {
          impact_score: impactScore,
          impact_label: getImpactLabel(impactScore),
          effort_score: effortScore,
          effort_label: getEffortLabel(effortScore)
        },
        priority: priority,
        recommended_actions: recommendedActions,
        evidence: [{
          type: 'explanation',
          text: whyChosen,
          source_title: 'Competitive Analysis',
          source_url: null
        }],
        sources: sources.map(source => ({
          url: source.url || '',
          domain: source.domain || '',
          title: source.title || '',
          source_type: source.source_type || 'Unknown',
          cited_by: source.cited_by || []
        })),
        metadata: {
          source_question_id: opp.question_id || null,
          competitors_compared: opp.competitors_compared || [],
          choice_percentage: choicePercentage
        }
      };

      const expectedImpact = calculateExpectedImpact(oppObj);
      oppObj.expected_visibility_increase = expectedImpact.visibility_increase;
      oppObj.expected_authority_boost = expectedImpact.authority_boost;
      oppObj.expected_sentiment_improvement = expectedImpact.sentiment_improvement;

      opportunities.push(oppObj);
    });
  }

  // NOTE: Pros/cons extraction removed - will be handled separately
  // Competitive losses are now only from won_opportunities.missed (actual competitor wins)

  return opportunities;
}

/**
 * Analyze sources across ALL LLM responses to identify priority PR targets
 * Sources-first approach: prioritizes domains by their impact on reputation, visibility, and competitive positioning
 * @param {Array} opportunities - All identified opportunities
 * @param {Array} allSources - All classified sources from LLM responses
 * @param {Object} config - Configuration with entity, competitors
 * @param {Object} aggregatedAnalysis - Full analysis data for reputation tracking
 * @returns {Object} Priority source targets analysis
 */
function analyzePrioritySourceTargets(opportunities, allSources, config, aggregatedAnalysis = {}) {
  const domainMap = new Map();
  const urlMap = new Map();

  // Step 1: Initialize with ALL sources cited by LLMs (base citation frequency)
  console.log(`[SourceTargets] Processing ${allSources?.length || 0} total sources`);

  (allSources || []).forEach(source => {
    const url = source.url || '';
    const domain = source.domain || extractDomainFromUrl(url);
    const sourceType = source.source_type || source.sourceType || 'Unknown';
    const title = source.title || '';
    const citedBy = source.cited_by || source.citedBy || [];

    if (!url && !domain) return;

    // Track domain-level data
    if (domain) {
      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          domain: domain,
          source_type: sourceType,
          citation_count: 0,           // How many times cited overall
          cited_by_llms: new Set(),    // Which LLMs cite it
          llm_citations: { gemini: 0, openai: 0 }, // LLM breakdown
          urls: new Set(),
          opportunity_count: 0,        // How many opportunities reference it
          opportunity_ids: [],
          opportunity_types: new Set(),
          priority_tiers: new Set(),
          // Impact breakdown scores
          reputation_impact_count: 0,  // Times cited in negative reputation topics
          visibility_gap_count: 0,     // Times cited where brand not ranked well
          competitive_loss_count: 0,   // Times cited where competitor was chosen
          // Detailed opportunity tracking
          visibility_gap_questions: [],    // Questions where brand wasn't ranked first
          competitive_loss_questions: [],  // Questions where competitor was chosen
          // Breakdown scores (0-1)
          scores: {
            reputation_impact: 0,
            visibility_gap: 0,
            competitive_loss: 0,
            source_authority: 0
          },
          total_impact_score: 0,
          is_high_authority: ['Journalism', 'Academic/Research', 'Government/NGO'].includes(sourceType),
          competitor_mentions: [],
          negative_topics: []          // Reputation topics from this domain
        });
      }
      const domainData = domainMap.get(domain);
      domainData.citation_count++;
      if (url) domainData.urls.add(url);
      citedBy.forEach(llm => {
        domainData.cited_by_llms.add(llm);
        // Track LLM-specific citation counts
        if (llm === 'gemini') domainData.llm_citations.gemini++;
        else if (llm === 'openai') domainData.llm_citations.openai++;
      });
    }

    // Track URL-level data
    if (url) {
      if (!urlMap.has(url)) {
        urlMap.set(url, {
          url: url,
          domain: domain,
          title: title,
          source_type: sourceType,
          citation_count: 0,
          cited_by_llms: new Set(),
          llm_citations: { gemini: 0, openai: 0 },
          opportunity_count: 0,
          opportunity_ids: [],
          opportunity_types: new Set(),
          priority_tiers: new Set(),
          reputation_impact_count: 0,
          visibility_gap_count: 0,
          competitive_loss_count: 0,
          total_impact_score: 0,
          is_high_authority: ['Journalism', 'Academic/Research', 'Government/NGO'].includes(sourceType),
          competitor_mentions: []
        });
      }
      const urlData = urlMap.get(url);
      urlData.citation_count++;
      citedBy.forEach(llm => {
        urlData.cited_by_llms.add(llm);
        if (llm === 'gemini') urlData.llm_citations.gemini++;
        else if (llm === 'openai') urlData.llm_citations.openai++;
      });
    }
  });

  // Step 1.5: Track reputation impact - domains cited in negative topics
  if (aggregatedAnalysis.reputation?.sentiment_topics?.negative_topics) {
    const negativeTopics = aggregatedAnalysis.reputation.sentiment_topics.negative_topics;
    negativeTopics.forEach(topic => {
      const sources = topic.sources || [];
      sources.forEach(source => {
        const domain = source.domain || extractDomainFromUrl(source.url);
        if (domain && domainMap.has(domain)) {
          const domainData = domainMap.get(domain);
          domainData.reputation_impact_count++;
          if (!domainData.negative_topics.includes(topic.topic)) {
            domainData.negative_topics.push(topic.topic);
          }
        }
      });
    });
  }

  // Step 2: Cross-reference with opportunities to identify problem areas
  opportunities.forEach(opp => {
    const sources = opp.sources || [];
    const oppType = opp.opportunity_type;
    const oppId = opp.id;
    const priority = opp.priority?.tier || 'Low Priority';
    const impactScore = opp.scores?.impact_score || 0;
    const isVisibilityGap = oppType === 'AI Visibility Gap';
    const isCompetitiveLoss = oppType === 'Competitive Positioning Gap';

    // Extract question details for tracking
    const questionTitle = opp.title || '';
    const questionText = questionTitle.replace(/^(Improve ranking for |Win back |Address )['"]?/, '').replace(/['"]?( against .*)?$/, '');
    const currentRank = opp.current_state?.rank;
    const topCompetitor = opp.competitor_analysis?.top_ranked_entity;
    const whyTheyWin = opp.competitor_analysis?.why_they_win;

    // Track domains that have been updated for this opportunity (to avoid double-counting)
    const updatedDomains = new Set();

    sources.forEach(source => {
      const url = source.url || '';
      const domain = source.domain || extractDomainFromUrl(url);

      // Update domain data with opportunity info
      if (domain && domainMap.has(domain)) {
        const domainData = domainMap.get(domain);
        domainData.opportunity_count++;
        domainData.opportunity_ids.push(oppId);
        domainData.opportunity_types.add(oppType);
        domainData.priority_tiers.add(priority);
        domainData.total_impact_score += impactScore;
        updatedDomains.add(domain);

        // Track visibility gaps with question details
        if (isVisibilityGap) {
          domainData.visibility_gap_count++;
          // Only add if not already tracked (avoid duplicates)
          const existingQ = domainData.visibility_gap_questions.find(q => q.id === oppId);
          if (!existingQ) {
            domainData.visibility_gap_questions.push({
              id: oppId,
              question: questionText,
              current_rank: currentRank,
              top_competitor: topCompetitor,
              why_they_win: whyTheyWin
            });
          }
        }

        // Track competitive losses with question details
        if (isCompetitiveLoss) {
          domainData.competitive_loss_count++;
          const competitorChosen = opp.current_state?.competitor_chosen || topCompetitor;
          const existingQ = domainData.competitive_loss_questions.find(q => q.id === oppId);
          if (!existingQ) {
            domainData.competitive_loss_questions.push({
              id: oppId,
              question: questionText,
              competitor_chosen: competitorChosen,
              why_chosen: whyTheyWin || opp.description
            });
          }
          // Also track competitor from competitive losses
          if (competitorChosen) {
            domainData.competitor_mentions.push(competitorChosen);
          }
        }

        if (topCompetitor && !isCompetitiveLoss) {
          domainData.competitor_mentions.push(topCompetitor);
        }
      }

      // Update URL data with opportunity info
      if (url && urlMap.has(url)) {
        const urlData = urlMap.get(url);
        urlData.opportunity_count++;
        urlData.opportunity_ids.push(oppId);
        urlData.opportunity_types.add(oppType);
        urlData.priority_tiers.add(priority);
        urlData.total_impact_score += impactScore;

        if (isVisibilityGap) urlData.visibility_gap_count++;
        if (isCompetitiveLoss) {
          urlData.competitive_loss_count++;
          // Track competitor from competitive losses
          const competitorChosen = opp.current_state?.competitor_chosen || opp.competitor_analysis?.top_ranked_entity;
          if (competitorChosen) {
            urlData.competitor_mentions.push(competitorChosen);
          }
        }

        if (opp.competitor_analysis?.top_ranked_entity && !isCompetitiveLoss) {
          urlData.competitor_mentions.push(opp.competitor_analysis.top_ranked_entity);
        }
      }
    });

  });

  // Step 3: Calculate priority score with new formula
  // Priority = Reputation Impact (35%) + Visibility Gap (30%) + Competitive Loss (25%) + Source Authority (10%)
  const maxCitations = Math.max(...Array.from(domainMap.values()).map(d => d.citation_count), 1);
  const maxReputationImpact = Math.max(...Array.from(domainMap.values()).map(d => d.reputation_impact_count), 1);
  const maxVisibilityGap = Math.max(...Array.from(domainMap.values()).map(d => d.visibility_gap_count), 1);
  const maxCompetitiveLoss = Math.max(...Array.from(domainMap.values()).map(d => d.competitive_loss_count), 1);

  const calculatePriorityScore = (data) => {
    // Calculate normalized breakdown scores (0-1)
    const reputationScore = maxReputationImpact > 0
      ? data.reputation_impact_count / maxReputationImpact
      : 0;
    const visibilityGapScore = maxVisibilityGap > 0
      ? data.visibility_gap_count / maxVisibilityGap
      : 0;
    const competitiveLossScore = maxCompetitiveLoss > 0
      ? data.competitive_loss_count / maxCompetitiveLoss
      : 0;

    // Source authority score based on type
    let authorityScore = 0.3; // default
    if (data.source_type === 'Journalism') authorityScore = 0.9;
    else if (data.source_type === 'Academic/Research') authorityScore = 0.85;
    else if (data.source_type === 'Government/NGO') authorityScore = 0.8;
    else if (data.source_type === 'Press Release') authorityScore = 0.6;
    else if (data.source_type === 'Aggregator/Encyclopedic') authorityScore = 0.5;
    else if (data.source_type === 'Review Sites') authorityScore = 0.55;

    // Store breakdown scores in data object
    data.scores = {
      reputation_impact: Math.round(reputationScore * 100) / 100,
      visibility_gap: Math.round(visibilityGapScore * 100) / 100,
      competitive_loss: Math.round(competitiveLossScore * 100) / 100,
      source_authority: Math.round(authorityScore * 100) / 100
    };

    // Weighted priority score: Rep(35%) + Vis(30%) + Comp(25%) + Auth(10%)
    const weightedScore = (reputationScore * 0.35) +
                          (visibilityGapScore * 0.30) +
                          (competitiveLossScore * 0.25) +
                          (authorityScore * 0.10);

    // Convert to 0-100 scale
    return Math.round(weightedScore * 100);
  };

  // Convert to arrays and calculate priority scores
  const domainTargets = Array.from(domainMap.values()).map(d => ({
    ...d,
    cited_by_llms: Array.from(d.cited_by_llms),
    opportunity_types: Array.from(d.opportunity_types),
    priority_tiers: Array.from(d.priority_tiers),
    urls: Array.from(d.urls),
    url_count: d.urls.size,
    priority_score: calculatePriorityScore(d),
    avg_impact_score: d.opportunity_count > 0 ? d.total_impact_score / d.opportunity_count : 0,
    top_competitor: getTopCompetitor(d.competitor_mentions),
    brand_problem_count: d.visibility_gap_count + d.competitive_loss_count
  }));

  const urlTargets = Array.from(urlMap.values()).map(u => ({
    ...u,
    cited_by_llms: Array.from(u.cited_by_llms),
    opportunity_types: Array.from(u.opportunity_types),
    priority_tiers: Array.from(u.priority_tiers),
    priority_score: calculatePriorityScore(u),
    avg_impact_score: u.opportunity_count > 0 ? u.total_impact_score / u.opportunity_count : 0,
    top_competitor: getTopCompetitor(u.competitor_mentions),
    brand_problem_count: u.visibility_gap_count + u.competitive_loss_count
  }));

  // Sort by priority score
  domainTargets.sort((a, b) => b.priority_score - a.priority_score);
  urlTargets.sort((a, b) => b.priority_score - a.priority_score);

  // Categorize domains by priority level
  const criticalDomains = domainTargets.filter(d => d.priority_score >= 70);
  const highPriorityDomains = domainTargets.filter(d => d.priority_score >= 50 && d.priority_score < 70);
  const mediumPriorityDomains = domainTargets.filter(d => d.priority_score >= 30 && d.priority_score < 50);

  // Identify high-authority sources specifically
  const highAuthorityTargets = domainTargets.filter(d => d.is_high_authority).sort((a, b) => b.priority_score - a.priority_score);

  // Summary statistics
  const summary = {
    total_domains: domainTargets.length,
    total_urls: urlTargets.length,
    total_citations: allSources?.length || 0,
    critical_targets: criticalDomains.length,
    high_priority_targets: highPriorityDomains.length,
    high_authority_targets: highAuthorityTargets.length,
    multi_opportunity_domains: domainTargets.filter(d => d.opportunity_count >= 2).length,
    reputation_impact_domains: domainTargets.filter(d => d.reputation_impact_count > 0).length,
    visibility_gap_domains: domainTargets.filter(d => d.visibility_gap_count > 0).length,
    competitive_loss_domains: domainTargets.filter(d => d.competitive_loss_count > 0).length
  };

  console.log(`[SourceTargets] Analysis complete: ${summary.total_domains} domains, ${summary.critical_targets} critical, ${summary.visibility_gap_domains} with visibility gaps`);

  return {
    summary: summary,
    domain_targets: {
      critical: criticalDomains.slice(0, 10),
      high_priority: highPriorityDomains.slice(0, 10),
      medium_priority: mediumPriorityDomains.slice(0, 10),
      all: domainTargets
    },
    url_targets: {
      top_priority: urlTargets.filter(u => u.citation_count >= 2 || u.priority_score >= 50).slice(0, 20),
      all: urlTargets
    },
    high_authority_targets: highAuthorityTargets.slice(0, 15),
    outreach_recommendations: generateOutreachRecommendations(criticalDomains, highPriorityDomains, config)
  };
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
 * Get top competitor from mentions array
 */
function getTopCompetitor(mentions) {
  if (!mentions || mentions.length === 0) return null;

  const counts = {};
  mentions.forEach(m => {
    counts[m] = (counts[m] || 0) + 1;
  });

  let top = null;
  let maxCount = 0;
  Object.entries(counts).forEach(([competitor, count]) => {
    if (count > maxCount) {
      maxCount = count;
      top = competitor;
    }
  });

  return top;
}

/**
 * Extract Owned Media Gap opportunities
 * Analyzes visibility and competitive questions to identify where owned media is not being cited
 * @param {Object} visibilityAnalysis - Visibility analysis with questions and sources
 * @param {Object} competitiveAnalysis - Competitive analysis data
 * @param {Array} allSources - All classified sources
 * @param {Object} config - Configuration with entity name
 * @returns {Object} Owned media gap analysis with action card
 */
function extractOwnedMediaOpportunities(visibilityAnalysis, competitiveAnalysis, allSources, config) {
  const entityName = config.entity || 'Brand';

  // Count owned media and competitor media citations
  let ownedMediaCitations = 0;
  let competitorMediaCitations = 0;
  const competitorBreakdown = {};

  (allSources || []).forEach(source => {
    const sourceType = source.source_type || '';
    if (sourceType === 'Owned Media') {
      ownedMediaCitations++;
    } else if (sourceType === 'Competitor Media') {
      competitorMediaCitations++;
      const competitorName = source.competitor_name || 'Unknown Competitor';
      competitorBreakdown[competitorName] = (competitorBreakdown[competitorName] || 0) + 1;
    }
  });

  // Analyze questions to find those without owned media citations
  const visibilityQuestionsWithoutOwned = [];
  const competitiveQuestionsWithoutOwned = [];

  // Check visibility questions (ranked_first + not_ranked_first)
  const allVisibilityQuestions = [
    ...(visibilityAnalysis?.ranked_first_questions || []),
    ...(visibilityAnalysis?.not_ranked_first_questions || [])
  ];

  allVisibilityQuestions.forEach(q => {
    const questionSources = [];
    // Collect sources from all LLM responses
    Object.values(q.llm_responses || {}).forEach(resp => {
      if (resp.sources) {
        questionSources.push(...resp.sources);
      }
    });

    // Check if any source is Owned Media
    const hasOwnedMedia = questionSources.some(s => s.source_type === 'Owned Media');
    if (!hasOwnedMedia && questionSources.length > 0) {
      // Count competitor media in this question
      const competitorCount = questionSources.filter(s => s.source_type === 'Competitor Media').length;
      visibilityQuestionsWithoutOwned.push({
        question: q.question,
        total_sources: questionSources.length,
        competitor_sources: competitorCount,
        top_source_types: [...new Set(questionSources.map(s => s.source_type))].slice(0, 3)
      });
    }
  });

  // Check competitive questions from not_ranked_first (those marked as competitive)
  const notRankedFirst = visibilityAnalysis?.not_ranked_first_questions || [];
  notRankedFirst.forEach(q => {
    const llmResponses = q.llm_responses || {};
    const isCompetitive = Object.values(llmResponses).some(r => r.rank === null && r.chosenEntity);

    if (isCompetitive) {
      const questionSources = [];
      Object.values(llmResponses).forEach(resp => {
        if (resp.sources) {
          questionSources.push(...resp.sources);
        }
      });

      const hasOwnedMedia = questionSources.some(s => s.source_type === 'Owned Media');
      if (!hasOwnedMedia && questionSources.length > 0) {
        const competitorCount = questionSources.filter(s => s.source_type === 'Competitor Media').length;
        competitiveQuestionsWithoutOwned.push({
          question: q.question,
          total_sources: questionSources.length,
          competitor_sources: competitorCount,
          competitor_chosen: llmResponses.gemini?.chosenEntity || llmResponses.openai?.chosenEntity
        });
      }
    }
  });

  // Calculate totals
  const totalVisibilityQuestions = allVisibilityQuestions.length;
  const totalCompetitiveQuestions = notRankedFirst.filter(q => {
    const llmResponses = q.llm_responses || {};
    return Object.values(llmResponses).some(r => r.rank === null && r.chosenEntity);
  }).length;

  const totalQuestionsAnalyzed = totalVisibilityQuestions + totalCompetitiveQuestions;
  const questionsWithoutOwned = visibilityQuestionsWithoutOwned.length + competitiveQuestionsWithoutOwned.length;
  const coverageGapPercentage = totalQuestionsAnalyzed > 0
    ? Math.round((questionsWithoutOwned / totalQuestionsAnalyzed) * 100)
    : 0;

  // Calculate citation ratio
  const citationRatio = competitorMediaCitations > 0
    ? Math.round((ownedMediaCitations / competitorMediaCitations) * 100) / 100
    : ownedMediaCitations > 0 ? 999 : 0;

  // Sort competitor breakdown
  const competitorDominance = Object.entries(competitorBreakdown)
    .map(([competitor, citations]) => ({ competitor, citations }))
    .sort((a, b) => b.citations - a.citations)
    .slice(0, 5);

  // Determine if there's a significant gap (owned media cited in less than 20% of questions)
  const hasSignificantGap = coverageGapPercentage >= 50 || (competitorMediaCitations > ownedMediaCitations * 3);

  // Calculate impact and effort scores
  const impactScore = hasSignificantGap
    ? Math.min(0.5 + (coverageGapPercentage / 100) * 0.4 + (competitorMediaCitations > ownedMediaCitations ? 0.1 : 0), 1.0)
    : 0.3;

  // Effort is medium - requires content/SEO audit but not product changes
  const effortScore = 0.50;

  const priority = categorizePriority(impactScore, effortScore);

  // Build the action card opportunity
  const opportunity = hasSignificantGap ? {
    id: 'OWNED_MEDIA_001',
    title: `Your website is not being picked up by AI search engines`,
    description: `LLMs are citing competitor sources ${competitorMediaCitations}x while your owned media appears only ${ownedMediaCitations}x. ${coverageGapPercentage}% of queries have no citations from your website.`,
    opportunity_type: 'Owned Media Gap',
    theme_category: 'AI Search Visibility',
    current_state: {
      owned_media_citations: ownedMediaCitations,
      competitor_media_citations: competitorMediaCitations,
      citation_ratio: citationRatio,
      visibility_questions_without_owned: visibilityQuestionsWithoutOwned.length,
      competitive_questions_without_owned: competitiveQuestionsWithoutOwned.length,
      total_questions_analyzed: totalQuestionsAnalyzed,
      coverage_gap_percentage: coverageGapPercentage
    },
    competitor_dominance: competitorDominance,
    scores: {
      impact_score: impactScore,
      impact_label: getImpactLabel(impactScore),
      effort_score: effortScore,
      effort_label: getEffortLabel(effortScore)
    },
    priority: priority,
    recommended_actions: [
      'Run an LLM discoverability audit on your website to identify indexing issues',
      'Ensure key product/service pages have structured data markup (JSON-LD)',
      `Create authoritative content addressing the ${questionsWithoutOwned} questions where you're not cited`,
      'Review competitor content strategy for topics where they dominate citations',
      'Optimize content for AI retrieval: clear headings, factual statements, authoritative tone'
    ],
    evidence: [
      {
        type: 'visibility_gap',
        text: `${visibilityQuestionsWithoutOwned.length} visibility questions have 0 owned media sources cited`,
        questions_sample: visibilityQuestionsWithoutOwned.slice(0, 3).map(q => q.question)
      },
      {
        type: 'competitive_gap',
        text: `${competitiveQuestionsWithoutOwned.length} competitive questions have 0 owned media sources cited`,
        questions_sample: competitiveQuestionsWithoutOwned.slice(0, 3).map(q => q.question)
      }
    ],
    questions_without_owned_media: {
      visibility: visibilityQuestionsWithoutOwned,
      competitive: competitiveQuestionsWithoutOwned
    },
    metadata: {
      analysis_scope: 'visibility_and_competitive',
      entity: entityName
    }
  } : null;

  return {
    summary: {
      owned_media_citations: ownedMediaCitations,
      competitor_media_citations: competitorMediaCitations,
      citation_ratio: citationRatio,
      total_questions_analyzed: totalQuestionsAnalyzed,
      questions_without_owned_media: questionsWithoutOwned,
      coverage_gap_percentage: coverageGapPercentage,
      has_significant_gap: hasSignificantGap
    },
    competitor_breakdown: competitorBreakdown,
    competitor_dominance: competitorDominance,
    questions_without_owned_media: {
      visibility: visibilityQuestionsWithoutOwned,
      competitive: competitiveQuestionsWithoutOwned
    },
    opportunity: opportunity
  };
}

/**
 * Generate outreach recommendations based on priority targets
 */
function generateOutreachRecommendations(criticalDomains, highPriorityDomains, config) {
  const recommendations = [];

  // Critical domain recommendations
  criticalDomains.slice(0, 5).forEach(domain => {
    const oppTypes = domain.opportunity_types.join(', ');
    const competitor = domain.top_competitor;

    let action = '';
    if (domain.opportunity_types.includes('AI Visibility Gap')) {
      action = `Update or create content on ${domain.domain} to improve brand visibility`;
    } else if (domain.opportunity_types.includes('Competitive Positioning Gap')) {
      action = `Pitch comparison content to ${domain.domain} highlighting advantages over ${competitor || 'competitors'}`;
    } else {
      action = `Engage with ${domain.domain} to address reputation concerns`;
    }

    recommendations.push({
      priority: 'Critical',
      domain: domain.domain,
      source_type: domain.source_type,
      opportunity_types: domain.opportunity_types,
      action: action,
      rationale: `Appears in ${domain.opportunity_count} opportunities across ${oppTypes}`,
      competitor_context: competitor ? `Currently favoring ${competitor}` : null,
      url_count: domain.url_count
    });
  });

  // High priority domain recommendations
  highPriorityDomains.slice(0, 5).forEach(domain => {
    recommendations.push({
      priority: 'High',
      domain: domain.domain,
      source_type: domain.source_type,
      opportunity_types: domain.opportunity_types,
      action: `Build relationship with ${domain.domain} for ongoing coverage`,
      rationale: `High-influence source appearing in ${domain.opportunity_count} opportunities`,
      competitor_context: domain.top_competitor ? `Currently favoring ${domain.top_competitor}` : null,
      url_count: domain.url_count
    });
  });

  return recommendations;
}

/**
 * Main PR Insights aggregation function
 * @param {Object} aggregatedAnalysis - Full aggregated analysis
 * @param {Object} config - Configuration with entity, competitors, etc.
 * @param {Array} allSources - All classified sources from LLM responses (optional)
 * @returns {Object} PR Insights structure
 */
export function aggregatePRInsights(aggregatedAnalysis, config, allSources = []) {
  console.log('[PRInsightsAggregator] Starting aggregation');
  console.log('[PRInsightsAggregator] Available keys:', Object.keys(aggregatedAnalysis));
  const allOpportunities = [];

  // Extract from reputation analysis
  if (aggregatedAnalysis.reputation) {
    console.log('[PRInsightsAggregator] Reputation data found, negative topics:',
      aggregatedAnalysis.reputation.sentiment_topics?.negative_topics?.length || 0);
    const repOpps = extractReputationOpportunities(aggregatedAnalysis.reputation, config);
    console.log(`[PRInsightsAggregator] Extracted ${repOpps.length} reputation opportunities`);
    allOpportunities.push(...repOpps);
  } else {
    console.log('[PRInsightsAggregator] No reputation data');
  }

  // Extract from visibility analysis
  if (aggregatedAnalysis.visibility) {
    console.log('[PRInsightsAggregator] Visibility data found, not_ranked_first:',
      aggregatedAnalysis.visibility.not_ranked_first_questions?.length || 0);
    const visOpps = extractVisibilityOpportunities(aggregatedAnalysis.visibility, config);
    console.log(`[PRInsightsAggregator] Extracted ${visOpps.length} visibility opportunities`);
    allOpportunities.push(...visOpps);
  } else {
    console.log('[PRInsightsAggregator] No visibility data');
  }

  // Extract from competitive analysis
  console.log('[PRInsightsAggregator] Checking competitive data...');
  console.log('[PRInsightsAggregator] competitive_metrics:', !!aggregatedAnalysis.competitive_metrics);
  console.log('[PRInsightsAggregator] competitive_opportunities:', !!aggregatedAnalysis.competitive_opportunities);
  console.log('[PRInsightsAggregator] competitive:', !!aggregatedAnalysis.competitive);

  // Use competitive_metrics OR competitive (both set to same value by orchestrator)
  const competitiveData = aggregatedAnalysis.competitive_metrics || aggregatedAnalysis.competitive;
  const competitiveOppsData = aggregatedAnalysis.competitive_opportunities || competitiveData;
  if (competitiveData) {
    const missedCount = competitiveOppsData?.missed_opportunities?.opportunities?.length || 0;
    console.log('[PRInsightsAggregator] Competitive data found, missed_opportunities:', missedCount);
    const compOpps = extractCompetitiveOpportunities(
      competitiveData,
      competitiveOppsData,
      config
    );
    console.log(`[PRInsightsAggregator] Extracted ${compOpps.length} competitive loss opportunities`);
    allOpportunities.push(...compOpps);
  } else {
    console.log('[PRInsightsAggregator] No competitive data');
  }

  // Handle case where no opportunities found
  if (allOpportunities.length === 0) {
    console.log('[PRInsightsAggregator] No opportunities found');
    return {
      analysis_type: 'pr_insights',
      entity: config.entity,
      generated_at: new Date().toISOString(),
      total_opportunities: 0,
      message: 'No significant improvement opportunities identified. Current positioning is strong across all dimensions.',
      priority_summary: {
        critical: { count: 0, label: 'Do First - Quick High-Impact Wins', color: 'red', timeline: '1-3 months' },
        strategic: { count: 0, label: 'Plan Long-term - High-Impact Initiatives', color: 'orange', timeline: '6-12 months' },
        quick_wins: { count: 0, label: 'Easy Wins - Low-Hanging Fruit', color: 'yellow', timeline: '1-2 months' },
        low_priority: { count: 0, label: 'Deprioritize', color: 'gray', timeline: '12+ months' }
      },
      theme_distribution: {},
      opportunities: []
    };
  }

  // Sort by urgency
  allOpportunities.sort((a, b) => a.priority.urgency - b.priority.urgency);

  // Calculate summary statistics
  const prioritySummary = {
    critical: { count: 0, label: 'Do First - Quick High-Impact Wins', color: 'red', timeline: '1-3 months' },
    strategic: { count: 0, label: 'Plan Long-term - High-Impact Initiatives', color: 'orange', timeline: '6-12 months' },
    quick_wins: { count: 0, label: 'Easy Wins - Low-Hanging Fruit', color: 'yellow', timeline: '1-2 months' },
    low_priority: { count: 0, label: 'Deprioritize', color: 'gray', timeline: '12+ months' }
  };

  const themeDistribution = {};

  allOpportunities.forEach(opp => {
    const tier = opp.priority.tier.toLowerCase().replace(/\s+/g, '_');
    if (prioritySummary[tier]) {
      prioritySummary[tier].count++;
    }

    const theme = opp.theme_category.toLowerCase().replace(/\s+/g, '_');
    themeDistribution[theme] = (themeDistribution[theme] || 0) + 1;
  });

  // Calculate metrics overview
  const metricsOverview = {};

  if (aggregatedAnalysis.reputation?.sentiment_topics) {
    const negTopics = aggregatedAnalysis.reputation.sentiment_topics.negative_topics || [];
    const avgSentiment = negTopics.length > 0
      ? negTopics.reduce((sum, t) => sum + (t.sentiment_score || 0), 0) / negTopics.length
      : 0;

    metricsOverview.reputation = {
      negative_topics_count: negTopics.length,
      avg_sentiment_score: Math.round(avgSentiment * 100) / 100
    };
  }

  if (aggregatedAnalysis.visibility) {
    const missedOpps = aggregatedAnalysis.visibility.missed_opportunities?.opportunities || [];
    const avgRank = missedOpps.length > 0
      ? missedOpps.reduce((sum, o) => sum + (o.current_rank || 0), 0) / missedOpps.length
      : 0;

    metricsOverview.visibility = {
      missed_opportunity_rate: Math.round((1 - (aggregatedAnalysis.visibility.brand_visibility || 0)) * 100) / 100,
      avg_rank_when_mentioned: Math.round(avgRank * 10) / 10,
      not_mentioned_count: aggregatedAnalysis.visibility.not_mentioned_count || 0
    };
  }

  if (aggregatedAnalysis.competitive_metrics) {
    const winRate = aggregatedAnalysis.competitive_metrics.win_rate || 0;
    const missedOppsCount = aggregatedAnalysis.competitive_opportunities?.missed_opportunities?.opportunities?.length || 0;

    metricsOverview.competitive = {
      win_rate: Math.round(winRate * 100) / 100,
      loss_rate: Math.round((1 - winRate) * 100) / 100,
      competitive_losses_count: missedOppsCount
    };
  }

  // Analyze priority source targets using ALL sources from LLM responses
  console.log('[PRInsightsAggregator] Analyzing priority source targets...');
  console.log(`[PRInsightsAggregator] All sources available: ${allSources?.length || 0}`);
  const prioritySourceTargets = analyzePrioritySourceTargets(allOpportunities, allSources, config, aggregatedAnalysis);
  console.log(`[PRInsightsAggregator] Identified ${prioritySourceTargets.summary.total_domains} unique domains, ${prioritySourceTargets.summary.critical_targets} critical targets`);

  // Extract Owned Media Gap analysis
  console.log('[PRInsightsAggregator] Analyzing owned media gaps...');
  const ownedMediaAnalysis = extractOwnedMediaOpportunities(
    aggregatedAnalysis.visibility,
    aggregatedAnalysis.competitive_metrics || aggregatedAnalysis.competitive,
    allSources,
    config
  );
  console.log(`[PRInsightsAggregator] Owned media gap: ${ownedMediaAnalysis.summary.coverage_gap_percentage}% questions without owned media`);

  // Add owned media opportunity to all opportunities if significant gap exists
  if (ownedMediaAnalysis.opportunity) {
    console.log('[PRInsightsAggregator] Adding Owned Media Gap opportunity');
    allOpportunities.unshift(ownedMediaAnalysis.opportunity); // Add at the beginning for visibility

    // Update priority summary for the new opportunity
    const tier = ownedMediaAnalysis.opportunity.priority.tier.toLowerCase().replace(/\s+/g, '_');
    if (prioritySummary[tier]) {
      prioritySummary[tier].count++;
    }

    // Update theme distribution
    const theme = ownedMediaAnalysis.opportunity.theme_category.toLowerCase().replace(/\s+/g, '_');
    themeDistribution[theme] = (themeDistribution[theme] || 0) + 1;
  }

  console.log(`[PRInsightsAggregator] Generated ${allOpportunities.length} total opportunities`);
  console.log(`[PRInsightsAggregator] Priority distribution: Critical=${prioritySummary.critical.count}, Strategic=${prioritySummary.strategic.count}, Quick Wins=${prioritySummary.quick_wins.count}, Low Priority=${prioritySummary.low_priority.count}`);

  return {
    analysis_type: 'pr_insights',
    entity: config.entity,
    generated_at: new Date().toISOString(),
    total_opportunities: allOpportunities.length,
    priority_summary: prioritySummary,
    theme_distribution: themeDistribution,
    metrics_overview: metricsOverview,
    priority_source_targets: prioritySourceTargets,
    owned_media_analysis: ownedMediaAnalysis,
    opportunities: allOpportunities
  };
}
