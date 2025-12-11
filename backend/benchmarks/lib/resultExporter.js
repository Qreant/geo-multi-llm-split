/**
 * Result Exporter
 * Export benchmark results to CSV and JSON formats
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensure results directory exists
 * @returns {string} Path to results directory
 */
function ensureResultsDir() {
  const resultsDir = path.resolve(__dirname, '..', 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  return resultsDir;
}

/**
 * Generate timestamp for filenames
 * @returns {string} ISO timestamp suitable for filenames
 */
function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Export summary to CSV
 * @param {Array} results - Array of aggregated statistics objects
 * @param {string} filename - Optional filename (without extension)
 * @returns {string} Path to created file
 */
export function exportSummaryCSV(results, filename = null) {
  const resultsDir = ensureResultsDir();
  const timestamp = getTimestamp();
  const filepath = path.join(resultsDir, filename || `benchmark-${timestamp}-summary.csv`);

  // CSV headers
  const headers = [
    'model_id',
    'batch_size',
    'test_runs',
    'success_rate',
    'avg_latency_ms',
    'p50_latency_ms',
    'p95_latency_ms',
    'latency_per_source_ms',
    'avg_input_tokens',
    'avg_output_tokens',
    'cost_per_500_sources',
    'accuracy_golden',
    'accuracy_consensus',
    'primary_failure_reason'
  ];

  // Build CSV rows
  const rows = results.map(r => [
    r.modelId,
    r.batchSize,
    r.testRuns,
    `${(r.successRate * 100).toFixed(1)}%`,
    Math.round(r.avgLatencyMs || 0),
    Math.round(r.p50LatencyMs || 0),
    Math.round(r.p95LatencyMs || 0),
    Math.round(r.avgLatencyPerSource || 0),
    Math.round(r.avgInputTokens || 0),
    Math.round(r.avgOutputTokens || 0),
    `$${(r.costPer500Sources || 0).toFixed(4)}`,
    r.accuracyGolden ? `${(r.accuracyGolden * 100).toFixed(1)}%` : '-',
    r.accuracyConsensus ? `${(r.accuracyConsensus * 100).toFixed(1)}%` : '-',
    r.primaryFailureReason || '-'
  ]);

  // Write CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  fs.writeFileSync(filepath, csvContent);
  console.log(`CSV summary exported to: ${filepath}`);

  return filepath;
}

/**
 * Export detailed results to JSON
 * @param {Object} benchmarkData - Full benchmark data including metadata and results
 * @param {string} filename - Optional filename (without extension)
 * @returns {string} Path to created file
 */
export function exportDetailedJSON(benchmarkData, filename = null) {
  const resultsDir = ensureResultsDir();
  const timestamp = getTimestamp();
  const filepath = path.join(resultsDir, filename || `benchmark-${timestamp}-detailed.json`);

  const exportData = {
    exportedAt: new Date().toISOString(),
    ...benchmarkData
  };

  fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
  console.log(`Detailed JSON exported to: ${filepath}`);

  return filepath;
}

/**
 * Export accuracy report to JSON
 * @param {Object} accuracyData - Accuracy evaluation data
 * @param {string} filename - Optional filename (without extension)
 * @returns {string} Path to created file
 */
export function exportAccuracyReport(accuracyData, filename = null) {
  const resultsDir = ensureResultsDir();
  const timestamp = getTimestamp();
  const filepath = path.join(resultsDir, filename || `benchmark-${timestamp}-accuracy.json`);

  fs.writeFileSync(filepath, JSON.stringify(accuracyData, null, 2));
  console.log(`Accuracy report exported to: ${filepath}`);

  return filepath;
}

/**
 * Save raw test data for reproducibility
 * @param {Array} sources - Test source data
 * @param {string} filename - Optional filename (without extension)
 * @returns {string} Path to created file
 */
export function saveRawTestData(sources, filename = null) {
  const resultsDir = ensureResultsDir();
  const timestamp = getTimestamp();
  const filepath = path.join(resultsDir, filename || `benchmark-${timestamp}-sources.json`);

  const data = {
    savedAt: new Date().toISOString(),
    count: sources.length,
    sources
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`Raw test data saved to: ${filepath}`);

  return filepath;
}

/**
 * Generate recommendations based on results
 * @param {Array} results - Array of aggregated statistics
 * @returns {Object} Recommendations
 */
export function generateRecommendations(results) {
  if (!results || results.length === 0) {
    return { error: 'No results to analyze' };
  }

  // Filter out failed configurations
  const validResults = results.filter(r => r.successRate > 0.5);

  if (validResults.length === 0) {
    return {
      error: 'All configurations had >50% failure rate',
      bestAttempt: results.sort((a, b) => b.successRate - a.successRate)[0]
    };
  }

  // Sort for different criteria
  const sortedByLatency = [...validResults].sort((a, b) => a.avgLatencyPerSource - b.avgLatencyPerSource);
  const sortedByCost = [...validResults].sort((a, b) => a.costPer500Sources - b.costPer500Sources);
  const sortedByAccuracy = [...validResults]
    .filter(r => r.accuracyGolden)
    .sort((a, b) => b.accuracyGolden - a.accuracyGolden);
  const sortedBySuccessRate = [...validResults].sort((a, b) => b.successRate - a.successRate);

  // Calculate overall score (normalized weighted average)
  const scoredResults = validResults.map(r => {
    // Normalize each metric (0-1 scale, higher is better)
    const latencyScore = 1 - (r.avgLatencyPerSource / Math.max(...validResults.map(x => x.avgLatencyPerSource)));
    const costScore = 1 - (r.costPer500Sources / Math.max(...validResults.map(x => x.costPer500Sources)));
    const accuracyScore = r.accuracyGolden || 0.5; // Default to 0.5 if no accuracy data
    const reliabilityScore = r.successRate;

    // Weighted overall score
    const overallScore = (
      latencyScore * 0.25 +
      costScore * 0.20 +
      accuracyScore * 0.30 +
      reliabilityScore * 0.25
    );

    return { ...r, overallScore };
  });

  const sortedByOverall = [...scoredResults].sort((a, b) => b.overallScore - a.overallScore);

  return {
    bestOverall: {
      modelId: sortedByOverall[0].modelId,
      batchSize: sortedByOverall[0].batchSize,
      score: sortedByOverall[0].overallScore,
      details: formatResult(sortedByOverall[0])
    },
    bestLatency: {
      modelId: sortedByLatency[0].modelId,
      batchSize: sortedByLatency[0].batchSize,
      latencyPerSource: sortedByLatency[0].avgLatencyPerSource,
      details: formatResult(sortedByLatency[0])
    },
    bestCost: {
      modelId: sortedByCost[0].modelId,
      batchSize: sortedByCost[0].batchSize,
      costPer500: sortedByCost[0].costPer500Sources,
      details: formatResult(sortedByCost[0])
    },
    bestAccuracy: sortedByAccuracy.length > 0 ? {
      modelId: sortedByAccuracy[0].modelId,
      batchSize: sortedByAccuracy[0].batchSize,
      accuracy: sortedByAccuracy[0].accuracyGolden,
      details: formatResult(sortedByAccuracy[0])
    } : null,
    bestReliability: {
      modelId: sortedBySuccessRate[0].modelId,
      batchSize: sortedBySuccessRate[0].batchSize,
      successRate: sortedBySuccessRate[0].successRate,
      details: formatResult(sortedBySuccessRate[0])
    },
    allRankings: sortedByOverall.map((r, i) => ({
      rank: i + 1,
      modelId: r.modelId,
      batchSize: r.batchSize,
      overallScore: r.overallScore.toFixed(3)
    }))
  };
}

/**
 * Format result for display
 * @param {Object} result - Result object
 * @returns {string} Formatted string
 */
function formatResult(result) {
  return `${result.modelId} @ batch ${result.batchSize}: ` +
    `${(result.successRate * 100).toFixed(0)}% success, ` +
    `${Math.round(result.avgLatencyPerSource)}ms/source, ` +
    `$${result.costPer500Sources.toFixed(4)}/500`;
}

/**
 * Print summary to console
 * @param {Array} results - Array of aggregated statistics
 * @param {Object} recommendations - Recommendations object
 */
export function printSummary(results, recommendations) {
  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK RESULTS SUMMARY');
  console.log('='.repeat(80));

  // Print table header
  console.log('\n%-20s %-10s %-12s %-12s %-15s %-12s'.replace(/%(-?\d+)s/g, (_, w) => {
    return '%s'.padEnd(Math.abs(parseInt(w)));
  }));

  console.log(
    'Model'.padEnd(20) +
    'Batch'.padEnd(10) +
    'Success'.padEnd(12) +
    'Latency/src'.padEnd(12) +
    'Cost/500'.padEnd(15) +
    'Accuracy'
  );
  console.log('-'.repeat(80));

  // Sort by model then batch size
  const sorted = [...results].sort((a, b) => {
    if (a.modelId !== b.modelId) return a.modelId.localeCompare(b.modelId);
    return a.batchSize - b.batchSize;
  });

  sorted.forEach(r => {
    console.log(
      r.modelId.padEnd(20) +
      String(r.batchSize).padEnd(10) +
      `${(r.successRate * 100).toFixed(0)}%`.padEnd(12) +
      `${Math.round(r.avgLatencyPerSource || 0)}ms`.padEnd(12) +
      `$${(r.costPer500Sources || 0).toFixed(4)}`.padEnd(15) +
      (r.accuracyGolden ? `${(r.accuracyGolden * 100).toFixed(0)}%` : '-')
    );
  });

  // Print recommendations
  if (recommendations && !recommendations.error) {
    console.log('\n' + '='.repeat(80));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(80));

    console.log(`\nBest Overall:    ${recommendations.bestOverall.details}`);
    console.log(`Best Latency:    ${recommendations.bestLatency.details}`);
    console.log(`Best Cost:       ${recommendations.bestCost.details}`);
    if (recommendations.bestAccuracy) {
      console.log(`Best Accuracy:   ${recommendations.bestAccuracy.details}`);
    }
    console.log(`Best Reliability: ${recommendations.bestReliability.details}`);
  }

  console.log('\n' + '='.repeat(80));
}
