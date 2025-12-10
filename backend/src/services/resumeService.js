/**
 * Resume Service
 * Resumes interrupted analyses by running only the aggregation phase
 * using saved LLM responses from the database
 */

import { Report } from '../models/Report.js';
import { parseJSON } from '../utils/jsonParser.js';
import { aggregateReputationAnalysis } from './aggregators/reputationAggregatorAI.js';
import { aggregateVisibilityAnalysis } from './aggregators/visibilityAggregator.js';
import { aggregateCategoryAnalysis } from './aggregators/categoryAggregator.js';
import { classifySourceTypes } from './sourceClassifier.js';
import { enrichSourcesWithYouTubeMetadata } from './youtubeMetadata.js';
import { aggregatePRInsights } from './aggregators/prInsightsAggregator.js';

/**
 * Check for and resume any interrupted reports on startup
 */
export async function checkAndResumeInterruptedReports(geminiApiKey, openaiApiKey) {
  console.log('\n🔍 Checking for interrupted reports...');

  const interruptedReports = Report.findInterruptedReports();

  if (interruptedReports.length === 0) {
    console.log('   ✅ No interrupted reports found');
    return;
  }

  console.log(`   ⚠️  Found ${interruptedReports.length} interrupted report(s)`);

  for (const report of interruptedReports) {
    if (report.can_resume) {
      console.log(`\n🔄 Resuming report ${report.id} (${report.entity})`);
      console.log(`   📊 Has ${report.response_count} LLM responses`);
      console.log(`   📈 Has ${report.market_result_count} market results, ${report.analysis_result_count} analysis results`);

      try {
        await resumeAnalysis(report.id, geminiApiKey, openaiApiKey);
        console.log(`   ✅ Successfully resumed and completed report ${report.id}`);
      } catch (error) {
        console.error(`   ❌ Failed to resume report ${report.id}:`, error.message);
        // Mark as failed so it doesn't keep retrying
        Report.updateStatus(report.id, 'failed', null, `Resume failed: ${error.message}`);
      }
    } else {
      console.log(`   ⚠️  Report ${report.id} cannot be resumed (no responses or already has results)`);
    }
  }
}

/**
 * Resume a specific interrupted analysis
 * Reconstructs raw responses from DB and runs aggregation phase only
 */
export async function resumeAnalysis(reportId, geminiApiKey, openaiApiKey) {
  const startTime = Date.now();

  console.log(`\n🔄 ========== RESUMING ANALYSIS ==========`);
  console.log(`📋 Report ID: ${reportId}`);

  // Get resume config
  const resumeConfig = Report.getResumeConfig(reportId);
  if (!resumeConfig) {
    throw new Error(`Report ${reportId} not found`);
  }

  const { report, markets, categoryFamilies, competitors, llmResponses, isMultiMarket } = resumeConfig;
  const entity = report.entity;

  console.log(`🏢 Entity: ${entity}`);
  console.log(`📊 LLM Responses: ${llmResponses.length}`);
  console.log(`🌍 Multi-market: ${isMultiMarket}`);

  if (isMultiMarket && markets.length > 0) {
    await resumeMultiMarketAnalysis(reportId, {
      entity,
      markets,
      categoryFamilies,
      competitors,
      llmResponses
    }, geminiApiKey);
  } else {
    await resumeSingleMarketAnalysis(reportId, {
      entity,
      category: report.category,
      competitors: report.competitors,
      llmResponses
    }, geminiApiKey);
  }

  const executionTime = Math.round((Date.now() - startTime) / 1000);
  Report.updateExecutionTime(reportId, executionTime);
  Report.updateStatus(reportId, 'completed', 100);

  console.log(`\n✨ ========== RESUME COMPLETE ==========`);
  console.log(`⏱️  Aggregation time: ${executionTime}s`);
}

/**
 * Resume multi-market analysis (aggregation phase only)
 */
