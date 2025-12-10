/**
 * Visibility & Competitive Analysis Aggregator
 * Matches GEO_Multi-LLM_Analysis_V2.17_DUAL_LLM.gs logic
 */

import { extractDomainInfo } from '../sourceClassifier.js';
import { groupBrandVariations } from '../brandMatcher.js';

/**
 * Fuzzy brand matching - matches brand names with some flexibility
 * Based on GEO_Multi-LLM_Analysis_V2.17_DUAL_LLM.gs brandMatchesEntity_()
 * Used ONLY for finding the target entity, not for aggregating products under brands
 * @param {string} brandName - Brand name from LLM response
 * @param {string} targetEntity - Target entity being monitored
 * @returns {boolean} True if brands match
 */
function brandMatchesEntity(brandName, targetEntity) {
  if (!brandName || !targetEntity) return false;

  const brand = brandName.toLowerCase().trim();
  const target = targetEntity.toLowerCase().trim();

  // Exact match
  if (brand === target) return true;

  // One contains the other (handles "Nike" matching "Nike Air Max", etc.)
  if (brand.includes(target)) return true;
  if (target.includes(brand)) return true;

  return false;
}

/**
 * Aggregate entity rankings by brand family using AI-powered matching
 * @param {Array} entityArray - Array of entity rankings with sov, visibility, etc.
 * @param {Object} brandGroups - Result from groupBrandVariations
 * @param {string} targetEntity - The target entity we're analyzing
 * @param {Array} targetMatches - Entities that match the target brand
 * @returns {Array} Aggregated rankings by brand family
 */
function aggregateRankingsByBrandFamily(entityArray, brandGroups, targetEntity, targetMatches) {
  // Create reverse lookup: entity name (lowercase) -> parent brand
  const entityToParent = {};
  for (const [parentBrand, entities] of Object.entries(brandGroups)) {
    for (const entity of entities) {
      entityToParent[entity.toLowerCase()] = parentBrand;
    }
  }

  // Aggregate metrics by parent brand
  const aggregated = {};

  for (const entity of entityArray) {
    const entityLower = entity.name.toLowerCase();
    const parentBrand = entityToParent[entityLower] || entity.name;

    if (!aggregated[parentBrand]) {
      aggregated[parentBrand] = {
        name: parentBrand,
        variants: [],
        totalMentions: 0,
        weightedRankSum: 0, // For calculating weighted average rank
        totalVisibility: 0,
        bestRank: Infinity,
        isTargetBrand: false
      };
    }

    const group = aggregated[parentBrand];
    group.variants.push({
      name: entity.name,
      mentions: entity.mentions,
      average_rank: entity.average_rank,
      visibility: entity.visibility,
      sov: entity.sov
    });
    group.totalMentions += entity.mentions;
    group.totalVisibility += entity.visibility;
    // Weight rank by mentions for fair averaging
    group.weightedRankSum += entity.average_rank * entity.mentions;

    if (entity.average_rank < group.bestRank) {
      group.bestRank = entity.average_rank;
    }

    // Check if this brand family matches the target
    if (targetMatches.some(t => t.toLowerCase() === entityLower)) {
      group.isTargetBrand = true;
    }
  }

  // Finalize calculations and convert to array
  return Object.values(aggregated).map(group => {
    const avgRank = group.totalMentions > 0
      ? group.weightedRankSum / group.totalMentions
      : group.bestRank;

    // Cap visibility at 1.0 (100%)
    const visibility = Math.min(group.totalVisibility, 1.0);

    // Calculate SOV using same formula: visibility * (2 / (avgRank + 1))
    const sov = (visibility > 0 && avgRank > 0)
      ? visibility * (2 / (avgRank + 1))
      : 0;

    return {
      name: group.name,
      variants: group.variants,
      variant_count: group.variants.length,
      mentions: group.totalMentions,
      average_rank: avgRank,
      best_rank: group.bestRank === Infinity ? null : group.bestRank,
      visibility: visibility,
      sov: sov,
      is_target_brand: group.isTargetBrand
    };
  }).sort((a, b) => b.sov - a.sov); // Sort by SOV descending
}

