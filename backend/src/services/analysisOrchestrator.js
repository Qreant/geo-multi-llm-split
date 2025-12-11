/**
 * Analysis Orchestrator
 * Main service that coordinates the entire analysis workflow
 */

import { Report } from '../models/Report.js';
import { callBothLLMs } from './llmService.js';
import { buildReputationPrompt, buildVisibilityPrompt, buildCompetitivePrompt, buildCategoryDetectionPrompt } from './promptBuilder.js';
import { sendProgressUpdate, closeProgressConnection } from '../routes/analysis.js';
import { parseJSON, sanitizeJSON } from '../utils/jsonParser.js';
import { aggregateReputationAnalysis } from './aggregators/reputationAggregatorAI.js';
import { aggregateVisibilityAnalysis } from './aggregators/visibilityAggregator.js';
import { aggregateCategoryAnalysis } from './aggregators/categoryAggregator.js';
import { classifySourceTypes } from './sourceClassifier.js';
import { aggregatePRInsights } from './aggregators/prInsightsAggregator.js';
import { batchGenerateCollaborations } from './aiCollaborationService.js';
import { batchFetchLogos } from './logoService.js';

/**
 * Extract and merge sources from parsed JSON data with grounded sources
 * Combines sources_cited_news and sources_cited_other from JSON with grounding API sources
 * @param {Object} parsedData - Parsed JSON response from LLM
 * @param {Array} groundedSources - Sources from grounding API metadata
 * @returns {Array} Combined array of all sources
 */
function extractAndMergeSources(parsedData, groundedSources = []) {
  const allSources = [...groundedSources];
  const seenUrls = new Set(groundedSources.map(s => s.url));

  // Helper to safely extract domain from URL
  const extractDomain = (url) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  if (parsedData) {
    // Extract sources_cited_news
    if (parsedData.sources_cited_news && Array.isArray(parsedData.sources_cited_news)) {
      parsedData.sources_cited_news.forEach(source => {
        if (source.url && !seenUrls.has(source.url)) {
          seenUrls.add(source.url);
          allSources.push({
            url: source.url,
            domain: extractDomain(source.url),
            title: source.title || source.publisher || '',
            relevance_score: 0.9,
            source_type: 'Journalism',
            youtube_channel: source.youtube_channel || null
          });
        }
      });
    }

    // Extract sources_cited_other
    if (parsedData.sources_cited_other && Array.isArray(parsedData.sources_cited_other)) {
      parsedData.sources_cited_other.forEach(source => {
        if (source.url && !seenUrls.has(source.url)) {
          seenUrls.add(source.url);
          allSources.push({
            url: source.url,
            domain: extractDomain(source.url),
            title: source.title || '',
            relevance_score: 0.85,
            source_type: 'Other',
            youtube_channel: source.youtube_channel || null
          });
        }
      });
    }
  }

  return allSources;
}

/**
 * Main function to run complete analysis
 */