async function resumeMultiMarketAnalysis(reportId, config, geminiApiKey) {
  const { entity, markets, categoryFamilies, competitors, llmResponses } = config;

  // Reconstruct raw responses structure per market
  const aggregatedByMarket = {};

  for (const market of markets) {
    aggregatedByMarket[market.code] = {
      config: {
        entity,
        countries: [market.country],
        languages: [market.language],
        market
      },
      rawResponses: {
        reputation: [],
        category: [],
        visibility: [],
        competitive: []
      }
    };
  }

  // Sort LLM responses into market buckets
  const allSources = [];

  for (const response of llmResponses) {
    // Determine market from question_id (format: type_marketCode_... or type_...)
    const questionId = response.question_id || '';
    let marketCode = null;

    // Try to extract market code from question ID
    for (const market of markets) {
      if (questionId.includes(market.code) || questionId.includes(market.country)) {
        marketCode = market.code;
        break;
      }
    }

    // If no market found, use primary market
    if (!marketCode && markets.length > 0) {
      marketCode = markets[0].code;
    }

    if (!aggregatedByMarket[marketCode]) continue;

    // Parse response data
    const geminiData = response.gemini_response;
    const openaiData = response.openai_response;
    const geminiSources = response.gemini_sources || [];
    const openaiSources = response.openai_sources || [];

    // Extract category ID from question_id if present
    let categoryId = null;
    let categoryName = null;
    for (const cat of categoryFamilies) {
      if (questionId.includes(cat.id)) {
        categoryId = cat.id;
        categoryName = cat.translations?.[marketCode]?.name || cat.canonical_name;
        break;
      }
    }

    const responseData = {
      question: {
        id: response.question_id,
        question: response.question_text,
        categoryId,
        categoryName
      },
      gemini: {
        data: geminiData,
        sources: geminiSources,
        error: null
      },
      openai: {
        data: openaiData,
        sources: openaiSources,
        error: null
      }
    };

    // Add to appropriate bucket
    const type = response.analysis_type;
    if (aggregatedByMarket[marketCode].rawResponses[type]) {
      aggregatedByMarket[marketCode].rawResponses[type].push(responseData);
    }

    // Collect sources
    allSources.push(...geminiSources, ...openaiSources);
  }

  // Deduplicate sources
  const uniqueSources = [];
  const seenUrls = new Set();
  allSources.forEach(s => {
    if (s.url && !seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      uniqueSources.push(s);
    }
  });

  // Classify sources
  console.log('\n🔍 ========== CLASSIFYING SOURCES ==========');
  let classifiedSources = uniqueSources;
  if (geminiApiKey && uniqueSources.length > 0) {
    try {
      const allCompetitors = [...new Set(
        Object.values(competitors).flatMap(mc => Object.values(mc).flat())
      )];
      classifiedSources = await classifySourceTypes(uniqueSources, entity, geminiApiKey, allCompetitors);
      console.log(`✅ Classified ${classifiedSources.length} sources`);
    } catch (error) {
      console.error('⚠️ Source classification failed:', error.message);
    }
  }

  // Enrich YouTube sources
  try {
    classifiedSources = await enrichSourcesWithYouTubeMetadata(classifiedSources);
  } catch (error) {
    console.error('⚠️ YouTube metadata enrichment failed:', error.message);
  }

  // Save sources
  classifiedSources.forEach(source => {
    try {
      Report.saveSource(reportId, {
        url: source.url,
        resolvedUrl: source.url,
        title: source.title || '',
        domain: source.domain || '',
        sourceType: source.source_type || 'Other',
        competitorName: source.competitor_name || null,
        youtubeChannel: source.youtube_channel || null,
        confidence: source.classification_confidence || 'low',
        reasoning: source.classification_reasoning || '',
        citedBy: source.cited_by || []
      });
    } catch (err) {
      // Ignore duplicate errors
    }
  });

  // Aggregation per market
  console.log('\n🔄 ========== AGGREGATING RESULTS ==========');

  const allAggregated = {};

  for (const [marketCode, marketData] of Object.entries(aggregatedByMarket)) {
    const { config: marketConfig, rawResponses } = marketData;
    console.log(`📊 Aggregating ${marketCode}...`);

    const marketAggregated = { reputation: null, categories_associated: null, categories: {} };

    // Reputation aggregation
    if (rawResponses.reputation.length > 0) {
      try {
        const reputationAnalysis = await aggregateReputationAnalysis(rawResponses.reputation, marketConfig);
        Report.saveMarketAnalysisResult(reportId, marketCode, 'reputation', reputationAnalysis);
        marketAggregated.reputation = reputationAnalysis;
        console.log(`   ✅ ${marketCode} reputation aggregated`);
      } catch (err) {
        console.error(`   ❌ ${marketCode} reputation failed:`, err.message);
      }
    }

    // Category detection aggregation
    if (rawResponses.category?.length > 0) {
      try {
        const categoryAssociation = aggregateCategoryAnalysis(rawResponses.category, marketConfig);
        Report.saveMarketAnalysisResult(reportId, marketCode, 'categories_associated', categoryAssociation);
        marketAggregated.categories_associated = categoryAssociation;
        console.log(`   ✅ ${marketCode} categories associated aggregated`);
      } catch (err) {
        console.error(`   ❌ ${marketCode} categories failed:`, err.message);
      }
    }

    // Per-category aggregation
    const categoryIds = [...new Set(
      [...rawResponses.visibility, ...rawResponses.competitive]
        .map(r => r.question.categoryId)
        .filter(Boolean)
    )];

    for (const categoryId of categoryIds) {
      const catVisResponses = rawResponses.visibility.filter(r => r.question.categoryId === categoryId);
      const catCompResponses = rawResponses.competitive.filter(r => r.question.categoryId === categoryId);
      const catName = catVisResponses[0]?.question.categoryName || catCompResponses[0]?.question.categoryName;
      const catCompetitors = competitors?.[categoryId]?.[marketCode] || [];

      const categoryConfig = {
        ...marketConfig,
        category: catName,
        competitors: catCompetitors
      };

      // Visibility aggregation
      if (catVisResponses.length > 0) {
        try {
          const visAnalysis = await aggregateVisibilityAnalysis(catVisResponses, categoryConfig, {
            geminiApiKey,
            enableBrandGrouping: true
          });
          Report.saveMarketAnalysisResult(reportId, marketCode, 'visibility', visAnalysis, categoryId);
          console.log(`   ✅ ${marketCode}/${catName} visibility aggregated`);

          if (!marketAggregated.categories[categoryId]) {
            marketAggregated.categories[categoryId] = { name: catName };
          }
          marketAggregated.categories[categoryId].visibility = visAnalysis;
        } catch (err) {
          console.error(`   ❌ ${marketCode}/${catName} visibility failed:`, err.message);
        }
      }

      // Competitive aggregation
      if (catCompResponses.length > 0) {
        try {
          const compAnalysis = await aggregateVisibilityAnalysis(catCompResponses, categoryConfig, {
            geminiApiKey,
            enableBrandGrouping: true
          });
          Report.saveMarketAnalysisResult(reportId, marketCode, 'competitive', compAnalysis, categoryId);
          console.log(`   ✅ ${marketCode}/${catName} competitive aggregated`);

          if (!marketAggregated.categories[categoryId]) {
            marketAggregated.categories[categoryId] = { name: catName };
          }
          marketAggregated.categories[categoryId].competitive = compAnalysis;
        } catch (err) {
          console.error(`   ❌ ${marketCode}/${catName} competitive failed:`, err.message);
        }
      }
    }

    allAggregated[marketCode] = marketAggregated;
  }

  // PR Insights
  console.log('\n💡 ========== GENERATING PR INSIGHTS ==========');
  const primaryMarket = markets.find(m => m.isPrimary) || markets[0];
  const primaryAggregated = allAggregated[primaryMarket?.code];

  if (primaryAggregated) {
    try {
      const aggregatedForPR = {
        reputation: primaryAggregated.reputation,
        visibility: Object.values(primaryAggregated.categories)[0]?.visibility,
        competitive: Object.values(primaryAggregated.categories)[0]?.competitive,
        competitive_metrics: Object.values(primaryAggregated.categories)[0]?.competitive
      };

      const prInsights = aggregatePRInsights(aggregatedForPR, {
        entity,
        category: categoryFamilies[0]?.canonical_name,
        competitors: competitors?.[categoryFamilies[0]?.id]?.[primaryMarket.code] || []
      }, classifiedSources);

      Report.savePRInsights(reportId, prInsights);
      Report.saveAnalysisResult(reportId, 'pr_insights', {
        analysis_type: 'pr_insights',
        entity,
        total_opportunities: prInsights.opportunities?.length || 0,
        priority_summary: prInsights.priority_summary
      });

      console.log(`✅ Generated ${prInsights.opportunities?.length || 0} opportunities`);
    } catch (prError) {
      console.error('⚠️ PR Insights failed:', prError.message);
    }
  }
}

