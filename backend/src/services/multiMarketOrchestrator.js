/**
 * Multi-Market Analysis Orchestrator
 * Coordinates analysis across multiple markets and categories
 * Optimized with parallel batch processing
 */

import { Report } from '../models/Report.js';
import { callBothLLMs, callGeminiOnly } from './llmService.js';
import { buildReputationPrompt, buildVisibilityPrompt, buildCompetitivePrompt, buildCategoryDetectionPrompt } from './promptBuilder.js';
import { sendProgressUpdate, closeProgressConnection } from '../routes/analysis.js';
import { parseJSON } from '../utils/jsonParser.js';
import { aggregateReputationAnalysis } from './aggregators/reputationAggregatorAI.js';
import { aggregateVisibilityAnalysis } from './aggregators/visibilityAggregator.js';
import { aggregateCategoryAnalysis } from './aggregators/categoryAggregator.js';
import { classifySourceTypes } from './sourceClassifier.js';
import { enrichSourcesWithYouTubeMetadata } from './youtubeMetadata.js';
import { aggregatePRInsights } from './aggregators/prInsightsAggregator.js';
import { buildCategoryDetectionQuestions, buildCompetitiveQuestions, buildVisibilityQuestions } from '../utils/questionTemplates.js';
import { translateQuestions } from './translationService.js';

// No batching - process all questions in parallel
// Testing confirmed both Gemini & OpenAI handle 100+ parallel requests without rate limits
const BATCH_SIZE = 500;

/**
 * Extract and merge sources from parsed JSON data with grounded sources
 */
function extractAndMergeSources(parsedData, groundedSources = []) {
  const allSources = [...groundedSources];
  const seenUrls = new Set(groundedSources.map(s => s.url));

  const extractDomain = (url) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  if (parsedData) {
    if (parsedData.sources_cited_news && Array.isArray(parsedData.sources_cited_news)) {
      parsedData.sources_cited_news.forEach(source => {
        if (source.url && !seenUrls.has(source.url)) {
          seenUrls.add(source.url);
          allSources.push({
            url: source.url,
            domain: extractDomain(source.url),
            title: source.title || source.publisher || '',
            relevance_score: 0.9,
            source_type: 'Journalism'
          });
        }
      });
    }

    if (parsedData.sources_cited_other && Array.isArray(parsedData.sources_cited_other)) {
      parsedData.sources_cited_other.forEach(source => {
        if (source.url && !seenUrls.has(source.url)) {
          seenUrls.add(source.url);
          allSources.push({
            url: source.url,
            domain: extractDomain(source.url),
            title: source.title || '',
            relevance_score: 0.85,
            source_type: 'Other'
          });
        }
      });
    }
  }

  return allSources;
}

/**
 * Process a batch of questions in parallel with retry logic for failed Gemini responses
 */