/**
 * Aggregate visibility/competitive analysis from raw LLM responses
 * @param {Array} rawResponses - Raw LLM responses to aggregate
 * @param {Object} config - Configuration with entity, category, competitors
 * @param {Object} options - Optional settings { geminiApiKey: string, enableBrandGrouping: boolean }
 */
export async function aggregateVisibilityAnalysis(rawResponses, config, options = {}) {
  const entityRankings = new Map();
  const questionResults = [];
  const sourcesMap = new Map();
  const prosConsMap = new Map(); // For competitive analysis: aggregate pros/cons by entity

  // Per-LLM tracking for AI Model Performance (Visibility)
  const llmMetrics = {
    gemini: { mentions: 0, ranks: [], questionsWithMention: 0 },
    openai: { mentions: 0, ranks: [], questionsWithMention: 0 }
  };

  // Per-LLM tracking for Competitive AI Model Performance
  const competitiveLlmMetrics = {
    gemini: { totalQuestions: 0, targetChosen: 0, choicesByBrand: new Map() },
    openai: { totalQuestions: 0, targetChosen: 0, choicesByBrand: new Map() }
  };

  // Process each response
  rawResponses.forEach(response => {
    const { question, gemini, openai } = response;

    const questionResult = {
      question: question.question,
      llm_responses: {},
      entities_mentioned: []
    };

    // Process Gemini response
    if (gemini.data) {
      const geminiResult = processVisibilityResponse(
        gemini.data,
        gemini.sources,
        'gemini',
        config.entity,
        entityRankings,
        sourcesMap,
        questionResult,
        prosConsMap
      );
      // Track per-LLM metrics for target entity (Visibility)
      if (geminiResult.entityRank !== null) {
        llmMetrics.gemini.mentions++;
        llmMetrics.gemini.ranks.push(geminiResult.entityRank);
        llmMetrics.gemini.questionsWithMention++;
      }
      // Track competitive metrics if this is a competitive response
      if (geminiResult.isCompetitive) {
        competitiveLlmMetrics.gemini.totalQuestions++;
        if (geminiResult.entityRank === 1) {
          competitiveLlmMetrics.gemini.targetChosen++;
        }
        if (geminiResult.chosenEntity) {
          const currentCount = competitiveLlmMetrics.gemini.choicesByBrand.get(geminiResult.chosenEntity) || 0;
          competitiveLlmMetrics.gemini.choicesByBrand.set(geminiResult.chosenEntity, currentCount + 1);
        }
      }
    }

    // Process OpenAI response
    if (openai.data) {
      const openaiResult = processVisibilityResponse(
        openai.data,
        openai.sources,
        'openai',
        config.entity,
        entityRankings,
        sourcesMap,
        questionResult,
        prosConsMap
      );
      // Track per-LLM metrics for target entity (Visibility)
      if (openaiResult.entityRank !== null) {
        llmMetrics.openai.mentions++;
        llmMetrics.openai.ranks.push(openaiResult.entityRank);
        llmMetrics.openai.questionsWithMention++;
      }
      // Track competitive metrics if this is a competitive response
      if (openaiResult.isCompetitive) {
        competitiveLlmMetrics.openai.totalQuestions++;
        if (openaiResult.entityRank === 1) {
          competitiveLlmMetrics.openai.targetChosen++;
        }
        if (openaiResult.chosenEntity) {
          const currentCount = competitiveLlmMetrics.openai.choicesByBrand.get(openaiResult.chosenEntity) || 0;
          competitiveLlmMetrics.openai.choicesByBrand.set(openaiResult.chosenEntity, currentCount + 1);
        }
      }
    }

    questionResults.push(questionResult);
  });

  // Calculate visibility metrics
  const entityArray = Array.from(entityRankings.values());
  entityArray.sort((a, b) => a.averageRank - b.averageRank);

  // Find target entity metrics (use fuzzy matching)
  const targetEntityData = entityArray.find(e => brandMatchesEntity(e.name, config.entity));

  // Calculate visibility as percentage of questions where brand was mentioned
  // Since we process both Gemini and OpenAI, mentions can be 2x questions
  // We need to count unique questions, not raw mentions
  const totalLLMResponses = questionResults.length * 2; // Each question has 2 LLM responses
  const maxPossibleMentions = totalLLMResponses;

  // Calculate visibility: mentions / max possible mentions, capped at 1.0 (100%)
  let visibility = 0;
  if (targetEntityData && maxPossibleMentions > 0) {
    visibility = Math.min(targetEntityData.mentions / maxPossibleMentions, 1.0);
  }
  const averagePosition = targetEntityData ? targetEntityData.averageRank : 0;

  // Calculate SOV (Share of Voice) - Matches GAS calculateSOV_() formula
  // Formula: visibility * (2 / (avgPosition + 1))
  // Position 1: w_r = 2/2 = 1.0, Position 2: w_r = 2/3 = 0.67, Position 3: w_r = 2/4 = 0.5
  let sov = 0;
  if (visibility > 0 && averagePosition > 0) {
    const w_r = 2 / (averagePosition + 1);
    sov = visibility * w_r;
  }


  // Separate ranked first and not ranked first with enhanced details
  // For competitive analysis: "ranked first" = ALL responding LLMs chose target
  // "not ranked first" = at least one LLM chose a competitor
  const rankedFirstQuestions = questionResults
    .filter(q => {
      const geminiResp = q.llm_responses.gemini;
      const openaiResp = q.llm_responses.openai;
      const geminiRank = geminiResp?.rank;
      const openaiRank = openaiResp?.rank;

      // Check if each LLM that responded chose the target as #1
      const geminiChoseTarget = geminiResp ? geminiRank === 1 : true; // true if no response
      const openaiChoseTarget = openaiResp ? openaiRank === 1 : true; // true if no response

      // Both that responded must have chosen target
      const hasAnyResponse = geminiResp || openaiResp;
      return hasAnyResponse && geminiChoseTarget && openaiChoseTarget;
    })
    .map(q => {
      // Enhance with target entity details (same as not ranked first)
      const enhanced = { ...q };

      // Add target entity info for each LLM
      Object.keys(enhanced.llm_responses).forEach(llm => {
        const resp = enhanced.llm_responses[llm];
        const ranking = resp.ranking || [];

        // Find target entity in ranking (with fuzzy matching)
        const targetInRanking = ranking.find(
          r => brandMatchesEntity(r.name, config.entity)
        );

        // Find top brand details (rank === 1)
        const topBrandDetails = ranking.find(r => r.rank === 1);

        enhanced.llm_responses[llm] = {
          ...resp,
          target_entity: config.entity,
          target_rank: targetInRanking ? targetInRanking.rank : (resp.rank || 'Not ranked'),
          // Preserve existing target_comment from competitive responses, or use ranking comment
          target_comment: targetInRanking?.comment || resp.target_comment || resp.rawResponse || 'Brand not mentioned in this response',
          top_brand: resp.topBrand,
          // Preserve existing top_brand_comment from competitive responses
          top_brand_comment: topBrandDetails?.comment || resp.top_brand_comment || '',
          full_ranking: ranking.slice(0, 5).map(r => ({
            rank: r.rank,
            name: r.name,
            comment: r.comment
          }))
        };
      });

      return enhanced;
    });

  const notRankedFirstQuestions = questionResults
    .filter(q => {
      const geminiResp = q.llm_responses.gemini;
      const openaiResp = q.llm_responses.openai;
      const geminiRank = geminiResp?.rank;
      const openaiRank = openaiResp?.rank;

      // At least one LLM that responded did NOT choose the target as #1
      const geminiChoseCompetitor = geminiResp && geminiRank !== 1;
      const openaiChoseCompetitor = openaiResp && openaiRank !== 1;

      return geminiChoseCompetitor || openaiChoseCompetitor;
    })
    .map(q => {
      // Enhance with target entity details
      const enhanced = { ...q };

      // Add target entity info for each LLM
      Object.keys(enhanced.llm_responses).forEach(llm => {
        const resp = enhanced.llm_responses[llm];
        const ranking = resp.ranking || [];

        // Find target entity in ranking (with fuzzy matching)
        const targetInRanking = ranking.find(
          r => brandMatchesEntity(r.name, config.entity)
        );

        // Find top brand details
        const topBrandDetails = ranking.find(r => r.rank === 1);

        enhanced.llm_responses[llm] = {
          ...resp,
          target_entity: config.entity,
          target_rank: targetInRanking ? targetInRanking.rank : (resp.rank || 'Not ranked'),
          // Preserve existing target_comment from competitive responses, or use ranking comment
          target_comment: targetInRanking?.comment || resp.target_comment || resp.rawResponse || 'Brand not mentioned in this response',
          top_brand: resp.topBrand,
          // Preserve existing top_brand_comment from competitive responses
          top_brand_comment: topBrandDetails?.comment || resp.top_brand_comment || '',
          full_ranking: ranking.slice(0, 5).map(r => ({
            rank: r.rank,
            name: r.name,
            comment: r.comment
          }))
        };
      });

      return enhanced;
    });

  // Generate source analysis
  const sourceAnalysis = generateSourceAnalysis(Array.from(sourcesMap.values()));

  // Build pros_cons structure from prosConsMap (for competitive analysis)
  const pros_cons = {
    pros: [],
    cons: []
  };

  prosConsMap.forEach((data, entityName) => {
    // Add entity-attributed pros
    data.pros.forEach(pro => {
      pros_cons.pros.push({
        attribute: pro.attribute,
        entity: entityName,
        frequency: pro.frequency,
        sources: pro.sources
      });
    });
    // Add entity-attributed cons
    data.cons.forEach(con => {
      pros_cons.cons.push({
        attribute: con.attribute,
        entity: entityName,
        frequency: con.frequency,
        sources: con.sources
      });
    });
  });

  // Sort by frequency (most mentioned first)
  pros_cons.pros.sort((a, b) => b.frequency - a.frequency);
  pros_cons.cons.sort((a, b) => b.frequency - a.frequency);

  // Calculate per-LLM performance metrics for AI Model Performance section
  const totalQuestions = questionResults.length;
  const llmPerformance = Object.entries(llmMetrics).map(([llmName, metrics]) => {
    const avgPosition = metrics.ranks.length > 0
      ? metrics.ranks.reduce((a, b) => a + b, 0) / metrics.ranks.length
      : 0;
    const visibility = totalQuestions > 0
      ? metrics.questionsWithMention / totalQuestions
      : 0;
    // Calculate SOV using same GAS formula: visibility * (2 / (avgPosition + 1))
    const sov = (visibility > 0 && avgPosition > 0)
      ? visibility * (2 / (avgPosition + 1))
      : 0;
    return {
      llm: llmName,
      displayName: llmName === 'gemini' ? 'Gemini' : 'ChatGPT',
      avgPosition: avgPosition,
      visibility: visibility,
      sov: sov,
      mentions: metrics.mentions,
      questionsWithMention: metrics.questionsWithMention
    };
  }).sort((a, b) => b.sov - a.sov); // Rank by SOV

  // Add rank to each LLM
  llmPerformance.forEach((llm, index) => {
    llm.rank = index + 1;
  });

  // Calculate competitive LLM performance metrics for AI Model Performance section
  const competitiveLlmPerformance = Object.entries(competitiveLlmMetrics).map(([llmName, metrics]) => {
    const brandChoicePercent = metrics.totalQuestions > 0
      ? metrics.targetChosen / metrics.totalQuestions
      : 0;

    // Find the top choice for this LLM (brand chosen most often)
    let topChoice = null;
    let topChoiceCount = 0;
    metrics.choicesByBrand.forEach((count, brand) => {
      if (count > topChoiceCount) {
        topChoiceCount = count;
        topChoice = brand;
      }
    });

    return {
      llm: llmName,
      displayName: llmName === 'gemini' ? 'Gemini' : 'ChatGPT',
      brandChoicePercent: brandChoicePercent,
      topChoice: topChoice,
      totalQuestions: metrics.totalQuestions,
      targetChosen: metrics.targetChosen
    };
  }).sort((a, b) => b.brandChoicePercent - a.brandChoicePercent); // Rank by brand choice %

  // Add rank to each LLM for competitive
  competitiveLlmPerformance.forEach((llm, index) => {
    llm.rank = index + 1;
  });

  // Build entities_ranking array first (we'll use it for brand grouping)
  const entitiesRanking = entityArray.map(e => {
    // Calculate entity visibility as percentage of total LLM responses, capped at 100%
    const entityVisibility = Math.min(e.mentions / maxPossibleMentions, 1.0);
    // Calculate SOV using same GAS formula: visibility * (2 / (avgPosition + 1))
    const entitySov = (entityVisibility > 0 && e.averageRank > 0)
      ? entityVisibility * (2 / (e.averageRank + 1))
      : 0;
    return {
      name: e.name,
      average_rank: e.averageRank,
      mentions: e.mentions,
      visibility: entityVisibility,
      sov: entitySov
    };
  }).sort((a, b) => b.sov - a.sov);

  // Brand family grouping using AI (if API key provided)
  let brandFamilyRanking = null;
  let brandGroupingMetadata = null;

  const geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY;
  const enableBrandGrouping = options.enableBrandGrouping !== false; // Default to true

  if (enableBrandGrouping && geminiApiKey && entitiesRanking.length > 0) {
    try {
      const entityNames = entitiesRanking.map(e => e.name);
      console.log(`   🏷️  Grouping ${entityNames.length} entities by brand family...`);

      const brandResult = await groupBrandVariations(entityNames, config.entity, geminiApiKey);

      if (brandResult && brandResult.brandGroups) {
        brandFamilyRanking = aggregateRankingsByBrandFamily(
          entitiesRanking,
          brandResult.brandGroups,
          config.entity,
          brandResult.targetMatches || []
        );

        brandGroupingMetadata = {
          enabled: true,
          confidence: brandResult.confidence,
          total_brands: Object.keys(brandResult.brandGroups).length,
          total_variants: entityNames.length,
          target_matches: brandResult.targetMatches || []
        };

        console.log(`   ✅ Grouped into ${brandGroupingMetadata.total_brands} brand families`);
      }
    } catch (error) {
      console.error('   ⚠️  Brand grouping failed, using raw entities:', error.message);
      brandGroupingMetadata = {
        enabled: false,
        error: error.message
      };
    }
  } else if (!enableBrandGrouping) {
    brandGroupingMetadata = { enabled: false, reason: 'disabled' };
  } else if (!geminiApiKey) {
    brandGroupingMetadata = { enabled: false, reason: 'no_api_key' };
  }

  return {
    entity: config.entity,
    category: config.category,
    visibility: {
      visibility: visibility,
      averagePosition: averagePosition,
      sov: sov,
      sovStatus: sov > 0.5 ? 'Good' : sov > 0.25 ? 'Fair' : 'Poor',
      totalQuestions: questionResults.length,
      mentions: targetEntityData ? targetEntityData.mentions : 0
    },
    // Raw entity rankings (individual products/variants)
    entities_ranking: entitiesRanking,
    // Aggregated brand family rankings (products grouped under parent brands)
    brand_family_ranking: brandFamilyRanking,
    brand_grouping_metadata: brandGroupingMetadata,
    pros_cons: pros_cons,
    ranked_first_questions: rankedFirstQuestions,
    not_ranked_first_questions: notRankedFirstQuestions,
    source_analysis: sourceAnalysis,
    full_sources_list: Array.from(sourcesMap.values()),
    llm_performance: llmPerformance,
    competitive_llm_performance: competitiveLlmPerformance,
    timestamp: new Date().toISOString()
  };
}

