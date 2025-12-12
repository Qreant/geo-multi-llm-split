/**
 * Analysis Validator
 * Validates JSON output quality for different analysis types
 */

/**
 * Validate reputation analysis response
 * Expected format: { raw_response, sources_cited }
 */
export function validateReputationResponse(response) {
  const checks = {
    validJson: true,
    hasRawResponse: false,
    hasSources: false,
    sourcesHaveUrls: false,
    sourcesHaveTitles: false,
    rawResponseNotEmpty: false
  };

  try {
    // Check raw_response
    if (response.raw_response && typeof response.raw_response === 'string') {
      checks.hasRawResponse = true;
      checks.rawResponseNotEmpty = response.raw_response.trim().length > 10;
    }

    // Check sources_cited
    if (Array.isArray(response.sources_cited)) {
      checks.hasSources = response.sources_cited.length > 0;

      if (checks.hasSources) {
        checks.sourcesHaveUrls = response.sources_cited.every(
          s => s.url && typeof s.url === 'string' && s.url.startsWith('http')
        );
        checks.sourcesHaveTitles = response.sources_cited.every(
          s => s.title && typeof s.title === 'string' && s.title.length > 0
        );
      }
    }
  } catch (e) {
    checks.validJson = false;
  }

  const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
  const valid = checks.validJson && checks.hasRawResponse && checks.hasSources;

  return { valid, score, checks };
}

/**
 * Validate visibility analysis response
 * Expected format: { entities_ranking, sources_cited_news, sources_cited_other }
 */
export function validateVisibilityResponse(response) {
  const checks = {
    validJson: true,
    hasEntitiesRanking: false,
    entitiesHaveRank: false,
    entitiesHaveName: false,
    entitiesHaveComment: false,
    hasSourcesNews: false,
    hasSourcesOther: false,
    sourcesHaveUrls: false
  };

  try {
    // Check entities_ranking
    if (Array.isArray(response.entities_ranking)) {
      checks.hasEntitiesRanking = response.entities_ranking.length > 0;

      if (checks.hasEntitiesRanking) {
        checks.entitiesHaveRank = response.entities_ranking.every(
          e => typeof e.rank === 'number'
        );
        checks.entitiesHaveName = response.entities_ranking.every(
          e => e.name && typeof e.name === 'string'
        );
        checks.entitiesHaveComment = response.entities_ranking.every(
          e => e.comment && typeof e.comment === 'string'
        );
      }
    }

    // Check sources
    checks.hasSourcesNews = Array.isArray(response.sources_cited_news);
    checks.hasSourcesOther = Array.isArray(response.sources_cited_other);

    const allSources = [
      ...(response.sources_cited_news || []),
      ...(response.sources_cited_other || [])
    ];

    if (allSources.length > 0) {
      checks.sourcesHaveUrls = allSources.every(
        s => s.url && typeof s.url === 'string' && s.url.startsWith('http')
      );
    } else {
      checks.sourcesHaveUrls = true; // No sources is acceptable
    }
  } catch (e) {
    checks.validJson = false;
  }

  const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
  const valid = checks.validJson && checks.hasEntitiesRanking && checks.entitiesHaveName;

  return { valid, score, checks };
}

/**
 * Validate competitive analysis response
 * Expected format: { entity_choice, entity_analysis, sources_cited_news, sources_cited_other, raw_response }
 */