async function processBatch(batch, geminiApiKey, openaiApiKey, reportId, onProgress) {
  const MAX_GEMINI_RETRIES = 2;
  const RETRY_DELAY_MS = 1000;

  const results = await Promise.all(
    batch.map(async (item) => {
      try {
        let result = await callBothLLMs(item.prompt, geminiApiKey, openaiApiKey, item.config);

        let geminiData = result.gemini.error ? null : parseJSON(result.gemini.text);
        let openaiData = result.openai.error ? null : parseJSON(result.openai.text);

        // Log Gemini errors for debugging
        if (result.gemini.error) {
          console.warn(`   ⚠️ Gemini failed for ${item.question.id}: ${result.gemini.message}`);
        }

        // Retry Gemini if it failed but OpenAI succeeded (only retry Gemini, not both LLMs)
        if (!geminiData && openaiData) {
          for (let retry = 1; retry <= MAX_GEMINI_RETRIES; retry++) {
            console.log(`   🔄 Retrying Gemini for ${item.question.id} (attempt ${retry}/${MAX_GEMINI_RETRIES})...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * retry));

            const retryResult = await callGeminiOnly(item.prompt, geminiApiKey);
            geminiData = retryResult.error ? null : parseJSON(retryResult.text);

            if (geminiData) {
              console.log(`   ✅ Gemini retry ${retry} succeeded for ${item.question.id}`);
              result.gemini = retryResult;
              break;
            } else if (retryResult.error) {
              console.warn(`   ⚠️ Gemini retry ${retry} failed for ${item.question.id}: ${retryResult.message}`);
            }
          }
        }

        // Save to DB
        Report.saveLLMResponse(
          reportId, item.question.id, item.question.question, item.type,
          geminiData, openaiData,
          result.gemini.groundedSources || [], result.openai.groundedSources || []
        );

        if (onProgress) onProgress();

        return {
          ...item,
          gemini: {
            data: geminiData,
            sources: extractAndMergeSources(geminiData, result.gemini.groundedSources || []),
            error: result.gemini.error
          },
          openai: {
            data: openaiData,
            sources: extractAndMergeSources(openaiData, result.openai.groundedSources || []),
            error: result.openai.error
          }
        };
      } catch (error) {
        console.error(`   ❌ ${item.question.id}: ${error.message}`);
        return { ...item, error: error.message };
      }
    })
  );
  return results;
}

/**
 * Run multi-market analysis
 * @param {string} reportId - Report ID
 * @param {Object} config - Full multi-market config from onboarding
 * @param {string} geminiApiKey - Gemini API key
 * @param {string} openaiApiKey - OpenAI API key
 */
export async function runMultiMarketAnalysis(reportId, config, geminiApiKey, openaiApiKey) {
  const startTime = Date.now();
  const { entity, markets, categoryFamilies, competitors, reputationQuestions, categoryQuestions } = config;

  console.log('\n🚀 ========== STARTING MULTI-MARKET ANALYSIS ==========');
  console.log(`📋 Report ID: ${reportId}`);
  console.log(`🏢 Entity: ${entity}`);
  console.log(`🌍 Markets: ${markets.map(m => m.code).join(', ')}`);
  console.log(`📂 Categories: ${categoryFamilies.map(c => c.canonical_name).join(', ')}`);

  // DETAILED LOGGING: Log what questions were received from wizard
  console.log('\n📋 ========== QUESTIONS RECEIVED FROM WIZARD ==========');
  console.log(`🏠 Reputation questions received: ${JSON.stringify(Object.keys(reputationQuestions || {}))}`);
  markets.forEach(market => {
    console.log(`\n  🌍 Market: ${market.code}`);
    const repQ = reputationQuestions?.[market.code] || [];
    console.log(`     📝 Reputation: ${repQ.length} questions`);

    categoryFamilies.forEach(cat => {
      const catQ = categoryQuestions?.[market.code]?.[cat.id] || {};
      console.log(`     📂 Category "${cat.canonical_name}" (${cat.id}):`);
      console.log(`        - Visibility: ${catQ.visibility?.length || 0} questions`);
      console.log(`        - Competitive: ${catQ.competitive?.length || 0} questions`);
      if (catQ.competitive?.length > 0) {
        catQ.competitive.forEach((q, i) => console.log(`          [${i}] ${q.id}: "${q.question?.substring(0, 60)}..."`));
      }
    });
  });
  console.log('========== END QUESTIONS RECEIVED ==========\n');

  try {
    Report.updateStatus(reportId, 'processing', 0);

    sendProgressUpdate(reportId, {
      type: 'status',
      status: 'processing',
      progress: 0,
      message: 'Starting multi-market analysis...'
    });

    // Count total questions
    let totalQuestions = 0;
    markets.forEach(market => {
      // Reputation questions per market
      const repQuestions = reputationQuestions?.[market.code] || [];
      totalQuestions += repQuestions.length;

      // Category detection questions per market (3 questions)
      totalQuestions += 3;

      // Category-specific questions per market
      categoryFamilies.forEach(cat => {
        const catQuestions = categoryQuestions?.[market.code]?.[cat.id] || {};
        totalQuestions += (catQuestions.visibility?.length || 0);
        totalQuestions += (catQuestions.competitive?.length || 0);
      });
    });

    console.log(`\n📝 Total questions to process: ${totalQuestions}`);

    let processedCount = 0;
    const allClassifiedSources = [];
    const aggregatedByMarket = {};

    // ========== PHASE 1: Collect all questions across all markets ==========
    console.log('\n📋 ========== COLLECTING ALL QUESTIONS ==========');
    const allQuestionItems = [];

    for (const market of markets) {
      const marketConfig = {
        entity,
        countries: [market.country],
        languages: [market.language],
        market
      };

      // Reputation questions
      const repQuestions = reputationQuestions?.[market.code] || [];
      for (const question of repQuestions) {
        allQuestionItems.push({
          type: 'reputation',
          marketCode: market.code,
          question,
          prompt: buildReputationPrompt(question.question, entity, marketConfig),
          config: marketConfig
        });
      }

      // Category detection questions (translated if needed)
      let categoryDetectionQuestions = buildCategoryDetectionQuestions(entity);
      if (market.language && market.language.toLowerCase() !== 'english') {
        try {
          const translated = await translateQuestions(
            { category: categoryDetectionQuestions },
            market.language,
            geminiApiKey
          );
          categoryDetectionQuestions = translated.category;
        } catch (err) {
          console.warn(`   ⚠️ Translation failed for ${market.code}, using English`);
        }
      }

      for (const question of categoryDetectionQuestions) {
        allQuestionItems.push({
          type: 'category',
          marketCode: market.code,
          question,
          prompt: buildCategoryDetectionPrompt(question.question, entity, marketConfig),
          config: marketConfig
        });
      }

      // Category-specific questions
      for (const category of categoryFamilies) {
        const catName = category.translations?.[market.code]?.name || category.canonical_name;
        const catCompetitors = competitors?.[category.id]?.[market.code] || [];
        const catQuestions = categoryQuestions?.[market.code]?.[category.id] || {};

        const categoryConfig = {
          ...marketConfig,
          category: catName,
          competitors: catCompetitors
        };

        // Visibility questions
        for (const question of (catQuestions.visibility || [])) {
          allQuestionItems.push({
            type: 'visibility',
            marketCode: market.code,
            categoryId: category.id,
            categoryName: catName,
            question,
            prompt: buildVisibilityPrompt(question.question, catName, entity, categoryConfig),
            config: categoryConfig
          });
        }

        // Competitive questions
        for (const question of (catQuestions.competitive || [])) {
          const entities = [entity, ...catCompetitors];
          allQuestionItems.push({
            type: 'competitive',
            marketCode: market.code,
            categoryId: category.id,
            categoryName: catName,
            question,
            prompt: buildCompetitivePrompt(question.question, entities, catName, categoryConfig),
            config: categoryConfig
          });
        }
      }
    }

    console.log(`📝 Collected ${allQuestionItems.length} questions for parallel processing`);

    // ========== PHASE 2: Process all questions in batches ==========
    console.log('\n🚀 ========== PROCESSING IN BATCHES (size: ' + BATCH_SIZE + ') ==========');

    const allResults = [];
    for (let i = 0; i < allQuestionItems.length; i += BATCH_SIZE) {
      const batch = allQuestionItems.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allQuestionItems.length / BATCH_SIZE);

      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} questions)...`);

      const batchResults = await processBatch(batch, geminiApiKey, openaiApiKey, reportId, () => {
        processedCount++;
        const progress = Math.round((processedCount / totalQuestions) * 70);
        sendProgressUpdate(reportId, {
          type: 'progress',
          progress,
          processedCount,
          totalQuestions,
          currentQuestion: `Batch ${batchNum}/${totalBatches}`,
          currentMarket: batch[0]?.marketCode || ''
        });
      });

      allResults.push(...batchResults);
      console.log(`   ✅ Batch ${batchNum} complete`);
    }

    // ========== PHASE 3: Organize results by market ==========
    console.log('\n📊 ========== ORGANIZING RESULTS BY MARKET ==========');

    for (const market of markets) {
      const marketConfig = {
        entity,
        countries: [market.country],
        languages: [market.language],
        market
      };

      const marketRawResponses = {
        reputation: [],
        category: [],
        visibility: [],
        competitive: []
      };

      // Filter results for this market
      const marketResults = allResults.filter(r => r.marketCode === market.code && !r.error);

      for (const result of marketResults) {
        const responseData = {
          question: result.categoryId
            ? { ...result.question, categoryId: result.categoryId, categoryName: result.categoryName }
            : result.question,
          gemini: result.gemini,
          openai: result.openai
        };

        marketRawResponses[result.type].push(responseData);

        // Collect sources
        if (result.gemini?.sources) allClassifiedSources.push(...result.gemini.sources);
        if (result.openai?.sources) allClassifiedSources.push(...result.openai.sources);
      }

      aggregatedByMarket[market.code] = {
        config: marketConfig,
        rawResponses: marketRawResponses
      };

      console.log(`   ✅ ${market.code}: ${marketResults.length} responses organized`);
    }

    // Source Classification
    console.log('\n🔍 ========== CLASSIFYING SOURCES ==========');
    sendProgressUpdate(reportId, {
      type: 'status',
      status: 'classifying',
      progress: 75,
      message: 'Classifying sources...'
    });

    const uniqueSources = [];
    const seenUrls = new Set();
    allClassifiedSources.forEach(s => {
      if (s.url && !seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        uniqueSources.push(s);
      }
    });

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

    // Enrich YouTube sources with video titles and channel names
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

    // Create URL -> classification map for merging
    const classificationMap = new Map();
    classifiedSources.forEach(source => {
      if (source.url) {
        classificationMap.set(source.url, {
          source_type: source.source_type || 'Other',
          classification_confidence: source.classification_confidence,
          classification_reasoning: source.classification_reasoning,
          competitor_name: source.competitor_name || null
        });
      }
    });

    // Merge classified source data back into raw responses
    for (const marketData of Object.values(aggregatedByMarket)) {
      const { rawResponses } = marketData;

      // Helper to update sources in a response
      const updateSourcesInResponse = (response) => {
        ['gemini', 'openai'].forEach(llm => {
          if (response[llm]?.sources && Array.isArray(response[llm].sources)) {
            response[llm].sources = response[llm].sources.map(source => {
              const classification = classificationMap.get(source.url);
              if (classification) {
                return {
                  ...source,
                  source_type: classification.source_type,
                  classification_confidence: classification.classification_confidence,
                  classification_reasoning: classification.classification_reasoning,
                  competitor_name: classification.competitor_name
                };
              }
              return source;
            });
          }
        });
      };

      // Update all response types
      ['reputation', 'category', 'visibility', 'competitive'].forEach(type => {
        if (rawResponses[type] && Array.isArray(rawResponses[type])) {
          rawResponses[type].forEach(updateSourcesInResponse);
        }
      });
    }

    console.log(`✅ Merged source classifications into ${classificationMap.size} unique sources`);

    // Aggregation per market - PARALLELIZED
    console.log('\n🔄 ========== AGGREGATING RESULTS (PARALLEL) ==========');
    sendProgressUpdate(reportId, {
      type: 'status',
      status: 'aggregating',
      progress: 85,
      message: 'Aggregating results per market...'
    });

    // Process all markets in parallel
    const marketAggregationPromises = Object.entries(aggregatedByMarket).map(async ([marketCode, marketData]) => {
      const { config: marketConfig, rawResponses } = marketData;
      console.log(`📊 Aggregating ${marketCode}...`);

      const marketAggregated = { reputation: null, categories_associated: null, categories: {} };

      // Run reputation and category detection in parallel
      const [reputationAnalysis, categoryAssociation] = await Promise.all([
        rawResponses.reputation.length > 0
          ? aggregateReputationAnalysis(rawResponses.reputation, marketConfig)
          : Promise.resolve(null),
        rawResponses.category?.length > 0
          ? Promise.resolve(aggregateCategoryAnalysis(rawResponses.category, marketConfig))
          : Promise.resolve(null)
      ]);

      if (reputationAnalysis) {
        Report.saveMarketAnalysisResult(reportId, marketCode, 'reputation', reputationAnalysis);
        marketAggregated.reputation = reputationAnalysis;
        console.log(`   ✅ ${marketCode} reputation aggregated`);
      }

      if (categoryAssociation) {
        Report.saveMarketAnalysisResult(reportId, marketCode, 'categories_associated', categoryAssociation);
        marketAggregated.categories_associated = categoryAssociation;
        console.log(`   ✅ ${marketCode} categories associated aggregated`);
      }

      // Get all category IDs
      const categoryIds = [...new Set(
        [...rawResponses.visibility, ...rawResponses.competitive]
          .map(r => r.question.categoryId)
          .filter(Boolean)
      )];

      // Process all categories in parallel
      const categoryPromises = categoryIds.map(async (categoryId) => {
        const catVisResponses = rawResponses.visibility.filter(r => r.question.categoryId === categoryId);
        const catCompResponses = rawResponses.competitive.filter(r => r.question.categoryId === categoryId);
        const catName = catVisResponses[0]?.question.categoryName || catCompResponses[0]?.question.categoryName;
        const catCompetitors = competitors?.[categoryId]?.[marketCode] || [];

        const categoryConfig = {
          ...marketConfig,
          category: catName,
          competitors: catCompetitors
        };

        // Run visibility and competitive aggregations in parallel
        const [visAnalysis, compAnalysis] = await Promise.all([
          catVisResponses.length > 0
            ? aggregateVisibilityAnalysis(catVisResponses, categoryConfig, { geminiApiKey, enableBrandGrouping: true })
            : Promise.resolve(null),
          catCompResponses.length > 0
            ? aggregateVisibilityAnalysis(catCompResponses, categoryConfig, { geminiApiKey, enableBrandGrouping: true })
            : Promise.resolve(null)
        ]);

        if (visAnalysis) {
          Report.saveMarketAnalysisResult(reportId, marketCode, 'visibility', visAnalysis, categoryId);
          console.log(`   ✅ ${marketCode}/${catName} visibility aggregated`);
        }

        if (compAnalysis) {
          Report.saveMarketAnalysisResult(reportId, marketCode, 'competitive', compAnalysis, categoryId);
          console.log(`   ✅ ${marketCode}/${catName} competitive aggregated`);
        }

        return {
          categoryId,
          name: catName,
          visibility: visAnalysis,
          competitive: compAnalysis
        };
      });

      const categoryResults = await Promise.all(categoryPromises);
      categoryResults.forEach(cat => {
        marketAggregated.categories[cat.categoryId] = {
          name: cat.name,
          visibility: cat.visibility,
          competitive: cat.competitive
        };
      });

      return { marketCode, aggregated: marketAggregated };
    });

    const marketResults = await Promise.all(marketAggregationPromises);
    const allAggregated = {};
    marketResults.forEach(({ marketCode, aggregated }) => {
      allAggregated[marketCode] = aggregated;
    });

    console.log(`✅ All ${Object.keys(allAggregated).length} markets aggregated in parallel`)

    // PR Insights (use primary market for now)
    console.log('\n💡 ========== GENERATING PR INSIGHTS ==========');
    sendProgressUpdate(reportId, {
      type: 'status',
      status: 'insights',
      progress: 95,
      message: 'Generating PR insights...'
    });

    const primaryMarket = markets.find(m => m.isPrimary) || markets[0];
    const primaryAggregated = allAggregated[primaryMarket.code];

    if (primaryAggregated) {
      try {
        // Build aggregated analysis structure for PR insights
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

    // Complete
    const executionTime = Math.round((Date.now() - startTime) / 1000);
    Report.updateExecutionTime(reportId, executionTime);
    Report.updateStatus(reportId, 'completed', 100);

    console.log('\n✨ ========== ANALYSIS COMPLETE ==========');
    console.log(`⏱️  Total execution time: ${executionTime}s`);
    console.log(`📈 Questions processed: ${processedCount}/${totalQuestions}`);
    console.log(`🌍 Markets: ${Object.keys(aggregatedByMarket).join(', ')}`);

    sendProgressUpdate(reportId, {
      type: 'complete',
      status: 'completed',
      progress: 100,
      message: 'Analysis complete!',
      executionTime
    });

    setTimeout(() => closeProgressConnection(reportId), 1000);

  } catch (error) {
    console.error('\n❌ ========== ANALYSIS FAILED ==========');
    console.error('Error:', error);

    Report.updateStatus(reportId, 'failed', null, error.message);

    sendProgressUpdate(reportId, {
      type: 'error',
      status: 'failed',
      message: error.message
    });

    closeProgressConnection(reportId);
  }
}
