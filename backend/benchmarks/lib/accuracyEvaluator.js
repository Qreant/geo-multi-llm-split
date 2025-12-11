/**
 * Accuracy Evaluator
 * Evaluate classification accuracy using golden set and cross-model consensus
 */

import { APPROVED_SOURCE_TYPES } from '../config.js';

/**
 * Evaluate classifications against a golden set
 * @param {Array} classifications - Array of { url, source_type } from model
 * @param {Array} goldenSet - Array of { url, golden_type } verified classifications
 * @returns {Object} Accuracy evaluation results
 */
export function evaluateAgainstGolden(classifications, goldenSet) {
  if (!goldenSet || goldenSet.length === 0) {
    return { error: 'No golden set provided' };
  }

  // Create lookup map for model classifications
  const classificationMap = new Map();
  classifications.forEach(c => {
    classificationMap.set(c.url, c.source_type);
  });

  // Track correct/incorrect per category
  const perCategory = {};
  APPROVED_SOURCE_TYPES.forEach(type => {
    perCategory[type] = {
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      total: 0
    };
  });
  perCategory['Other'] = { truePositives: 0, falsePositives: 0, falseNegatives: 0, total: 0 };

  let correct = 0;
  let total = 0;
  const mismatches = [];

  goldenSet.forEach(golden => {
    const predicted = classificationMap.get(golden.url);
    const actual = golden.golden_type;

    if (!predicted) {
      // Source not classified (missing)
      return;
    }

    total++;

    if (predicted === actual) {
      correct++;
      if (perCategory[actual]) {
        perCategory[actual].truePositives++;
        perCategory[actual].total++;
      }
    } else {
      // Track misclassification
      mismatches.push({
        url: golden.url,
        expected: actual,
        predicted,
        domain: golden.domain
      });

      // Update category metrics
      if (perCategory[actual]) {
        perCategory[actual].falseNegatives++;
        perCategory[actual].total++;
      }
      if (perCategory[predicted]) {
        perCategory[predicted].falsePositives++;
      }
    }
  });

  // Calculate precision and recall per category
  const categoryMetrics = {};
  Object.entries(perCategory).forEach(([type, counts]) => {
    const precision = counts.truePositives + counts.falsePositives > 0
      ? counts.truePositives / (counts.truePositives + counts.falsePositives)
      : 0;
    const recall = counts.truePositives + counts.falseNegatives > 0
      ? counts.truePositives / (counts.truePositives + counts.falseNegatives)
      : 0;
    const f1 = precision + recall > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    categoryMetrics[type] = {
      precision: precision,
      recall: recall,
      f1: f1,
      support: counts.total
    };
  });

  return {
    overall: {
      accuracy: total > 0 ? correct / total : 0,
      correct,
      total,
      mismatches: mismatches.length
    },
    perCategory: categoryMetrics,
    mismatches: mismatches.slice(0, 20), // Limit to 20 examples
    confusionMatrix: buildConfusionMatrix(goldenSet, classificationMap)
  };
}

/**
 * Build confusion matrix from predictions
 * @param {Array} goldenSet - Golden set with actual labels
 * @param {Map} predictions - Map of url -> predicted label
 * @returns {Object} Confusion matrix
 */
function buildConfusionMatrix(goldenSet, predictions) {
  const categories = [...APPROVED_SOURCE_TYPES, 'Other'];
  const matrix = {};

  // Initialize matrix
  categories.forEach(actual => {
    matrix[actual] = {};
    categories.forEach(predicted => {
      matrix[actual][predicted] = 0;
    });
  });

  // Populate matrix
  goldenSet.forEach(golden => {
    const actual = golden.golden_type;
    const predicted = predictions.get(golden.url);

    if (predicted && matrix[actual] && matrix[actual][predicted] !== undefined) {
      matrix[actual][predicted]++;
    }
  });

  return matrix;
}

/**
 * Compute cross-model consensus for accuracy validation
 * @param {Object} allModelResults - Object with modelId -> classifications array
 * @returns {Object} Consensus analysis
 */