export async function runAnalysis(reportId, questions, config, geminiApiKey, openaiApiKey) {
  const startTime = Date.now();
  console.log('\n🚀 ========== STARTING ANALYSIS ==========');
  console.log(`📋 Report ID: ${reportId}`);
  console.log(`🏢 Entity: ${config.entity}`);
  console.log(`📂 Category: ${config.category}`);
  console.log(`🌍 Countries: ${config.countries?.length ? config.countries.join(', ') : 'None'}`);
  console.log(`🗣️ Languages: ${config.languages?.length ? config.languages.join(', ') : 'None'}`);
  console.log(`🔑 Gemini API Key: ${geminiApiKey ? '✓ Set' : '✗ Missing'}`);
  console.log(`🔑 OpenAI API Key: ${openaiApiKey ? '✓ Set' : '✗ Missing'}`);

  try {
    // Update status to processing
    Report.updateStatus(reportId, 'processing', 0);
    console.log('📊 Updated report status to processing');

    sendProgressUpdate(reportId, {
      type: 'status',
      status: 'processing',
      progress: 0,
      message: 'Starting analysis...'
    });

    // Flatten all questions into a single array
    const allQuestions = [];
    Object.entries(questions).forEach(([analysisType, questionList]) => {
      questionList.forEach(q => {
        allQuestions.push({ ...q, analysisType });
      });
    });

    const totalQuestions = allQuestions.length;
    console.log(`\n📝 Total questions to process: ${totalQuestions}`);
    console.log(`   - Reputation: ${questions.reputation?.length || 0}`);
    console.log(`   - Visibility: ${questions.visibility?.length || 0}`);
    console.log(`   - Competitive: ${questions.competitive?.length || 0}`);

    let processedCount = 0;

    // Process all questions
    const rawResponses = {
      reputation: [],
      visibility: [],
      competitive: [],
      category: []
    };

    // Process questions in batches
    // Rate limiting happens at individual call level (5s between calls = 12 RPM)
    // Batch size determines parallelism, not rate - can process more in parallel
    const BATCH_SIZE = 15;
    for (let i = 0; i < allQuestions.length; i += BATCH_SIZE) {
      const batch = allQuestions.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const batchPromises = batch.map(async (question) => {
        const questionStart = Date.now();
        console.log(`\n❓ Processing ${question.id}: ${question.question.substring(0, 80)}...`);

        try {
          // Build prompt based on analysis type
          let prompt;
          if (question.type === 'reputation') {
            prompt = buildReputationPrompt(question.question, config.entity, config);
          } else if (question.type === 'visibility') {
            prompt = buildVisibilityPrompt(question.question, config.category, config.entity, config);
          } else if (question.type === 'competitive') {
            const entities = [config.entity, ...(config.competitors || [])];
            prompt = buildCompetitivePrompt(question.question, entities, config.category, config);
          } else if (question.type === 'category') {
            prompt = buildCategoryDetectionPrompt(question.question, config.entity, config);
          }

          console.log(`   🔧 Built ${question.type} prompt`);

          // Call both LLMs
          console.log(`   📡 Calling Gemini & OpenAI APIs...`);
          const result = await callBothLLMs(prompt, geminiApiKey, openaiApiKey, config);

          const questionTime = ((Date.now() - questionStart) / 1000).toFixed(2);
          console.log(`   ✅ Received responses in ${questionTime}s`);
          console.log(`      - Gemini: ${result.gemini.error ? '❌ Error' : '✓ Success'} (${result.gemini.groundedSources?.length || 0} sources)`);
          console.log(`      - OpenAI: ${result.openai.error ? '❌ Error' : '✓ Success'} (${result.openai.groundedSources?.length || 0} sources)`);

          processedCount++;
          const progress = Math.round((processedCount / totalQuestions) * 100);

          // Send progress update
          sendProgressUpdate(reportId, {
            type: 'progress',
            progress,
            processedCount,
            totalQuestions,
            currentQuestion: question.question
          });

          // Update report progress
          Report.updateStatus(reportId, 'processing', progress);

          // Parse JSON responses
          const geminiData = result.gemini.error ? null : parseJSON(result.gemini.text);
          const openaiData = result.openai.error ? null : parseJSON(result.openai.text);

          // Save LLM response to database
          Report.saveLLMResponse(
            reportId,
            question.id,
            question.question,
            question.type,
            geminiData,
            openaiData,
            result.gemini.groundedSources || [],
            result.openai.groundedSources || []
          );

          // Extract and merge sources from JSON content with grounded sources
          const geminiSources = extractAndMergeSources(geminiData, result.gemini.groundedSources || []);
          const openaiSources = extractAndMergeSources(openaiData, result.openai.groundedSources || []);

          return {
            question,
            gemini: {
              data: geminiData,
              sources: geminiSources,
              error: result.gemini.error
            },
            openai: {
              data: openaiData,
              sources: openaiSources,
              error: result.openai.error
            }
          };
        } catch (error) {
          console.error(`Error processing question ${question.id}:`, error);
          return {
            question,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Organize results by type
      batchResults.forEach(result => {
        if (!result.error && result.question.type) {
          if (result.question.type === 'reputation') {
            rawResponses.reputation.push(result);
          } else if (result.question.type === 'visibility') {
            rawResponses.visibility.push(result);
          } else if (result.question.type === 'competitive') {
            rawResponses.competitive.push(result);
          } else if (result.question.type === 'category') {
            rawResponses.category.push(result);
          }
        }
      });
    }

    // Source Classification phase
    console.log('\n🔍 ========== CLASSIFYING SOURCES ==========');
    sendProgressUpdate(reportId, {
      type: 'status',
      status: 'classifying',
      progress: 85,
      message: 'Classifying sources with AI...'
    });

    // Collect all unique sources from all responses
    const sourcesMap = new Map();
    Object.values(rawResponses).forEach(responses => {
      responses.forEach(response => {
        // Collect from Gemini sources
        if (response.gemini?.sources) {
          response.gemini.sources.forEach(source => {
            if (source.url && !sourcesMap.has(source.url)) {
              sourcesMap.set(source.url, {
                url: source.url,
                title: source.title || source.domain || '',
                domain: source.domain || new URL(source.url).hostname.replace(/^www\./, ''),
                cited_by: []
              });
            }
            const sourceData = sourcesMap.get(source.url);
            if (sourceData && !sourceData.cited_by.includes('gemini')) {
              sourceData.cited_by.push('gemini');
            }
          });
        }

        // Collect from OpenAI sources
        if (response.openai?.sources) {
          response.openai.sources.forEach(source => {
            if (source.url && !sourcesMap.has(source.url)) {
              sourcesMap.set(source.url, {
                url: source.url,
                title: source.title || source.domain || '',
                domain: source.domain || new URL(source.url).hostname.replace(/^www\./, ''),
                cited_by: []
              });
            }
            const sourceData = sourcesMap.get(source.url);
            if (sourceData && !sourceData.cited_by.includes('openai')) {
              sourceData.cited_by.push('openai');
            }
          });
        }
      });
    });

    const uniqueSources = Array.from(sourcesMap.values());
    console.log(`📚 Collected ${uniqueSources.length} unique sources across all responses`);

    // Classify sources using AI (Gemini API) with ownership detection
    let classifiedSources = uniqueSources;
    if (geminiApiKey && uniqueSources.length > 0) {
      try {
        // Pass competitors for ownership detection (owned vs competitor vs third-party)
        const competitors = config.competitors || [];
        classifiedSources = await classifySourceTypes(uniqueSources, config.entity, geminiApiKey, competitors);
        console.log(`✅ Successfully classified ${classifiedSources.length} sources`);
      } catch (error) {
        console.error('⚠️ Source classification failed:', error.message);
        console.log('   Continuing with unclassified sources...');
      }
    } else {
      console.log('⚠️ Skipping source classification (no API key or no sources)');
    }

    // Merge classifications back into rawResponses
    const classificationMap = new Map(classifiedSources.map(s => [s.url, s]));
    Object.values(rawResponses).forEach(responses => {
      responses.forEach(response => {
        // Update Gemini sources
        if (response.gemini?.sources) {
          response.gemini.sources = response.gemini.sources.map(source => {
            const classified = classificationMap.get(source.url);
            return classified ? { ...source, ...classified } : source;
          });
        }

        // Update OpenAI sources
        if (response.openai?.sources) {
          response.openai.sources = response.openai.sources.map(source => {
            const classified = classificationMap.get(source.url);
            return classified ? { ...source, ...classified } : source;
          });
        }
      });
    });

    console.log('✅ Classifications merged back into responses');

    // Save classified sources to database
    console.log(`💾 Saving ${classifiedSources.length} classified sources to database...`);
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
        console.error(`   Failed to save source ${source.url}:`, err.message);
      }
    });
    console.log(`   ✅ Sources saved to database`);

    // Logo fetching phase (non-blocking, graceful failure)
    const uniqueDomains = [...new Set(classifiedSources.map(s => s.domain).filter(Boolean))];
    if (uniqueDomains.length > 0 && process.env.LOGO_API_KEY) {
      console.log(`\n🖼️ Fetching logos for ${uniqueDomains.length} domains...`);
      sendProgressUpdate(reportId, {
        type: 'status',
        status: 'fetching_logos',
        progress: 87,
        message: 'Fetching domain logos...'
      });
      try {
        await batchFetchLogos(uniqueDomains);
        console.log(`   ✅ Logos cached for ${uniqueDomains.length} domains`);
      } catch (logoError) {
        console.warn(`   ⚠️ Logo fetching failed (non-critical): ${logoError.message}`);
      }
    }

    // Aggregation phase
    console.log('\n🔄 ========== AGGREGATING RESULTS ==========');
    sendProgressUpdate(reportId, {
      type: 'status',
      status: 'aggregating',
      progress: 90,
      message: 'Aggregating results...'
    });

    // Store aggregated results for PR insights
    const aggregatedAnalysis = {};

    // Aggregate reputation analysis
    if (rawResponses.reputation.length > 0) {
      console.log(`📊 Aggregating reputation analysis (${rawResponses.reputation.length} responses)...`);
      const reputationAnalysis = await aggregateReputationAnalysis(rawResponses.reputation, config);
      Report.saveAnalysisResult(reportId, 'reputation', reputationAnalysis);
      aggregatedAnalysis.reputation = reputationAnalysis;
      console.log(`   ✅ Reputation analysis saved`);
    }

    // Aggregate visibility analysis (with brand family grouping)
    if (rawResponses.visibility.length > 0) {
      console.log(`👁️ Aggregating visibility analysis (${rawResponses.visibility.length} responses)...`);
      const visibilityAnalysis = await aggregateVisibilityAnalysis(rawResponses.visibility, config, {
        geminiApiKey,
        enableBrandGrouping: true
      });
      Report.saveAnalysisResult(reportId, 'visibility', visibilityAnalysis);
      aggregatedAnalysis.visibility = visibilityAnalysis;
      console.log(`   ✅ Visibility analysis saved`);
    }

    // Aggregate competitive analysis (with brand family grouping)
    if (rawResponses.competitive.length > 0) {
      console.log(`⚔️ Aggregating competitive analysis (${rawResponses.competitive.length} responses)...`);
      const competitiveAnalysis = await aggregateVisibilityAnalysis(rawResponses.competitive, config, {
        geminiApiKey,
        enableBrandGrouping: true
      });
      Report.saveAnalysisResult(reportId, 'competitive', competitiveAnalysis);
      // Set both keys for PR Insights compatibility
      aggregatedAnalysis.competitive = competitiveAnalysis;
      aggregatedAnalysis.competitive_metrics = competitiveAnalysis;
      aggregatedAnalysis.competitive_opportunities = competitiveAnalysis;
      console.log(`   ✅ Competitive analysis saved`);
    }

    // Aggregate category detection analysis
    if (rawResponses.category.length > 0) {
      console.log(`📂 Aggregating category analysis (${rawResponses.category.length} responses)...`);
      const categoryAnalysis = aggregateCategoryAnalysis(rawResponses.category, config);
      Report.saveAnalysisResult(reportId, 'categories_associated', categoryAnalysis);
      aggregatedAnalysis.categories_associated = categoryAnalysis;
      console.log(`   ✅ Category analysis saved (${categoryAnalysis.categories?.length || 0} categories)`);
    }

    // PR Insights generation phase
    console.log('\n💡 ========== GENERATING PR INSIGHTS ==========');
    sendProgressUpdate(reportId, {
      type: 'status',
      status: 'insights',
      progress: 95,
      message: 'Generating PR insights and recommendations...'
    });

    try {
      // Generate PR insights from aggregated analysis
      // Pass all classified sources for comprehensive PR target analysis
      const prInsights = aggregatePRInsights(aggregatedAnalysis, config, classifiedSources);
      console.log(`📊 Generated ${prInsights.opportunities?.length || 0} improvement opportunities`);
      console.log(`   - Critical: ${prInsights.priority_summary?.critical || 0}`);
      console.log(`   - Strategic: ${prInsights.priority_summary?.strategic || 0}`);
      console.log(`   - Quick Wins: ${prInsights.priority_summary?.quick_wins || 0}`);
      console.log(`   - Low Priority: ${prInsights.priority_summary?.low_priority || 0}`);

      // Generate AI collaboration recommendations for top opportunities
      if (geminiApiKey && prInsights.opportunities?.length > 0) {
        console.log(`\n🤖 Generating AI collaboration recommendations...`);
        const collaborationContext = {
          entity: config.entity,
          allSources: classifiedSources
        };

        const collaborations = await batchGenerateCollaborations(
          prInsights.opportunities,
          collaborationContext,
          geminiApiKey,
          5 // Generate for top 5 Critical/Strategic opportunities
        );

        // Merge collaboration recommendations into opportunities
        prInsights.opportunities = prInsights.opportunities.map(opp => {
          const collab = collaborations.get(opp.id);
          if (collab) {
            opp.ai_collaboration_recommendations = collab;
          }
          return opp;
        });

        console.log(`   ✅ Generated AI collaboration recommendations for ${collaborations.size} opportunities`);
      }

      // Save PR insights to database
      const savedCount = Report.savePRInsights(reportId, prInsights);
      console.log(`   ✅ Saved ${savedCount} PR insight opportunities to database`);

      // Also save as analysis result for API access
      Report.saveAnalysisResult(reportId, 'pr_insights', {
        analysis_type: 'pr_insights',
        entity: config.entity,
        total_opportunities: prInsights.opportunities?.length || 0,
        priority_summary: prInsights.priority_summary,
        theme_distribution: prInsights.theme_distribution,
        metrics_overview: prInsights.metrics_overview
      });

    } catch (prError) {
      console.error('⚠️ PR Insights generation failed:', prError.message);
      console.log('   Continuing without PR insights...');
    }

    // Calculate execution time
    const executionTime = Math.round((Date.now() - startTime) / 1000);
    Report.updateExecutionTime(reportId, executionTime);

    console.log('\n✨ ========== ANALYSIS COMPLETE ==========');
    console.log(`⏱️  Total execution time: ${executionTime}s`);
    console.log(`📈 Questions processed: ${processedCount}/${totalQuestions}`);
    console.log(`📊 Analysis types saved: ${Object.keys(rawResponses).filter(k => rawResponses[k].length > 0).join(', ')}`);
    console.log('==========================================\n');

    // Mark as completed
    Report.updateStatus(reportId, 'completed', 100);

    sendProgressUpdate(reportId, {
      type: 'complete',
      status: 'completed',
      progress: 100,
      message: 'Analysis complete!',
      executionTime
    });

    // Close SSE connection
    setTimeout(() => closeProgressConnection(reportId), 1000);

  } catch (error) {
    console.error('\n❌ ========== ANALYSIS FAILED ==========');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('========================================\n');

    Report.updateStatus(reportId, 'failed', null, error.message);

    sendProgressUpdate(reportId, {
      type: 'error',
      status: 'failed',
      message: error.message
    });

    closeProgressConnection(reportId);
  }
}