/**
 * Process a single visibility/competitive response
 * @returns {object} { entityRank, isCompetitive, chosenEntity }
 */
function processVisibilityResponse(data, sources, llmSource, targetEntity, entityRankings, sourcesMap, questionResult, prosConsMap) {
  let entityRank = null;
  let topBrand = null;
  let isCompetitive = false;
  let chosenEntity = null;

  if (data.entities_ranking && Array.isArray(data.entities_ranking)) {
    // Visibility response format - store entities exactly as returned by LLM
    // (no product-to-brand aggregation, matching GAS behavior)
    data.entities_ranking.forEach((entity, index) => {
      const rank = entity.rank || index + 1;
      const name = entity.name;

      if (!entityRankings.has(name)) {
        entityRankings.set(name, {
          name: name,
          ranks: [],
          mentions: 0,
          averageRank: 0
        });
      }

      const entityData = entityRankings.get(name);
      entityData.ranks.push(rank);
      entityData.mentions++;
      entityData.averageRank = entityData.ranks.reduce((a, b) => a + b, 0) / entityData.ranks.length;

      // Use fuzzy matching for target entity only
      if (brandMatchesEntity(name, targetEntity)) {
        entityRank = rank;
      }

      if (rank === 1) {
        topBrand = name;
      }
    });

    questionResult.llm_responses[llmSource] = {
      rank: entityRank,
      topBrand: topBrand,
      ranking: data.entities_ranking,
      sources: sources || []
    };

    // Add entities mentioned from this response
    data.entities_ranking.forEach(entity => {
      if (!questionResult.entities_mentioned.includes(entity.name)) {
        questionResult.entities_mentioned.push(entity.name);
      }
    });
  } else if (data.entity_choice) {
    // Competitive response format
    isCompetitive = true;
    chosenEntity = data.entity_choice;

    if (!entityRankings.has(chosenEntity)) {
      entityRankings.set(chosenEntity, {
        name: chosenEntity,
        ranks: [1],
        mentions: 1,
        averageRank: 1
      });
    } else {
      const entityData = entityRankings.get(chosenEntity);
      entityData.ranks.push(1);
      entityData.mentions++;
      entityData.averageRank = entityData.ranks.reduce((a, b) => a + b, 0) / entityData.ranks.length;
    }

    entityRank = brandMatchesEntity(chosenEntity, targetEntity) ? 1 : null;
    topBrand = chosenEntity;

    // For competitive responses, use raw_response as the explanation
    const topBrandComment = data.raw_response || '';

    questionResult.llm_responses[llmSource] = {
      rank: entityRank,
      topBrand: topBrand,
      top_brand_comment: topBrandComment,
      target_comment: entityRank === 1 ? topBrandComment : 'Not selected as top choice',
      chosenEntity: chosenEntity,
      rawResponse: data.raw_response,
      sources: sources || []
    };

    // Process entity_analysis for pros/cons aggregation
    if (data.entity_analysis && typeof data.entity_analysis === 'object') {
      Object.entries(data.entity_analysis).forEach(([entityName, analysis]) => {
        if (!prosConsMap.has(entityName)) {
          prosConsMap.set(entityName, { pros: [], cons: [] });
        }
        const entityProsConsData = prosConsMap.get(entityName);

        // Process pros
        if (analysis.pros && Array.isArray(analysis.pros)) {
          analysis.pros.forEach(pro => {
            const point = pro.point || pro.attribute || pro;
            if (point && typeof point === 'string') {
              // Check if this pro is already recorded
              const existing = entityProsConsData.pros.find(p => p.attribute === point);
              if (existing) {
                existing.frequency++;
              } else {
                entityProsConsData.pros.push({
                  attribute: point,
                  entity: entityName,
                  frequency: 1,
                  sources: pro.sources || []
                });
              }
            }
          });
        }

        // Process cons
        if (analysis.cons && Array.isArray(analysis.cons)) {
          analysis.cons.forEach(con => {
            const point = con.point || con.attribute || con;
            if (point && typeof point === 'string') {
              // Check if this con is already recorded
              const existing = entityProsConsData.cons.find(c => c.attribute === point);
              if (existing) {
                existing.frequency++;
              } else {
                entityProsConsData.cons.push({
                  attribute: point,
                  entity: entityName,
                  frequency: 1,
                  sources: con.sources || []
                });
              }
            }
          });
        }
      });
    }
  }

  // Process sources - include classification data if available
  if (sources && Array.isArray(sources)) {
    sources.forEach(source => {
      if (!sourcesMap.has(source.url)) {
        // Get enhanced domain info including YouTube channel
        const domainInfo = extractDomainInfo(source.url);
        sourcesMap.set(source.url, {
          url: source.url,
          title: source.title || source.domain,
          domain: domainInfo.isYouTube && domainInfo.channelName
            ? `youtube.com/${domainInfo.channelName}`
            : (source.domain || domainInfo.domain),
          source_type: source.source_type || 'Other',
          classification_confidence: source.classification_confidence,
          classification_reasoning: source.classification_reasoning,
          youtube_channel: source.youtube_channel || domainInfo.channelName || null,
          isYouTube: domainInfo.isYouTube,
          cited_by: []
        });
      }

      const sourceData = sourcesMap.get(source.url);
      if (!sourceData.cited_by.includes(llmSource)) {
        sourceData.cited_by.push(llmSource);
      }
      // Update source_type if it was classified later
      if (source.source_type && sourceData.source_type === 'Other') {
        sourceData.source_type = source.source_type;
        sourceData.classification_confidence = source.classification_confidence;
        sourceData.classification_reasoning = source.classification_reasoning;
      }
    });
  }

  // Return extended result for per-LLM tracking
  return { entityRank, isCompetitive, chosenEntity };
}