export function computeCrossModelConsensus(allModelResults) {
  const modelIds = Object.keys(allModelResults);

  if (modelIds.length < 2) {
    return { error: 'Need at least 2 models for consensus analysis' };
  }

  // Build URL -> model votes map
  const urlVotes = new Map();

  modelIds.forEach(modelId => {
    const classifications = allModelResults[modelId];
    if (!Array.isArray(classifications)) return;

    classifications.forEach(c => {
      if (!urlVotes.has(c.url)) {
        urlVotes.set(c.url, {});
      }
      const votes = urlVotes.get(c.url);
      votes[modelId] = c.source_type;
    });
  });

  // Calculate consensus for each URL
  const consensusResults = [];
  let totalWithConsensus = 0;
  let totalAmbiguous = 0;

  urlVotes.forEach((votes, url) => {
    const voteCounts = {};
    Object.values(votes).forEach(type => {
      voteCounts[type] = (voteCounts[type] || 0) + 1;
    });

    // Find majority (need > 50% of models to agree)
    const threshold = Math.ceil(modelIds.length / 2);
    let consensusType = null;
    let maxVotes = 0;

    Object.entries(voteCounts).forEach(([type, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        consensusType = type;
      }
    });

    const hasConsensus = maxVotes >= threshold;

    if (hasConsensus) {
      totalWithConsensus++;
    } else {
      totalAmbiguous++;
    }

    consensusResults.push({
      url,
      votes,
      consensus: hasConsensus ? consensusType : null,
      agreement: maxVotes / modelIds.length
    });
  });

  // Calculate per-model agreement with consensus
  const modelAgreement = {};
  modelIds.forEach(modelId => {
    let agreed = 0;
    let total = 0;

    consensusResults.forEach(result => {
      if (result.consensus && result.votes[modelId]) {
        total++;
        if (result.votes[modelId] === result.consensus) {
          agreed++;
        }
      }
    });

    modelAgreement[modelId] = total > 0 ? agreed / total : 0;
  });

  // Find most reliable model (highest agreement with consensus)
  let mostReliableModel = null;
  let highestAgreement = 0;
  Object.entries(modelAgreement).forEach(([modelId, agreement]) => {
    if (agreement > highestAgreement) {
      highestAgreement = agreement;
      mostReliableModel = modelId;
    }
  });

  return {
    totalUrls: urlVotes.size,
    totalWithConsensus,
    totalAmbiguous,
    consensusRate: urlVotes.size > 0 ? totalWithConsensus / urlVotes.size : 0,
    modelAgreement,
    mostReliableModel,
    mostReliableAgreement: highestAgreement,
    sampleConsensus: consensusResults.slice(0, 10)
  };
}

/**
 * Generate accuracy report combining golden set and consensus analysis
 * @param {Object} goldenEval - Golden set evaluation results
 * @param {Object} consensusEval - Cross-model consensus results
 * @returns {Object} Combined accuracy report
 */
export function generateAccuracyReport(goldenEval, consensusEval) {
  return {
    timestamp: new Date().toISOString(),
    goldenSetEvaluation: goldenEval,
    crossModelConsensus: consensusEval,
    summary: {
      goldenAccuracy: goldenEval?.overall?.accuracy || null,
      consensusRate: consensusEval?.consensusRate || null,
      mostReliableModel: consensusEval?.mostReliableModel || null,
      modelRankings: consensusEval?.modelAgreement
        ? Object.entries(consensusEval.modelAgreement)
            .sort((a, b) => b[1] - a[1])
            .map(([model, agreement]) => ({ model, agreement }))
        : []
    }
  };
}

/**
 * Quick accuracy check - compare two classification arrays
 * @param {Array} predictions - Model predictions
 * @param {Array} reference - Reference classifications
 * @returns {number} Accuracy (0-1)
 */
export function quickAccuracyCheck(predictions, reference) {
  const predMap = new Map(predictions.map(p => [p.url, p.source_type]));
  let matches = 0;
  let total = 0;

  reference.forEach(ref => {
    const pred = predMap.get(ref.url);
    if (pred !== undefined) {
      total++;
      if (pred === (ref.golden_type || ref.source_type)) {
        matches++;
      }
    }
  });

  return total > 0 ? matches / total : 0;
}