export function validateCompetitiveResponse(response, expectedEntities = []) {
  const checks = {
    validJson: true,
    hasEntityChoice: false,
    entityChoiceValid: false,
    hasEntityAnalysis: false,
    analysisHasPros: false,
    analysisHasCons: false,
    hasRawResponse: false,
    hasSourcesNews: false,
    hasSourcesOther: false,
    sourcesHaveUrls: false
  };

  try {
    // Check entity_choice
    if (response.entity_choice && typeof response.entity_choice === 'string') {
      checks.hasEntityChoice = true;
      if (expectedEntities.length > 0) {
        checks.entityChoiceValid = expectedEntities.includes(response.entity_choice);
      } else {
        checks.entityChoiceValid = true;
      }
    }

    // Check entity_analysis
    if (response.entity_analysis && typeof response.entity_analysis === 'object') {
      checks.hasEntityAnalysis = true;

      const entities = Object.values(response.entity_analysis);
      if (entities.length > 0) {
        checks.analysisHasPros = entities.every(
          e => Array.isArray(e.pros) && e.pros.length > 0
        );
        checks.analysisHasCons = entities.every(
          e => Array.isArray(e.cons) && e.cons.length > 0
        );
      }
    }

    // Check raw_response
    checks.hasRawResponse = response.raw_response && typeof response.raw_response === 'string';

    // Check sources
    checks.hasSourcesNews = Array.isArray(response.sources_cited_news);
    checks.hasSourcesOther = Array.isArray(response.sources_cited_other);

    const allSources = [
      ...(response.sources_cited_news || []),
      ...(response.sources_cited_other || [])
    ];

    if (allSources.length > 0) {
      checks.sourcesHaveUrls = allSources.every(
        s => s.url && typeof s.url === 'string' && s.url.startsWith('http')
      );
    } else {
      checks.sourcesHaveUrls = true;
    }
  } catch (e) {
    checks.validJson = false;
  }

  const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
  const valid = checks.validJson && checks.hasEntityChoice && checks.hasEntityAnalysis;

  return { valid, score, checks };
}

/**
 * Validate category detection response
 * Expected format: { categories: [{ rank, name, comment, top_competitors }] }
 */
export function validateCategoryResponse(response, brandName = '') {
  const checks = {
    validJson: true,
    hasCategories: false,
    categoriesHaveRank: false,
    categoriesHaveName: false,
    categoriesHaveComment: false,
    hasTopCompetitors: false,
    competitorsValid: false,
    noBrandInCompetitors: true
  };

  try {
    // Check categories array
    if (Array.isArray(response.categories)) {
      checks.hasCategories = response.categories.length > 0;

      if (checks.hasCategories) {
        checks.categoriesHaveRank = response.categories.every(
          c => typeof c.rank === 'number'
        );
        checks.categoriesHaveName = response.categories.every(
          c => c.name && typeof c.name === 'string' && c.name.length > 0
        );
        checks.categoriesHaveComment = response.categories.every(
          c => c.comment && typeof c.comment === 'string'
        );

        // Check top_competitors
        checks.hasTopCompetitors = response.categories.every(
          c => Array.isArray(c.top_competitors)
        );

        if (checks.hasTopCompetitors) {
          checks.competitorsValid = response.categories.every(c =>
            c.top_competitors.every(comp =>
              comp.name && typeof comp.name === 'string'
            )
          );

          // Brand should not be in its own competitors
          if (brandName) {
            checks.noBrandInCompetitors = response.categories.every(c =>
              c.top_competitors.every(comp =>
                comp.name.toLowerCase() !== brandName.toLowerCase()
              )
            );
          }
        }
      }
    }
  } catch (e) {
    checks.validJson = false;
  }

  const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length;
  const valid = checks.validJson && checks.hasCategories && checks.categoriesHaveName;

  return { valid, score, checks };
}

/**
 * Validate response based on analysis type
 */
export function validateResponse(response, analysisType, options = {}) {
  switch (analysisType) {
    case 'reputation':
      return validateReputationResponse(response);
    case 'visibility':
      return validateVisibilityResponse(response);
    case 'competitive':
      return validateCompetitiveResponse(response, options.entities || []);
    case 'category':
      return validateCategoryResponse(response, options.brand || '');
    default:
      return { valid: false, score: 0, checks: { unknownType: true } };
  }
}

/**
 * Calculate overall quality score from multiple validation results
 */
export function calculateQualityMetrics(validationResults) {
  const total = validationResults.length;
  if (total === 0) return { validRate: 0, avgScore: 0, checkSummary: {} };

  const validCount = validationResults.filter(r => r.valid).length;
  const avgScore = validationResults.reduce((sum, r) => sum + r.score, 0) / total;

  // Aggregate check results
  const checkSummary = {};
  validationResults.forEach(r => {
    Object.entries(r.checks).forEach(([key, value]) => {
      if (!checkSummary[key]) {
        checkSummary[key] = { passed: 0, total: 0 };
      }
      checkSummary[key].total++;
      if (value) checkSummary[key].passed++;
    });
  });

  return {
    validRate: validCount / total,
    avgScore,
    checkSummary
  };
}
