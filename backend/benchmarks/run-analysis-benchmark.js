#!/usr/bin/env node

/**
 * Analysis Benchmark Runner
 *
 * Tests new OpenAI models (GPT-4.1-nano, GPT-4.1-mini, GPT-5-nano, GPT-5-mini)
 * on main analysis prompts (reputation, visibility, competitive, category)
 * to evaluate them as potential GPT-4o replacements.
 *
 * Usage:
 *   node benchmarks/run-analysis-benchmark.js [options]
 *
 * Options:
 *   --quick              Quick test (1 run, no warmup)
 *   --model <id>         Test specific model only
 *   --type <type>        Test specific analysis type only
 *   --help               Show help
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

import {
  ANALYSIS_BENCHMARK_CONFIG,
  API_ENDPOINT,
  FAILURE_REASONS,
  calculateCost,
  getModelConfig
} from './analysis-config.js';

import {
  buildReputationPrompt,
  buildVisibilityPrompt,
  buildCompetitivePrompt,
  buildCategoryDetectionPrompt
} from '../src/services/promptBuilder.js';

import {
  validateResponse,
  calculateQualityMetrics
} from './lib/analysisValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CLI Argument Parsing
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    quick: false,
    model: null,
    type: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--quick':
        options.quick = true;
        break;
      case '--model':
        options.model = args[++i];
        break;
      case '--type':
        options.type = args[++i];
        break;
      case '--help':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Analysis Benchmark Runner

Tests new OpenAI models on main analysis prompts to evaluate
them as potential GPT-4o replacements.

Usage:
  node benchmarks/run-analysis-benchmark.js [options]

Options:
  --quick              Quick test (1 run, no warmup)
  --model <id>         Test specific model only (gpt-4o, gpt-4.1-nano, etc.)
  --type <type>        Test specific analysis type (reputation, visibility, competitive, category)
  --help               Show this help

Examples:
  # Run full benchmark
  node benchmarks/run-analysis-benchmark.js

  # Quick test of gpt-4.1-nano only
  node benchmarks/run-analysis-benchmark.js --quick --model gpt-4.1-nano

  # Test all models on reputation analysis only
  node benchmarks/run-analysis-benchmark.js --type reputation
`);
}

// =============================================================================
// API Call Functions
// =============================================================================

/**
 * Call OpenAI API with a prompt
 */
async function callOpenAI(prompt, modelConfig, apiKey) {
  const startTime = Date.now();
  const { model, id: modelId } = modelConfig;

  // GPT-5 models use max_completion_tokens instead of max_tokens
  const isGpt5Model = model.startsWith('gpt-5');
  const tokenLimit = ANALYSIS_BENCHMARK_CONFIG.tokenLimits[modelId] || 16384;

  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a JSON-only assistant. Return ONLY valid JSON with no markdown, explanations, or additional text. Your response must start with { and end with }.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    ...(isGpt5Model ? { max_completion_tokens: tokenLimit } : { max_tokens: tokenLimit }),
    ...(isGpt5Model ? {} : { temperature: ANALYSIS_BENCHMARK_CONFIG.temperature }),
    response_format: { type: 'json_object' }
  };

  try {
    const response = await axios.post(API_ENDPOINT, requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: ANALYSIS_BENCHMARK_CONFIG.timeout
    });

    const latencyMs = Date.now() - startTime;
    const text = response.data?.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('No response text from OpenAI API');
    }

    // Extract token usage
    const usage = response.data?.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse JSON from response');
      }
    }

    return {
      success: true,
      data: parsed,
      inputTokens,
      outputTokens,
      latencyMs,
      rawResponse: text,
      cost: calculateCost(modelId, inputTokens, outputTokens)
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return handleError(error, latencyMs, modelId);
  }
}

/**
 * Handle API errors and categorize them
 */
