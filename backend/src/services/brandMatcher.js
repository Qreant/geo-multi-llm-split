/**
 * Brand Matcher Service
 * Uses Gemini 2.5 Flash Lite to intelligently group brand variations and products
 *
 * Handles cases like:
 * - "Tesla" + "Tesla Model 3" + "Tesla Model Y" -> Tesla family
 * - "Hyundai" + "Hyundai Ioniq 5 N" -> Hyundai family
 * - "iPhone 15 Pro" + "Apple" -> Apple family
 */

import { callGeminiForJSON } from './llmService.js';

// Use same model as source classifier - known to work
const BRAND_MATCHER_MODEL = 'gemini-2.5-flash-lite';

/**
 * Group a list of entities by their parent brand
 * Single batch call - efficient for any number of entities
 *
 * @param {string[]} entities - Array of entity names to group
 * @param {string} targetBrand - The primary brand we're analyzing
 * @param {string} apiKey - Gemini API key
 * @returns {Object} { brandGroups, targetMatches, normalizedNames }
 */
export async function groupBrandVariations(entities, targetBrand, apiKey) {
  if (!entities || entities.length === 0) {
    return {
      brandGroups: {},
      targetMatches: [],
      normalizedNames: {}
    };
  }

  // Deduplicate entities (case-insensitive)
  const uniqueEntities = [...new Set(entities.map(e => e.trim()))];

  const prompt = `You are a brand/product classification expert. Analyze these entities and group them by their parent brand or company.

INPUT ENTITIES:
${JSON.stringify(uniqueEntities, null, 2)}

TARGET BRAND TO IDENTIFY:
"${targetBrand}"

INSTRUCTIONS:
1. Group all entities by their parent brand/company
2. Identify which entities match or belong to the target brand "${targetBrand}"
3. Provide a normalized/canonical name for each entity
4. Handle product names, subsidiaries, abbreviations, and variations

EXAMPLES:
- "Tesla Model 3", "Tesla", "Model Y" -> all belong to "Tesla"
- "iPhone 15", "Apple Watch", "MacBook Pro" -> all belong to "Apple"
- "Hyundai Ioniq 5 N", "Hyundai" -> all belong to "Hyundai"
- "BMW", "BMW M3", "Mini Cooper" -> BMW group (Mini is BMW subsidiary)

Return ONLY this JSON structure:
{
  "brand_groups": {
    "ParentBrand1": ["entity1", "entity2"],
    "ParentBrand2": ["entity3"]
  },
  "target_matches": ["entities", "that", "match", "${targetBrand}"],
  "normalized_names": {
    "original entity name": "Normalized Brand Name"
  },
  "confidence": 0.95
}`;

  try {
    console.log(`   🏷️  Grouping ${uniqueEntities.length} entities by brand...`);

    const result = await callGeminiForJSON(prompt, apiKey, BRAND_MATCHER_MODEL);

    if (!result || !result.text) {
      console.warn('   ⚠️  Brand matcher returned empty response, using fallback');
      return createFallbackGroups(uniqueEntities, targetBrand);
    }

    const parsed = JSON.parse(result.text);

    console.log(`   ✅ Grouped into ${Object.keys(parsed.brand_groups || {}).length} brand families`);
    console.log(`   🎯 ${(parsed.target_matches || []).length} entities match target brand "${targetBrand}"`);

    return {
      brandGroups: parsed.brand_groups || {},
      targetMatches: parsed.target_matches || [],
      normalizedNames: parsed.normalized_names || {},
      confidence: parsed.confidence || 0.5
    };
  } catch (error) {
    console.error('   ❌ Brand matching failed:', error.message);
    return createFallbackGroups(uniqueEntities, targetBrand);
  }
}

/**
 * Check if two entities belong to the same brand family
 *
 * @param {string} entity1 - First entity name
 * @param {string} entity2 - Second entity name
 * @param {string} apiKey - Gemini API key
 * @returns {Object} { match: boolean, parentBrand: string, confidence: number }
 */
