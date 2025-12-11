/**
 * Metrics Collector
 * Track and aggregate performance metrics for benchmark testing
 */

import { calculateCost, FAILURE_REASONS } from '../config.js';

/**
 * Create a new metrics collector instance
 * @param {string} modelId - Model identifier
 * @param {number} batchSize - Batch size being tested
 * @returns {Object} Metrics collector object
 */
export function createMetricsCollector(modelId, batchSize) {
  return {
    modelId,
    batchSize,
    runs: [],
    currentRun: null,
    startTime: null
  };
}

/**
 * Start a new test run
 * @param {Object} collector - Metrics collector instance
 * @param {number} runNumber - Run number (1-indexed)
 * @param {boolean} isWarmup - Whether this is a warmup run
 */
export function startRun(collector, runNumber, isWarmup = false) {
  collector.currentRun = {
    runNumber,
    isWarmup,
    startTime: new Date().toISOString(),
    batches: [],
    totals: null
  };
  collector.startTime = Date.now();
}

/**
 * Record a batch result
 * @param {Object} collector - Metrics collector instance
 * @param {Object} result - Batch result from classifyBatch
 */
export function recordBatchResult(collector, result) {
  if (!collector.currentRun) {
    throw new Error('No active run. Call startRun first.');
  }

  collector.currentRun.batches.push({
    batchIndex: collector.currentRun.batches.length,
    sourceCount: result.sourceCount,
    success: result.success,
    latencyMs: result.latencyMs,
    latencyPerSource: result.latencyPerSource,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    classificationsReturned: result.classificationsReturned,
    failureReason: result.failureReason
  });
}

/**
 * End the current run and calculate totals
 * @param {Object} collector - Metrics collector instance
 */
export function endRun(collector) {
  if (!collector.currentRun) {
    throw new Error('No active run to end.');
  }

  const run = collector.currentRun;
  const batches = run.batches;

  // Calculate totals
  const successfulBatches = batches.filter(b => b.success);
  const failedBatches = batches.filter(b => !b.success);

  const totalSources = batches.reduce((sum, b) => sum + b.sourceCount, 0);
  const successfulSources = successfulBatches.reduce((sum, b) => sum + b.classificationsReturned, 0);
  const totalLatencyMs = batches.reduce((sum, b) => sum + b.latencyMs, 0);
  const totalInputTokens = batches.reduce((sum, b) => sum + b.inputTokens, 0);
  const totalOutputTokens = batches.reduce((sum, b) => sum + b.outputTokens, 0);

  // Count failure reasons
  const failureReasons = {};
  failedBatches.forEach(b => {
    const reason = b.failureReason || FAILURE_REASONS.UNKNOWN;
    failureReasons[reason] = (failureReasons[reason] || 0) + 1;
  });

  run.endTime = new Date().toISOString();
  run.durationMs = Date.now() - collector.startTime;

  run.totals = {
    totalBatches: batches.length,
    successfulBatches: successfulBatches.length,
    failedBatches: failedBatches.length,
    batchSuccessRate: batches.length > 0 ? successfulBatches.length / batches.length : 0,
    totalSources,
    successfulSources,
    failedSources: totalSources - successfulSources,
    sourceSuccessRate: totalSources > 0 ? successfulSources / totalSources : 0,
    totalLatencyMs,
    avgLatencyPerBatch: batches.length > 0 ? totalLatencyMs / batches.length : 0,
    avgLatencyPerSource: totalSources > 0 ? totalLatencyMs / totalSources : 0,
    totalInputTokens,
    totalOutputTokens,
    estimatedCost: calculateCost(collector.modelId, totalInputTokens, totalOutputTokens),
    failureReasons
  };

  collector.runs.push(run);
  collector.currentRun = null;
  collector.startTime = null;
}

/**
 * Compute final aggregated statistics across all non-warmup runs
 * @param {Object} collector - Metrics collector instance
 * @returns {Object} Aggregated statistics
 */