function handleError(error, latencyMs, modelId) {
  let failureReason = FAILURE_REASONS.UNKNOWN;
  let message = error.message;

  if (error.code === 'ECONNABORTED' || message?.includes('timeout')) {
    failureReason = FAILURE_REASONS.TIMEOUT;
  } else if (error.response?.status === 429) {
    failureReason = FAILURE_REASONS.RATE_LIMIT;
  } else if (error.response?.status >= 500 && error.response?.status < 600) {
    failureReason = FAILURE_REASONS.SERVER_ERROR;
  } else if (error.response?.status === 401 || error.response?.status === 403) {
    failureReason = FAILURE_REASONS.AUTH_ERROR;
  } else if (error.response?.status === 404) {
    failureReason = FAILURE_REASONS.MODEL_NOT_FOUND;
    message = `Model not found: ${modelId}`;
  } else if (message?.includes('JSON') || message?.includes('parse')) {
    failureReason = FAILURE_REASONS.PARSE_ERROR;
  } else if (message?.includes('token') || message?.includes('length')) {
    failureReason = FAILURE_REASONS.TOKEN_LIMIT;
  }

  return {
    success: false,
    data: null,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs,
    error: message,
    failureReason,
    httpStatus: error.response?.status,
    cost: 0
  };
}

// =============================================================================
// Prompt Building
// =============================================================================

/**
 * Build prompt for a test question
 */
function buildPrompt(question) {
  const config = { market: question.market };

  switch (question.type) {
    case 'reputation':
      return buildReputationPrompt(question.question, question.brand, config);

    case 'visibility':
      return buildVisibilityPrompt(
        question.question,
        question.category,
        question.brand,
        config
      );

    case 'competitive':
      return buildCompetitivePrompt(
        question.question,
        question.entities,
        question.category,
        config
      );

    case 'category':
      return buildCategoryDetectionPrompt(question.question, question.brand, config);

    default:
      throw new Error(`Unknown question type: ${question.type}`);
  }
}

// =============================================================================
// Benchmark Runner
// =============================================================================

/**
 * Run benchmark for a single model
 */
