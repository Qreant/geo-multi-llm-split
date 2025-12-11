#!/usr/bin/env node

/**
 * Source Classification Benchmark Runner
 *
 * Tests multiple LLM models across different batch sizes to find
 * the optimal configuration for source classification.
 *
 * Usage:
 *   node benchmarks/run-classification-benchmark.js [options]
 *
 * Options:
 *   --quick              Quick test (1 run, no warmup)
 *   --model <id>         Test specific model only
 *   --batch-size <n>     Test specific batch size only
 *   --data-file <path>   Use specific test data file
 *   --force-refresh      Force re-extract sources from DB
 *   --limit <n>          Limit number of sources (default: 500)
 *   --resume             Resume from last checkpoint
 *   --help               Show help
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { BENCHMARK_CONFIG, getModelConfig } from './config.js';
import { getTestSources, loadGoldenSet, prepareBatches } from './lib/dataLoader.js';
import { classifyBatch } from './lib/modelProviders.js';
import {
  createMetricsCollector,
  startRun,
  recordBatchResult,
  endRun,
  computeFinalStatistics
} from './lib/metricsCollector.js';
import {
  evaluateAgainstGolden,
  computeCrossModelConsensus,
  generateAccuracyReport
} from './lib/accuracyEvaluator.js';
import {
  exportSummaryCSV,
  exportDetailedJSON,
  exportAccuracyReport,
  generateRecommendations,
  printSummary
} from './lib/resultExporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Checkpoint file path
const CHECKPOINT_FILE = path.join(__dirname, 'data', 'benchmark-checkpoint.json');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    quick: false,
    model: null,
    batchSize: null,
    dataFile: null,
    forceRefresh: false,
    limit: 500,
    resume: false,
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
      case '--batch-size':
        options.batchSize = parseInt(args[++i], 10);
        break;
      case '--data-file':
        options.dataFile = args[++i];
        break;
      case '--force-refresh':
        options.forceRefresh = true;
        break;
      case '--limit':
        options.limit = parseInt(args[++i], 10);
        break;
      case '--resume':
        options.resume = true;
        break;
      case '--help':
        options.help = true;
        break;
    }
  }

  return options;
}

// Load checkpoint if exists
function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      console.log(`Loaded checkpoint from ${data.lastUpdated}`);
      console.log(`  Completed: ${data.completedCombinations.length} model/batch combinations`);
      return data;
    }
  } catch (error) {
    console.warn(`Warning: Could not load checkpoint: ${error.message}`);
  }
  return null;
}

// Save checkpoint after each model/batch combination
function saveCheckpoint(checkpoint) {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(CHECKPOINT_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    checkpoint.lastUpdated = new Date().toISOString();
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
    console.log(`  [Checkpoint saved: ${checkpoint.completedCombinations.length} combinations complete]`);
  } catch (error) {
    console.warn(`Warning: Could not save checkpoint: ${error.message}`);
  }
}

// Delete checkpoint file (when benchmark completes)
function clearCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('Checkpoint cleared (benchmark complete)');
    }
  } catch (error) {
    console.warn(`Warning: Could not clear checkpoint: ${error.message}`);
  }
}

// Check if a combination is already completed
function isCombinationCompleted(checkpoint, modelId, batchSize) {
  if (!checkpoint) return false;
  const key = `${modelId}_${batchSize}`;
  return checkpoint.completedCombinations.includes(key);
}

// Show help
function showHelp() {
  console.log(`
Source Classification Benchmark Runner

Tests multiple LLM models across different batch sizes to find
the optimal configuration for source classification.

Usage:
  node benchmarks/run-classification-benchmark.js [options]

Options:
  --quick              Quick test (1 run, no warmup)
  --model <id>         Test specific model only
                       Available: ${BENCHMARK_CONFIG.models.map(m => m.id).join(', ')}
  --batch-size <n>     Test specific batch size only
                       Available: ${BENCHMARK_CONFIG.batchSizes.join(', ')}
  --data-file <path>   Use specific test data file
  --force-refresh      Force re-extract sources from DB
  --limit <n>          Limit number of sources (default: 500)
  --resume             Resume from last checkpoint (skip completed combinations)
  --help               Show this help

Examples:
  # Run full benchmark
  node benchmarks/run-classification-benchmark.js

  # Quick test with all models
  node benchmarks/run-classification-benchmark.js --quick

  # Test only DeepSeek models
  node benchmarks/run-classification-benchmark.js --model deepseek-chat

  # Test specific batch size
  node benchmarks/run-classification-benchmark.js --batch-size 100

  # Resume interrupted benchmark
  node benchmarks/run-classification-benchmark.js --resume
`);
}

// Validate API keys
function validateApiKeys() {
  const keys = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY
  };

  const missing = [];
  if (!keys.gemini) missing.push('GEMINI_API_KEY');
  if (!keys.openai) missing.push('OPENAI_API_KEY');
  if (!keys.deepseek) missing.push('DEEPSEEK_API_KEY');

  if (missing.length > 0) {
    console.warn(`Warning: Missing API keys: ${missing.join(', ')}`);
    console.warn('Some models will be skipped.\n');
  }

  return keys;
}

// Get models to test based on options and available keys
function getModelsToTest(options, apiKeys) {
  let models = BENCHMARK_CONFIG.models;

  // Filter by specific model if requested
  if (options.model) {
    models = models.filter(m => m.id === options.model);
    if (models.length === 0) {
      throw new Error(`Unknown model: ${options.model}`);
    }
  }

  // Filter by available API keys
  models = models.filter(m => apiKeys[m.provider]);

  return models;
}

// Get batch sizes to test
function getBatchSizesToTest(options) {
  if (options.batchSize) {
    if (!BENCHMARK_CONFIG.batchSizes.includes(options.batchSize)) {
      throw new Error(`Invalid batch size: ${options.batchSize}`);
    }
    return [options.batchSize];
  }
  return BENCHMARK_CONFIG.batchSizes;
}

// Main benchmark runner
async function runBenchmark() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('='.repeat(80));
  console.log('SOURCE CLASSIFICATION BENCHMARK');
  console.log('='.repeat(80));
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Validate API keys
  const apiKeys = validateApiKeys();

  // Get models and batch sizes to test
  const models = getModelsToTest(options, apiKeys);
  const batchSizes = getBatchSizesToTest(options);

  if (models.length === 0) {
    console.error('No models to test. Check API keys in .env file.');
    process.exit(1);
  }

  console.log(`Models to test: ${models.map(m => m.id).join(', ')}`);
  console.log(`Batch sizes: ${batchSizes.join(', ')}`);

  // Determine run configuration
  const warmupRuns = options.quick ? 0 : BENCHMARK_CONFIG.warmupRuns;
  const testRuns = options.quick ? 1 : BENCHMARK_CONFIG.testRuns;
  console.log(`Warmup runs: ${warmupRuns}, Test runs: ${testRuns}\n`);

  // Load test data
  console.log('Loading test sources...');
  const dbPath = path.resolve(__dirname, '..', '..', 'database', 'reports.db');
  let sources;

  try {
    sources = await getTestSources(dbPath, {
      cacheFile: options.dataFile || 'data/test-sources.json',
      forceRefresh: options.forceRefresh,
      limit: options.limit
    });
  } catch (error) {
    console.error(`Failed to load test sources: ${error.message}`);
    console.log('\nTo generate test data, run an analysis first.');
    process.exit(1);
  }

  console.log(`Loaded ${sources.length} sources for testing\n`);

  // Load golden set for accuracy evaluation
  const goldenSet = loadGoldenSet();
  if (goldenSet) {
    console.log(`Golden set loaded: ${goldenSet.length} verified classifications\n`);
  } else {
    console.log('No golden set found. Accuracy will be evaluated by cross-model consensus only.\n');
  }

  // Load checkpoint if resuming
  let checkpoint = null;
  if (options.resume) {
    checkpoint = loadCheckpoint();
    if (!checkpoint) {
      console.log('No checkpoint found. Starting fresh benchmark.\n');
    }
  }

  // Initialize checkpoint structure
  if (!checkpoint) {
    checkpoint = {
      startedAt: new Date().toISOString(),
      completedCombinations: [],
      results: [],
      classifications: {}
    };
  }

  // Track all results (include any from checkpoint)
  const allResults = [...(checkpoint.results || [])];
  const allClassifications = { ...(checkpoint.classifications || {}) }; // For cross-model consensus

  // Calculate total test iterations
  const totalCombinations = models.length * batchSizes.length;
  const completedCount = checkpoint.completedCombinations.length;
  const remainingCombinations = totalCombinations - completedCount;
  const totalIterations = remainingCombinations * (warmupRuns + testRuns);
  let currentIteration = 0;

  if (completedCount > 0) {
    console.log(`Resuming: ${completedCount}/${totalCombinations} combinations already complete`);
    console.log(`Remaining: ${remainingCombinations} combinations, ~${totalIterations} iterations\n`);
  }

  // Run benchmarks
  for (const modelConfig of models) {
    for (const batchSize of batchSizes) {
      // Skip if already completed
      if (isCombinationCompleted(checkpoint, modelConfig.id, batchSize)) {
        console.log(`\n[SKIP] ${modelConfig.id} @ batch size ${batchSize} (already completed)`);
        continue;
      }

      console.log('\n' + '-'.repeat(60));
      console.log(`Testing: ${modelConfig.id} @ batch size ${batchSize}`);
      console.log('-'.repeat(60));

      const collector = createMetricsCollector(modelConfig.id, batchSize);
      const batches = prepareBatches(sources, batchSize);

      console.log(`Prepared ${batches.length} batches of ${batchSize} sources each`);

      // Warmup runs
      for (let run = 1; run <= warmupRuns; run++) {
        currentIteration++;
        console.log(`\n[${currentIteration}/${totalIterations}] Warmup run ${run}/${warmupRuns}...`);

        startRun(collector, run, true);

        for (let i = 0; i < batches.length; i++) {
          try {
            const result = await classifyBatch(batches[i], modelConfig, apiKeys, {
              brandName: 'TestBrand',
              competitors: []
            });
            recordBatchResult(collector, result);
            process.stdout.write(`  Batch ${i + 1}/${batches.length}: ${result.success ? '✓' : '✗'} `);
          } catch (error) {
            recordBatchResult(collector, {
              sourceCount: batches[i].length,
              success: false,
              latencyMs: 0,
              latencyPerSource: 0,
              inputTokens: 0,
              outputTokens: 0,
              classificationsReturned: 0,
              failureReason: 'error',
              error: error.message
            });
            process.stdout.write(`  Batch ${i + 1}/${batches.length}: ✗ `);
          }
        }

        endRun(collector);
        console.log(`\n  Warmup complete: ${collector.runs[collector.runs.length - 1].totals.successfulBatches}/${batches.length} successful`);
      }

      // Test runs
      let lastClassifications = []; // Store last successful classifications for accuracy

      for (let run = 1; run <= testRuns; run++) {
        currentIteration++;
        console.log(`\n[${currentIteration}/${totalIterations}] Test run ${run}/${testRuns}...`);

        startRun(collector, run, false);
        const runClassifications = [];

        for (let i = 0; i < batches.length; i++) {
          try {
            const result = await classifyBatch(batches[i], modelConfig, apiKeys, {
              brandName: 'TestBrand',
              competitors: []
            });
            recordBatchResult(collector, result);

            // Collect classifications for accuracy evaluation
            if (result.success && result.classifications) {
              result.classifications.forEach((c, idx) => {
                runClassifications.push({
                  url: batches[i][idx]?.url,
                  source_type: c.source_type
                });
              });
            }

            process.stdout.write(`  Batch ${i + 1}/${batches.length}: ${result.success ? '✓' : '✗'} `);
          } catch (error) {
            recordBatchResult(collector, {
              sourceCount: batches[i].length,
              success: false,
              latencyMs: 0,
              latencyPerSource: 0,
              inputTokens: 0,
              outputTokens: 0,
              classificationsReturned: 0,
              failureReason: 'error',
              error: error.message
            });
            process.stdout.write(`  Batch ${i + 1}/${batches.length}: ✗ `);
          }
        }

        endRun(collector);

        const runTotals = collector.runs[collector.runs.length - 1].totals;
        console.log(`\n  Run complete: ${runTotals.successfulBatches}/${batches.length} batches, ` +
          `${runTotals.successfulSources}/${runTotals.totalSources} sources, ` +
          `${Math.round(runTotals.avgLatencyPerSource)}ms/source`);

        if (runClassifications.length > lastClassifications.length) {
          lastClassifications = runClassifications;
        }
      }

      // Compute final statistics
      const stats = computeFinalStatistics(collector);

      // Evaluate accuracy against golden set
      if (goldenSet && lastClassifications.length > 0) {
        const goldenEval = evaluateAgainstGolden(lastClassifications, goldenSet);
        stats.accuracyGolden = goldenEval.overall?.accuracy || null;
      }

      // Store classifications for cross-model consensus
      if (lastClassifications.length > 0) {
        const key = `${modelConfig.id}_${batchSize}`;
        allClassifications[key] = lastClassifications;
      }

      allResults.push(stats);

      console.log(`\nStats: ${(stats.successRate * 100).toFixed(0)}% success, ` +
        `${Math.round(stats.avgLatencyPerSource)}ms/source, ` +
        `$${stats.costPer500Sources.toFixed(4)}/500 sources`);

      // Save checkpoint after each model/batch combination
      const combinationKey = `${modelConfig.id}_${batchSize}`;
      checkpoint.completedCombinations.push(combinationKey);
      checkpoint.results = allResults;
      checkpoint.classifications = allClassifications;
      saveCheckpoint(checkpoint);
    }
  }

  // Cross-model consensus evaluation
  console.log('\n' + '='.repeat(80));
  console.log('Computing cross-model consensus...');

  // Use the best batch size (100) for consensus
  const consensusClassifications = {};
  Object.entries(allClassifications).forEach(([key, classifications]) => {
    const [modelId] = key.split('_');
    if (!consensusClassifications[modelId] || classifications.length > consensusClassifications[modelId].length) {
      consensusClassifications[modelId] = classifications;
    }
  });

  const consensusEval = computeCrossModelConsensus(consensusClassifications);

  // Add consensus accuracy to results
  if (consensusEval.modelAgreement) {
    allResults.forEach(r => {
      r.accuracyConsensus = consensusEval.modelAgreement[r.modelId] || null;
    });
  }

  // Generate reports
  console.log('\n' + '='.repeat(80));
  console.log('Generating reports...\n');

  const recommendations = generateRecommendations(allResults);

  // Export results
  const csvPath = exportSummaryCSV(allResults);
  const jsonPath = exportDetailedJSON({
    metadata: {
      timestamp: new Date().toISOString(),
      testSourceCount: sources.length,
      warmupRuns,
      testRuns,
      models: models.map(m => m.id),
      batchSizes
    },
    results: allResults,
    recommendations
  });

  const accuracyReport = generateAccuracyReport(
    goldenSet ? { overall: { accuracy: allResults[0]?.accuracyGolden } } : null,
    consensusEval
  );
  const accuracyPath = exportAccuracyReport(accuracyReport);

  // Print summary
  printSummary(allResults, recommendations);

  console.log('\nExported files:');
  console.log(`  - ${csvPath}`);
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${accuracyPath}`);

  // Clear checkpoint since benchmark completed successfully
  clearCheckpoint();

  console.log(`\nBenchmark completed: ${new Date().toISOString()}`);
}

// Run the benchmark
runBenchmark().catch(error => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