export function computeFinalStatistics(collector) {
  const testRuns = collector.runs.filter(r => !r.isWarmup);

  if (testRuns.length === 0) {
    return {
      modelId: collector.modelId,
      batchSize: collector.batchSize,
      testRuns: 0,
      error: 'No test runs completed'
    };
  }

  // Collect all batch latencies for percentile calculations
  const allBatchLatencies = [];
  const allSourceLatencies = [];

  testRuns.forEach(run => {
    run.batches.forEach(batch => {
      if (batch.success) {
        allBatchLatencies.push(batch.latencyMs);
        allSourceLatencies.push(batch.latencyPerSource);
      }
    });
  });

  // Calculate statistics
  const successRates = testRuns.map(r => r.totals.batchSuccessRate);
  const avgSuccessRate = average(successRates);

  const latencies = testRuns.map(r => r.totals.avgLatencyPerBatch);
  const avgLatency = average(latencies);

  const sourceLatencies = testRuns.map(r => r.totals.avgLatencyPerSource);
  const avgSourceLatency = average(sourceLatencies);

  const costs = testRuns.map(r => r.totals.estimatedCost);
  const avgCost = average(costs);

  const inputTokens = testRuns.map(r => r.totals.totalInputTokens);
  const avgInputTokens = average(inputTokens);

  const outputTokens = testRuns.map(r => r.totals.totalOutputTokens);
  const avgOutputTokens = average(outputTokens);

  // Aggregate failure reasons
  const allFailureReasons = {};
  testRuns.forEach(run => {
    Object.entries(run.totals.failureReasons || {}).forEach(([reason, count]) => {
      allFailureReasons[reason] = (allFailureReasons[reason] || 0) + count;
    });
  });

  // Find primary failure reason
  let primaryFailureReason = null;
  let maxFailures = 0;
  Object.entries(allFailureReasons).forEach(([reason, count]) => {
    if (count > maxFailures) {
      maxFailures = count;
      primaryFailureReason = reason;
    }
  });

  return {
    modelId: collector.modelId,
    batchSize: collector.batchSize,
    testRuns: testRuns.length,
    warmupRuns: collector.runs.filter(r => r.isWarmup).length,

    // Success metrics
    successRate: avgSuccessRate,
    successRateStdDev: stdDev(successRates),

    // Latency metrics (per batch)
    avgLatencyMs: avgLatency,
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies),
    p50LatencyMs: percentile(allBatchLatencies, 50),
    p95LatencyMs: percentile(allBatchLatencies, 95),
    latencyStdDev: stdDev(latencies),

    // Latency per source
    avgLatencyPerSource: avgSourceLatency,
    p50LatencyPerSource: percentile(allSourceLatencies, 50),
    p95LatencyPerSource: percentile(allSourceLatencies, 95),

    // Token usage
    avgInputTokens,
    avgOutputTokens,
    totalTokens: avgInputTokens + avgOutputTokens,

    // Cost
    avgCostPerRun: avgCost,
    costPer500Sources: avgCost, // Assuming 500 sources per run

    // Failures
    totalFailedBatches: testRuns.reduce((sum, r) => sum + r.totals.failedBatches, 0),
    failureReasons: allFailureReasons,
    primaryFailureReason
  };
}

/**
 * Calculate average of an array
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Average value
 */
function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Calculate standard deviation
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Standard deviation
 */
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const avg = average(arr);
  const squaredDiffs = arr.map(val => Math.pow(val - avg, 2));
  return Math.sqrt(average(squaredDiffs));
}

/**
 * Calculate percentile value
 * @param {Array<number>} arr - Array of numbers
 * @param {number} p - Percentile (0-100)
 * @returns {number} Percentile value
 */
function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Create a summary object for export
 * @param {Object} stats - Aggregated statistics
 * @returns {Object} Simplified summary object
 */
export function createSummary(stats) {
  return {
    model_id: stats.modelId,
    batch_size: stats.batchSize,
    test_runs: stats.testRuns,
    success_rate: `${(stats.successRate * 100).toFixed(1)}%`,
    avg_latency_ms: Math.round(stats.avgLatencyMs),
    p50_latency_ms: Math.round(stats.p50LatencyMs || 0),
    p95_latency_ms: Math.round(stats.p95LatencyMs || 0),
    latency_per_source: Math.round(stats.avgLatencyPerSource),
    avg_input_tokens: Math.round(stats.avgInputTokens),
    avg_output_tokens: Math.round(stats.avgOutputTokens),
    cost_per_500_sources: `$${stats.costPer500Sources.toFixed(4)}`,
    primary_failure_reason: stats.primaryFailureReason || '-'
  };
}