/**
 * Resume single-market analysis (aggregation phase only)
 */
async function resumeSingleMarketAnalysis(reportId, config, geminiApiKey) {
  const { entity, category, competitors, llmResponses } = config;

  // Reconstruct raw responses structure
  const rawResponses = {
    reputation: [],
    visibility: [],
    competitive: [],
    category: []
  };

  const allSources = [];

  for (const response of llmResponses) {
    const geminiData = response.gemini_response;
    const openaiData = response.openai_response;
    const geminiSources = response.gemini_sources || [];
    const openaiSources = response.openai_sources || [];

    const responseData = {
      question: {
        id: response.question_id,
        question: response.question_text
      },
      gemini: {
        data: geminiData,
        sources: geminiSources,
        error: null
      },
      openai: {
        data: openaiData,
        sources: openaiSources,
        error: null
      }
    };

    const type = response.analysis_type;
    if (rawResponses[type]) {
      rawResponses[type].push(responseData);
    }

    allSources.push(...geminiSources, ...openaiSources);
  }

  // Deduplicate and classify sources
  const uniqueSources = [];
  const seenUrls = new Set();
  allSources.forEach(s => {
    if (s.url && !seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      uniqueSources.push(s);
    }
  });

  let classifiedSources = uniqueSources;
  if (geminiApiKey && uniqueSources.length > 0) {
    try {
      classifiedSources = await classifySourceTypes(uniqueSources, entity, geminiApiKey, competitors);
      console.log(`✅ Classified ${classifiedSources.length} sources`);
    } catch (error) {
      console.error('⚠️ Source classification failed:', error.message);
    }
  }

  // Save sources
  classifiedSources.forEach(source => {
    try {
      Report.saveSource(reportId, {
        url: source.url,
        resolvedUrl: source.url,
        title: source.title || '',
        domain: source.domain || '',
        sourceType: source.source_type || 'Other',
        competitorName: source.competitor_name || null,
        confidence: source.classification_confidence || 'low',
        reasoning: source.classification_reasoning || '',
        citedBy: source.cited_by || []
      });
    } catch (err) {
      // Ignore duplicate errors
    }
  });

  // Aggregation
  console.log('\n🔄 ========== AGGREGATING RESULTS ==========');
  const aggregatedAnalysis = {};
  const analysisConfig = { entity, category, competitors };

  // Reputation
  if (rawResponses.reputation.length > 0) {
    console.log(`📊 Aggregating reputation (${rawResponses.reputation.length} responses)...`);
    const reputationAnalysis = await aggregateReputationAnalysis(rawResponses.reputation, analysisConfig);
    Report.saveAnalysisResult(reportId, 'reputation', reputationAnalysis);
    aggregatedAnalysis.reputation = reputationAnalysis;
    console.log(`   ✅ Reputation aggregated`);
  }

  // Visibility
  if (rawResponses.visibility.length > 0) {
    console.log(`👁️ Aggregating visibility (${rawResponses.visibility.length} responses)...`);
    const visibilityAnalysis = await aggregateVisibilityAnalysis(rawResponses.visibility, analysisConfig, {
      geminiApiKey,
      enableBrandGrouping: true
    });
    Report.saveAnalysisResult(reportId, 'visibility', visibilityAnalysis);
    aggregatedAnalysis.visibility = visibilityAnalysis;
    console.log(`   ✅ Visibility aggregated`);
  }

  // Competitive
  if (rawResponses.competitive.length > 0) {
    console.log(`⚔️ Aggregating competitive (${rawResponses.competitive.length} responses)...`);
    const competitiveAnalysis = await aggregateVisibilityAnalysis(rawResponses.competitive, analysisConfig, {
      geminiApiKey,
      enableBrandGrouping: true
    });
    Report.saveAnalysisResult(reportId, 'competitive', competitiveAnalysis);
    aggregatedAnalysis.competitive = competitiveAnalysis;
    aggregatedAnalysis.competitive_metrics = competitiveAnalysis;
    console.log(`   ✅ Competitive aggregated`);
  }

  // Category detection
  if (rawResponses.category.length > 0) {
    console.log(`📂 Aggregating categories (${rawResponses.category.length} responses)...`);
    const categoryAnalysis = aggregateCategoryAnalysis(rawResponses.category, analysisConfig);
    Report.saveAnalysisResult(reportId, 'categories_associated', categoryAnalysis);
    aggregatedAnalysis.categories_associated = categoryAnalysis;
    console.log(`   ✅ Categories aggregated`);
  }

  // PR Insights
  console.log('\n💡 ========== GENERATING PR INSIGHTS ==========');
  try {
    const prInsights = aggregatePRInsights(aggregatedAnalysis, analysisConfig, classifiedSources);
    Report.savePRInsights(reportId, prInsights);
    Report.saveAnalysisResult(reportId, 'pr_insights', {
      analysis_type: 'pr_insights',
      entity,
      total_opportunities: prInsights.opportunities?.length || 0,
      priority_summary: prInsights.priority_summary
    });
    console.log(`✅ Generated ${prInsights.opportunities?.length || 0} opportunities`);
  } catch (prError) {
    console.error('⚠️ PR Insights failed:', prError.message);
  }
}