export async function checkBrandMatch(entity1, entity2, apiKey) {
  const prompt = `Determine if these two entities belong to the same brand/company.

Entity 1: "${entity1}"
Entity 2: "${entity2}"

Consider:
- Parent companies and subsidiaries
- Product lines and variations
- Brand abbreviations and alternate names
- Regional naming differences

Return ONLY this JSON:
{
  "match": true/false,
  "parent_brand": "Common parent brand name or null",
  "relationship": "same_brand|product_of|subsidiary_of|unrelated",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`;

  try {
    const result = await callGeminiForJSON(prompt, apiKey, BRAND_MATCHER_MODEL);

    if (!result || !result.text) {
      return fallbackStringMatch(entity1, entity2);
    }

    const parsed = JSON.parse(result.text);

    return {
      match: parsed.match || false,
      parentBrand: parsed.parent_brand || null,
      relationship: parsed.relationship || 'unrelated',
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || ''
    };
  } catch (error) {
    console.error('   ❌ Brand match check failed:', error.message);
    return fallbackStringMatch(entity1, entity2);
  }
}

/**
 * Aggregate metrics for entities belonging to the same brand family
 * Combines SOV, visibility scores, etc.
 *
 * @param {Array} entityMetrics - Array of { entity, sov, rank, mentions, ... }
 * @param {Object} brandGroups - Result from groupBrandVariations
 * @returns {Array} Aggregated metrics by brand family
 */
export function aggregateByBrandFamily(entityMetrics, brandGroups) {
  const aggregated = {};

  // Create reverse lookup: entity -> parent brand
  const entityToParent = {};
  for (const [parentBrand, entities] of Object.entries(brandGroups)) {
    for (const entity of entities) {
      entityToParent[entity.toLowerCase()] = parentBrand;
    }
  }

  for (const metric of entityMetrics) {
    const entityLower = metric.entity?.toLowerCase() || '';
    const parentBrand = entityToParent[entityLower] || metric.entity;

    if (!aggregated[parentBrand]) {
      aggregated[parentBrand] = {
        brand: parentBrand,
        variants: [],
        totalSov: 0,
        totalMentions: 0,
        bestRank: Infinity,
        avgRank: 0,
        rankCount: 0
      };
    }

    const group = aggregated[parentBrand];
    group.variants.push(metric.entity);
    group.totalSov += metric.sov || 0;
    group.totalMentions += metric.mentions || 0;

    if (metric.rank && metric.rank < group.bestRank) {
      group.bestRank = metric.rank;
    }
    if (metric.rank) {
      group.avgRank += metric.rank;
      group.rankCount++;
    }
  }

  // Finalize averages and convert to array
  return Object.values(aggregated).map(group => ({
    brand: group.brand,
    variants: group.variants,
    sov: group.totalSov,
    mentions: group.totalMentions,
    bestRank: group.bestRank === Infinity ? null : group.bestRank,
    avgRank: group.rankCount > 0 ? group.avgRank / group.rankCount : null
  }));
}

/**
 * Fallback grouping using simple string matching
 * Used when AI call fails
 */
function createFallbackGroups(entities, targetBrand) {
  const groups = {};
  const targetMatches = [];
  const normalized = {};

  for (const entity of entities) {
    const entityLower = entity.toLowerCase();
    const targetLower = targetBrand.toLowerCase();

    // Simple substring matching as fallback
    let parentBrand = entity;

    if (entityLower.includes(targetLower) || targetLower.includes(entityLower)) {
      parentBrand = targetBrand;
      targetMatches.push(entity);
    }

    if (!groups[parentBrand]) {
      groups[parentBrand] = [];
    }
    groups[parentBrand].push(entity);
    normalized[entity] = parentBrand;
  }

  return {
    brandGroups: groups,
    targetMatches,
    normalizedNames: normalized,
    confidence: 0.3 // Low confidence for fallback
  };
}

/**
 * Fallback string matching for two entities
 */
function fallbackStringMatch(entity1, entity2) {
  const e1 = entity1.toLowerCase().trim();
  const e2 = entity2.toLowerCase().trim();

  const match = e1 === e2 || e1.includes(e2) || e2.includes(e1);

  return {
    match,
    parentBrand: match ? (e1.length < e2.length ? entity1 : entity2) : null,
    relationship: match ? 'possible_match' : 'unrelated',
    confidence: match ? 0.6 : 0.8,
    reasoning: 'Fallback substring matching'
  };
}

export default {
  groupBrandVariations,
  checkBrandMatch,
  aggregateByBrandFamily
};