async function benchmarkModel(modelConfig, testQuestions, apiKey, options = {}) {
  const { warmupRuns = 1, testRuns = 3 } = options;
  const { id: modelId } = modelConfig;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Testing: ${modelId}`);
  console.log(`${'─'.repeat(60)}`);

  const results = {
    modelId,
    model: modelConfig.model,
    description: modelConfig.description,
    byAnalysisType: {},
    overall: {
      totalQuestions: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      validationResults: [],
      failures: []
    }
  };

  // Initialize per-type results
  for (const type of ANALYSIS_BENCHMARK_CONFIG.analysisTypes) {
    results.byAnalysisType[type] = {
      questions: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      validationResults: [],
      failures: []
    };
  }

  // Warmup runs (not counted)
  if (warmupRuns > 0) {
    console.log(`\n[Warmup] Running ${warmupRuns} warmup iteration(s)...`);
    for (let w = 0; w < warmupRuns; w++) {
      const warmupQ = testQuestions[0];
      const prompt = buildPrompt(warmupQ);
      process.stdout.write(`  Warmup ${w + 1}/${warmupRuns}...`);
      const result = await callOpenAI(prompt, modelConfig, apiKey);
      console.log(result.success ? ' done' : ` failed (${result.failureReason})`);

      if (!result.success && result.failureReason === FAILURE_REASONS.MODEL_NOT_FOUND) {
        console.log(`  [SKIP] Model ${modelId} not available`);
        results.overall.skipped = true;
        results.overall.skipReason = 'Model not found';
        return results;
      }
    }
  }

  // Test runs
  console.log(`\n[Test] Running ${testRuns} test iteration(s) across ${testQuestions.length} questions...`);

  for (let run = 0; run < testRuns; run++) {
    console.log(`\n  Run ${run + 1}/${testRuns}:`);

    for (const question of testQuestions) {
      const type = question.type;
      const prompt = buildPrompt(question);

      process.stdout.write(`    ${question.id} (${type})...`);

      const result = await callOpenAI(prompt, modelConfig, apiKey);

      if (result.success) {
        // Validate response quality
        const validationOpts = {
          entities: question.entities,
          brand: question.brand
        };
        const validation = validateResponse(result.data, type, validationOpts);

        console.log(` ${result.latencyMs}ms, ${result.inputTokens}+${result.outputTokens} tokens, valid=${validation.valid}`);

        // Update metrics
        results.byAnalysisType[type].questions++;
        results.byAnalysisType[type].successCount++;
        results.byAnalysisType[type].totalLatencyMs += result.latencyMs;
        results.byAnalysisType[type].totalInputTokens += result.inputTokens;
        results.byAnalysisType[type].totalOutputTokens += result.outputTokens;
        results.byAnalysisType[type].totalCost += result.cost;
        results.byAnalysisType[type].validationResults.push(validation);

        results.overall.totalQuestions++;
        results.overall.successCount++;
        results.overall.totalLatencyMs += result.latencyMs;
        results.overall.totalInputTokens += result.inputTokens;
        results.overall.totalOutputTokens += result.outputTokens;
        results.overall.totalCost += result.cost;
        results.overall.validationResults.push(validation);
      } else {
        console.log(` FAILED (${result.failureReason})`);

        results.byAnalysisType[type].questions++;
        results.byAnalysisType[type].failureCount++;
        results.byAnalysisType[type].failures.push({
          questionId: question.id,
          reason: result.failureReason,
          error: result.error
        });

        results.overall.totalQuestions++;
        results.overall.failureCount++;
        results.overall.failures.push({
          questionId: question.id,
          type,
          reason: result.failureReason,
          error: result.error
        });

        // If model not found, skip remaining tests
        if (result.failureReason === FAILURE_REASONS.MODEL_NOT_FOUND) {
          console.log(`  [SKIP] Model ${modelId} not available, skipping remaining tests`);
          results.overall.skipped = true;
          results.overall.skipReason = 'Model not found';
          return results;
        }
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Compute final statistics
  computeStatistics(results);

  return results;
}

/**
 * Compute final statistics for results
 */
function computeStatistics(results) {
  // Overall stats
  const o = results.overall;
  o.successRate = o.totalQuestions > 0 ? o.successCount / o.totalQuestions : 0;
  o.avgLatencyMs = o.successCount > 0 ? o.totalLatencyMs / o.successCount : 0;
  o.avgInputTokens = o.successCount > 0 ? o.totalInputTokens / o.successCount : 0;
  o.avgOutputTokens = o.successCount > 0 ? o.totalOutputTokens / o.successCount : 0;
  o.avgCost = o.successCount > 0 ? o.totalCost / o.successCount : 0;

  // Quality metrics
  const quality = calculateQualityMetrics(o.validationResults);
  o.validRate = quality.validRate;
  o.avgQualityScore = quality.avgScore;
  o.checkSummary = quality.checkSummary;

  // Per-type stats
  for (const [type, data] of Object.entries(results.byAnalysisType)) {
    data.successRate = data.questions > 0 ? data.successCount / data.questions : 0;
    data.avgLatencyMs = data.successCount > 0 ? data.totalLatencyMs / data.successCount : 0;
    data.avgInputTokens = data.successCount > 0 ? data.totalInputTokens / data.successCount : 0;
    data.avgOutputTokens = data.successCount > 0 ? data.totalOutputTokens / data.successCount : 0;
    data.avgCost = data.successCount > 0 ? data.totalCost / data.successCount : 0;

    const typeQuality = calculateQualityMetrics(data.validationResults);
    data.validRate = typeQuality.validRate;
    data.avgQualityScore = typeQuality.avgScore;
  }
}

// =============================================================================
// Result Export
// =============================================================================

/**
 * Export results to CSV
 */
function exportCSV(allResults, outputPath) {
  const headers = [
    'model_id',
    'analysis_type',
    'questions',
    'success_rate',
    'valid_rate',
    'avg_quality_score',
    'avg_latency_ms',
    'avg_input_tokens',
    'avg_output_tokens',
    'avg_cost',
    'total_cost'
  ];

  const rows = [headers.join(',')];

  for (const result of allResults) {
    if (result.overall.skipped) {
      rows.push([
        result.modelId,
        'ALL',
        0,
        'SKIPPED',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        result.overall.skipReason
      ].join(','));
      continue;
    }

    // Overall row
    rows.push([
      result.modelId,
      'ALL',
      result.overall.totalQuestions,
      `${(result.overall.successRate * 100).toFixed(1)}%`,
      `${(result.overall.validRate * 100).toFixed(1)}%`,
      result.overall.avgQualityScore.toFixed(3),
      Math.round(result.overall.avgLatencyMs),
      Math.round(result.overall.avgInputTokens),
      Math.round(result.overall.avgOutputTokens),
      `$${result.overall.avgCost.toFixed(4)}`,
      `$${result.overall.totalCost.toFixed(4)}`
    ].join(','));

    // Per-type rows
    for (const [type, data] of Object.entries(result.byAnalysisType)) {
      if (data.questions > 0) {
        rows.push([
          result.modelId,
          type,
          data.questions,
          `${(data.successRate * 100).toFixed(1)}%`,
          `${(data.validRate * 100).toFixed(1)}%`,
          data.avgQualityScore.toFixed(3),
          Math.round(data.avgLatencyMs),
          Math.round(data.avgInputTokens),
          Math.round(data.avgOutputTokens),
          `$${data.avgCost.toFixed(4)}`,
          `$${data.totalCost.toFixed(4)}`
        ].join(','));
      }
    }
  }

  fs.writeFileSync(outputPath, rows.join('\n'));
  console.log(`\nCSV exported to: ${outputPath}`);
}

/**
 * Export detailed results to JSON
 */
function exportJSON(allResults, outputPath) {
  const exportData = {
    exportedAt: new Date().toISOString(),
    config: {
      models: ANALYSIS_BENCHMARK_CONFIG.models.map(m => m.id),
      analysisTypes: ANALYSIS_BENCHMARK_CONFIG.analysisTypes,
      warmupRuns: ANALYSIS_BENCHMARK_CONFIG.warmupRuns,
      testRuns: ANALYSIS_BENCHMARK_CONFIG.testRuns
    },
    results: allResults.map(r => ({
      modelId: r.modelId,
      model: r.model,
      description: r.description,
      skipped: r.overall.skipped || false,
      skipReason: r.overall.skipReason || null,
      overall: {
        totalQuestions: r.overall.totalQuestions,
        successRate: r.overall.successRate,
        validRate: r.overall.validRate,
        avgQualityScore: r.overall.avgQualityScore,
        avgLatencyMs: r.overall.avgLatencyMs,
        avgInputTokens: r.overall.avgInputTokens,
        avgOutputTokens: r.overall.avgOutputTokens,
        avgCostPerQuestion: r.overall.avgCost,
        totalCost: r.overall.totalCost,
        failures: r.overall.failures
      },
      byAnalysisType: Object.fromEntries(
        Object.entries(r.byAnalysisType).map(([type, data]) => [
          type,
          {
            questions: data.questions,
            successRate: data.successRate,
            validRate: data.validRate,
            avgQualityScore: data.avgQualityScore,
            avgLatencyMs: data.avgLatencyMs,
            avgCostPerQuestion: data.avgCost,
            totalCost: data.totalCost
          }
        ])
      )
    }))
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  console.log(`JSON exported to: ${outputPath}`);
}

/**
 * Print summary to console
 */
function printSummary(allResults) {
  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK SUMMARY');
  console.log('='.repeat(80));

  // Find baseline (gpt-4o)
  const baseline = allResults.find(r => r.modelId === 'gpt-4o');

  console.log('\n┌─────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────┐');
  console.log('│ Model           │ Success  │ Valid    │ Quality  │ Latency  │ Cost/Q   │ vs GPT-4o  │');
  console.log('├─────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼────────────┤');

  for (const result of allResults) {
    if (result.overall.skipped) {
      console.log(`│ ${result.modelId.padEnd(15)} │ SKIPPED  │    -     │    -     │    -     │    -     │     -      │`);
      continue;
    }

    const successRate = `${(result.overall.successRate * 100).toFixed(0)}%`.padStart(6);
    const validRate = `${(result.overall.validRate * 100).toFixed(0)}%`.padStart(6);
    const quality = result.overall.avgQualityScore.toFixed(2).padStart(6);
    const latency = `${Math.round(result.overall.avgLatencyMs)}ms`.padStart(6);
    const cost = `$${result.overall.avgCost.toFixed(3)}`.padStart(7);

    let savings = '    -     ';
    if (baseline && result.modelId !== 'gpt-4o' && baseline.overall.avgCost > 0) {
      const savingsPercent = ((baseline.overall.avgCost - result.overall.avgCost) / baseline.overall.avgCost) * 100;
      savings = `${savingsPercent >= 0 ? '-' : '+'}${Math.abs(savingsPercent).toFixed(0)}% cost`.padStart(10);
    }

    console.log(`│ ${result.modelId.padEnd(15)} │ ${successRate}   │ ${validRate}   │ ${quality}   │ ${latency}  │ ${cost} │ ${savings} │`);
  }

  console.log('└─────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴────────────┘');

  // Recommendations
  console.log('\n' + '─'.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('─'.repeat(80));

  const validResults = allResults.filter(r => !r.overall.skipped && r.overall.successRate > 0);

  if (validResults.length > 0) {
    // Best quality
    const bestQuality = validResults.reduce((best, r) =>
      r.overall.avgQualityScore > best.overall.avgQualityScore ? r : best
    );
    console.log(`\nBest Quality: ${bestQuality.modelId} (${(bestQuality.overall.avgQualityScore * 100).toFixed(1)}%)`);

    // Best cost with decent quality
    const goodQuality = validResults.filter(r => r.overall.validRate >= 0.8);
    if (goodQuality.length > 0) {
      const bestCost = goodQuality.reduce((best, r) =>
        r.overall.avgCost < best.overall.avgCost ? r : best
      );
      console.log(`Best Cost (quality >= 80%): ${bestCost.modelId} ($${bestCost.overall.avgCost.toFixed(4)}/question)`);
    }

    // Fastest
    const fastest = validResults.reduce((best, r) =>
      r.overall.avgLatencyMs < best.overall.avgLatencyMs ? r : best
    );
    console.log(`Fastest: ${fastest.modelId} (${Math.round(fastest.overall.avgLatencyMs)}ms avg)`);
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('='.repeat(80));
  console.log('ANALYSIS BENCHMARK - Testing New OpenAI Models');
  console.log('='.repeat(80));
  console.log(`Started: ${new Date().toISOString()}`);

  // Validate API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('\nError: OPENAI_API_KEY not found in environment');
    process.exit(1);
  }

  // Load test questions
  const questionsPath = path.join(__dirname, 'data', 'analysis-test-questions.json');
  if (!fs.existsSync(questionsPath)) {
    console.error(`\nError: Test questions file not found: ${questionsPath}`);
    process.exit(1);
  }

  const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

  // Filter questions by type if specified
  let testQuestions = [];
  const types = options.type
    ? [options.type]
    : ANALYSIS_BENCHMARK_CONFIG.analysisTypes;

  for (const type of types) {
    if (questionsData.questions[type]) {
      testQuestions.push(...questionsData.questions[type]);
    }
  }

  console.log(`\nLoaded ${testQuestions.length} test questions`);
  console.log(`Analysis types: ${types.join(', ')}`);

  // Filter models if specified
  const models = options.model
    ? ANALYSIS_BENCHMARK_CONFIG.models.filter(m => m.id === options.model)
    : ANALYSIS_BENCHMARK_CONFIG.models;

  if (models.length === 0) {
    console.error(`\nError: Model not found: ${options.model}`);
    console.log('Available models:', ANALYSIS_BENCHMARK_CONFIG.models.map(m => m.id).join(', '));
    process.exit(1);
  }

  console.log(`Models to test: ${models.map(m => m.id).join(', ')}`);

  // Run configuration
  const warmupRuns = options.quick ? 0 : ANALYSIS_BENCHMARK_CONFIG.warmupRuns;
  const testRuns = options.quick ? 1 : ANALYSIS_BENCHMARK_CONFIG.testRuns;

  console.log(`\nConfiguration:`);
  console.log(`  Warmup runs: ${warmupRuns}`);
  console.log(`  Test runs: ${testRuns}`);
  console.log(`  Questions per run: ${testQuestions.length}`);
  console.log(`  Total API calls: ${models.length * (warmupRuns + testRuns * testQuestions.length)}`);

  // Run benchmarks
  const allResults = [];

  for (const modelConfig of models) {
    const result = await benchmarkModel(modelConfig, testQuestions, apiKey, {
      warmupRuns,
      testRuns
    });
    allResults.push(result);
  }

  // Export results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const resultsDir = path.join(__dirname, 'results');

  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const csvPath = path.join(resultsDir, `analysis-benchmark-${timestamp}-summary.csv`);
  const jsonPath = path.join(resultsDir, `analysis-benchmark-${timestamp}-detailed.json`);

  exportCSV(allResults, csvPath);
  exportJSON(allResults, jsonPath);

  // Print summary
  printSummary(allResults);

  console.log('\n' + '='.repeat(80));
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
}

main().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