/**
 * Generate source analysis from classified sources
 * Note: Sources should already be classified by AI before calling this function
 */
function generateSourceAnalysis(sources) {
  const sourceTypes = {
    'Journalism': 0,
    'Corporate Blogs & Content': 0,
    'Social / UGC': 0,
    'Aggregators / Encyclopedic': 0,
    'Government/NGO': 0,
    'Academic/Research': 0,
    'Owned Media': 0,
    'Paid/Advertorial': 0,
    'Press Release': 0,
    'Other': 0
  };

  // Count by domain
  const domainCounts = new Map();
  // Track domain to source_type mapping
  const domainTypes = new Map();

  sources.forEach(source => {
    const type = source.source_type || 'Other';
    if (sourceTypes.hasOwnProperty(type)) {
      sourceTypes[type]++;
    } else {
      sourceTypes['Other']++;
    }

    // Count domain occurrences
    const domain = source.domain || 'unknown';
    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    if (!domainTypes.has(domain)) {
      domainTypes.set(domain, type);
    }
  });

  // Sort domains by count and get top 10
  const topDomains = Array.from(domainCounts.entries())
    .map(([domain, count]) => ({
      domain,
      count,
      source_type: domainTypes.get(domain) || 'Other'
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total_sources: sources.length,
    source_type_distribution: sourceTypes,
    unique_domains: new Set(sources.map(s => s.domain)).size,
    top_domains: topDomains
  };
}
