/**
 * Category Aggregator Service
 * Aggregates category detection responses from multiple LLM calls
 * Based on GEO_Multi-LLM_Analysis_V2.17_DUAL_LLM.gs aggregateCategoryAnalysis_()
 */

/**
 * Calculate SOV (Share of Voice) - Matches GAS calculateSOV_() formula
 * Formula: visibility * (2 / (avgPosition + 1))
 * Position 1: w_r = 2/2 = 1.0, Position 2: w_r = 2/3 = 0.67, Position 3: w_r = 2/4 = 0.5
 */
function calculateSOV(visibility, averagePosition) {
  if (visibility === 0 || averagePosition === 0) return 0;
  const w_r = 2 / (averagePosition + 1);
  return visibility * w_r;
}

/**
 * Aggregate category detection responses from raw LLM responses
 * @param {Array} rawResponses - Array of {question, gemini: {data, sources}, openai: {data, sources}}
 * @param {Object} config - Analysis config with entity name
 * @returns {Object} Aggregated categories data
 */
export function aggregateCategoryAnalysis(rawResponses, config) {
  console.log('[CategoryAggregator] Starting aggregation');
  console.log('[CategoryAggregator] Raw responses count:', rawResponses.length);

  if (!rawResponses || rawResponses.length === 0) {
    return { categories: [] };
  }

  const totalQuestions = rawResponses.length;
  const categoryMap = {};

  // Get entity name for filtering (normalize for comparison)
  const entityName = config?.entity?.toLowerCase().trim() || '';

  // Process each response from both LLMs
  rawResponses.forEach(response => {
    // Process Gemini response
    if (response.gemini?.data?.categories) {
      processCategoryResponse(response.gemini.data.categories, categoryMap, 'gemini', entityName);
    }

    // Process OpenAI response
    if (response.openai?.data?.categories) {
      processCategoryResponse(response.openai.data.categories, categoryMap, 'openai', entityName);
    }
  });

  // Calculate metrics for each category
  // Total possible mentions = questions * 2 LLMs
  const totalPossibleMentions = totalQuestions * 2;

  const categoriesList = Object.values(categoryMap)
    .map(cat => {
      const category_visibility = cat.mentions / totalPossibleMentions;
      const average_position = cat.ranks.length > 0
        ? cat.ranks.reduce((a, b) => a + b, 0) / cat.ranks.length
        : 0;
      const sov = calculateSOV(category_visibility, average_position);

      // Aggregate competitors for this category
      const topCompetitors = Object.values(cat.competitorsMap)
        .map(comp => {
          const comp_avg_rank = comp.ranks.length > 0
            ? comp.ranks.reduce((a, b) => a + b, 0) / comp.ranks.length
            : 0;

          return {
            name: comp.name,
            average_rank: comp_avg_rank,
            mentions: comp.mentions,
            frequency: comp.mentions / cat.mentions,
            comment: comp.comments.length > 0 ? comp.comments[0] : ''
          };
        })
        .sort((a, b) => a.average_rank - b.average_rank)
        .slice(0, 5);

      return {
        name: cat.name,
        category_sov: sov,
        category_visibility: category_visibility,
        average_position: average_position,
        mentions: cat.mentions,
        frequency: category_visibility,
        comment: cat.comments.length > 0 ? cat.comments[0] : 'Associated category',
        top_competitors: topCompetitors,
        cited_by: cat.cited_by
      };
    })
    .sort((a, b) => b.category_sov - a.category_sov)
    .slice(0, 10);

  console.log('[CategoryAggregator] Categories found:', categoriesList.length);
  categoriesList.forEach(cat => {
    console.log(`  - ${cat.name}: SOV ${(cat.category_sov * 100).toFixed(1)}%, Visibility ${(cat.category_visibility * 100).toFixed(0)}%, Rank ${cat.average_position.toFixed(1)}`);
  });

  return {
    categories: categoriesList,
    total_questions: totalQuestions
  };
}

/**
 * Process categories from a single LLM response
 */
function processCategoryResponse(categories, categoryMap, llmSource, entityName) {
  if (!Array.isArray(categories)) return;

  categories.forEach(cat => {
    const catName = normalizeCategory(cat.name);
    if (!catName) return;

    if (!categoryMap[catName]) {
      categoryMap[catName] = {
        name: catName,
        ranks: [],
        mentions: 0,
        comments: [],
        competitorsMap: {},
        cited_by: []
      };
    }

    categoryMap[catName].mentions++;

    if (cat.rank) {
      categoryMap[catName].ranks.push(cat.rank);
    }

    if (cat.comment) {
      categoryMap[catName].comments.push(cat.comment);
    }

    if (!categoryMap[catName].cited_by.includes(llmSource)) {
      categoryMap[catName].cited_by.push(llmSource);
    }

    // Process competitors for this category
    if (cat.top_competitors && Array.isArray(cat.top_competitors)) {
      cat.top_competitors.forEach(comp => {
        const compName = comp.name;
        if (!compName) return;

        // Filter out the main entity from competitors
        if (entityName && compName.toLowerCase().trim() === entityName) {
          return;
        }

        if (!categoryMap[catName].competitorsMap[compName]) {
          categoryMap[catName].competitorsMap[compName] = {
            name: compName,
            ranks: [],
            mentions: 0,
            comments: []
          };
        }

        categoryMap[catName].competitorsMap[compName].mentions++;

        if (comp.rank) {
          categoryMap[catName].competitorsMap[compName].ranks.push(comp.rank);
        }

        if (comp.comment) {
          categoryMap[catName].competitorsMap[compName].comments.push(comp.comment);
        }
      });
    }
  });
}

/**
 * Normalize category name (remove extra whitespace, consistent casing)
 */
function normalizeCategory(name) {
  if (!name || typeof name !== 'string') return null;
  return name.trim();
}
