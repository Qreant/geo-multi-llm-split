/**
 * Question template generation utilities
 * Ported from Google Apps Script V2.17
 */

export const ANALYSIS_TYPES = {
  REPUTATION: 'reputation',
  VISIBILITY: 'visibility',
  COMPETITIVE: 'competitive',
  CATEGORY: 'category',
  PR_INSIGHTS: 'pr_insights'
};

/**
 * Build reputation analysis questions
 * Reputation questions focus on the entity/brand itself, NOT the category
 * @param {string} entity - Entity name (e.g., "Nike", "FXTM")
 */
export function buildReputationQuestions(entity) {
  const templates = [
    `Is {{entity}} good?`,
    `Is {{entity}} worth it?`,
    `Should I buy {{entity}}?`,
    `Is {{entity}} reliable?`,
    `Is {{entity}} a good value?`,
    `Is {{entity}} popular right now?`,
    `Does {{entity}} have good reviews?`,
    `Reviews about {{entity}}?`,
    `{{entity}} pros and cons?`,
    `What do people say about {{entity}}?`
  ];

  return templates.map((t, idx) => ({
    id: `REP_Q${idx + 1}`,
    type: ANALYSIS_TYPES.REPUTATION,
    question: t.replace(/\{\{entity\}\}/g, entity),
    editable: true
  }));
}

/**
 * Build visibility analysis questions
 * @param {string} category - Category (e.g., "online forex trading")
 */
export function buildVisibilityQuestions(category) {
  const templates = [
    `Best {{category}}?`,
    `Top {{category}} brands?`,
    `Top {{category}} models?`,
    `Which {{category}} should I choose?`,
    `What should I look for in {{category}}?`,
    `Most affordable {{category}}?`,
    `Most durable {{category}}?`,
    `Best {{category}} for beginners?`,
    `Best {{category}} for experts?`,
    `Recommend {{category}}.`
  ];

  return templates.map((t, idx) => ({
    id: `VIS_Q${idx + 1}`,
    type: ANALYSIS_TYPES.VISIBILITY,
    question: t.replace(/\{\{category\}\}/g, category),
    editable: true
  }));
}

/**
 * Build competitive analysis questions
 * @param {string} entity - Primary entity
 * @param {string[]} competitors - List of competitors
 * @param {string} category - Optional category
 */
export function buildCompetitiveQuestions(entity, competitors, category) {
  const suffix = category ? ` for ${category}` : '';

  const allEntities = [entity, ...competitors];
  const entityListVs = allEntities.join(' vs ');
  const entityListComma = allEntities.join(', ');
  const entityListOr = allEntities.join(' or ');

  const templates = [
    `${entityListVs} — which is better${suffix}?`,
    `Compare ${entityListComma}${suffix}.`,
    `${entityListOr}${suffix}?`,
    `${entityListVs}${suffix}`,
    `Which is better: ${entityListComma}${suffix}?`,
    `${entityListVs} — which should I buy${suffix}?`,
    `What's the difference between ${entityListComma}${suffix}?`,
    `Which is better value: ${entityListComma}${suffix}?`,
    `Which is more reliable: ${entityListComma}${suffix}?`,
    `Should I get: ${entityListOr}${suffix}?`
  ];

  return templates.map((tpl, idx) => ({
    id: `COMP_Q${idx + 1}`,
    type: ANALYSIS_TYPES.COMPETITIVE,
    question: tpl,
    entities: allEntities,
    editable: true
  }));
}

/**
 * Build category detection questions
 * These questions help identify what categories an entity is associated with
 * Based on GAS buildCategoryDetectionQuestions_
 * @param {string} entity - Entity name
 */
export function buildCategoryDetectionQuestions(entity) {
  const templates = [
    `What is {{entity}} known for?`,
    `What is {{entity}} good for?`,
    `What does {{entity}} do?`
  ];

  return templates.map((t, idx) => ({
    id: `CAT_Q${idx + 1}`,
    type: ANALYSIS_TYPES.CATEGORY,
    question: t.replace(/\{\{entity\}\}/g, entity),
    editable: true
  }));
}

/**
 * Generate all questions for a report configuration
 * @param {Object} config - Report configuration
 */
export function generateAllQuestions(config) {
  const { entity, category, competitors } = config;

  const questions = {
    reputation: buildReputationQuestions(entity),
    visibility: buildVisibilityQuestions(category),
    competitive: buildCompetitiveQuestions(entity, competitors, category),
    category: buildCategoryDetectionQuestions(entity)
  };

  return questions;
}

/**
 * Get total question count
 */
export function getTotalQuestionCount(questions) {
  return Object.values(questions).reduce((total, qArray) => total + qArray.length, 0);
}
