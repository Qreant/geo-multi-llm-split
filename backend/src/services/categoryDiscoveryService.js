/**
 * Category Discovery Service
 * Detects categories an entity is known for with translations for all selected languages
 *
 * Uses a SINGLE prompt to detect categories and get translations for all markets at once.
 * This is for onboarding only - the main analysis uses different prompts.
 */

import { v4 as uuidv4 } from 'uuid';
import { callGemini } from './llmService.js';

// Use Flash Lite for faster category discovery
const CATEGORY_DISCOVERY_MODEL = 'gemini-2.5-flash-lite';

/**
 * Discover categories for an entity across multiple markets in a single prompt
 * @param {string} entity - Brand/entity name
 * @param {Array} markets - Array of {country, language, code} objects
 * @param {string} apiKey - Gemini API key
 * @returns {Object} - Category families with translations
 */
export async function discoverCategories(entity, markets, apiKey) {
  console.log(`\n🔍 Discovering categories for "${entity}" across ${markets.length} markets`);

  const startTime = Date.now();

  // Get unique languages from markets
  const languages = [...new Set(markets.map(m => m.language))];
  const languageList = languages.join(', ');

  // Build market codes mapping for the prompt
  const marketInfo = markets.map(m => `${m.language} (${m.code})`).join(', ');

  const prompt = `What product/service categories is "${entity}" known for?

Return categories with names in these languages: ${languageList}

For each category, provide:
1. The category name in each language
2. 2-4 main competitors in that category

Return ONLY valid JSON in this exact format:
{
  "categories": [
    {
      "canonical_name": "athletic_footwear",
      "translations": {
        "English": "Athletic Footwear",
        "French": "Chaussures de sport",
        "Italian": "Calzature sportive"
      },
      "competitors": ["Nike", "Adidas", "New Balance"]
    },
    {
      "canonical_name": "sportswear",
      "translations": {
        "English": "Sportswear",
        "French": "Vêtements de sport",
        "Italian": "Abbigliamento sportivo"
      },
      "competitors": ["Nike", "Adidas", "Under Armour"]
    }
  ]
}

Include 4-8 main categories. Return ONLY JSON, no explanations.`;

  try {
    const response = await callGemini(prompt, apiKey, {
      model: CATEGORY_DISCOVERY_MODEL,
      temperature: 0.3,
      maxOutputTokens: 3000
    });

    const parsed = parseJsonObject(response);
    const categories = parsed.categories || [];

    if (categories.length === 0) {
      console.log('⚠️  No categories detected');
      return {
        category_families: [],
        detection_by_market: {},
        discovery_time_ms: Date.now() - startTime
      };
    }

    // Convert to category families format
    const categoryFamilies = categories.map(cat => {
      // Build translations object with market codes
      const translations = {};
      const detectedInMarkets = [];

      for (const market of markets) {
        const translatedName = cat.translations?.[market.language];
        if (translatedName) {
          translations[market.code] = {
            name: translatedName,
            detected: true,
            confidence: 0.85
          };
          detectedInMarkets.push(market.code);
        }
      }

      // Build suggested_competitors per market (same competitors for all markets for now)
      const suggested_competitors = {};
      for (const market of markets) {
        suggested_competitors[market.code] = cat.competitors || [];
      }

      return {
        id: `cat_${uuidv4().slice(0, 8)}`,
        canonical_name: cat.canonical_name || slugify(cat.translations?.English || Object.values(cat.translations)[0]),
        translations,
        detected_in_markets: detectedInMarkets,
        match_confidence: 0.9,
        source: 'detected',
        suggested_competitors
      };
    });

    // Build detection_by_market for backwards compatibility
    const detectionByMarket = {};
    for (const market of markets) {
      detectionByMarket[market.code] = categoryFamilies
        .filter(fam => fam.translations[market.code])
        .map(fam => ({
          name: fam.translations[market.code].name,
          competitors: fam.suggested_competitors[market.code] || []
        }));
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Category discovery completed in ${duration}ms - Found ${categoryFamilies.length} categories`);

    return {
      category_families: categoryFamilies,
      detection_by_market: detectionByMarket,
      discovery_time_ms: duration
    };

  } catch (error) {
    console.error('❌ Error discovering categories:', error.message);
    return {
      category_families: [],
      detection_by_market: {},
      discovery_time_ms: Date.now() - startTime
    };
  }
}

/**
 * Suggest competitors for a category in a specific market
 * @param {string} entity - Brand name
 * @param {string} categoryName - Category name (in market language)
 * @param {Object} market - Market object {country, language, code}
 * @param {string} apiKey - Gemini API key
 * @returns {Array} - Array of competitor names
 */
export async function suggestCompetitors(entity, categoryName, market, apiKey) {
  const { country, language } = market;

  const prompt = `You are identifying the main competitors of "${entity}" in the "${categoryName}" category in ${country}.

Return a JSON array of 4-6 competitor brand names that:
1. Compete directly with ${entity} in the ${categoryName} category
2. Are relevant/available in ${country}
3. Are well-known to consumers in this market

IMPORTANT:
- Return ONLY brand names, not product names
- Prioritize local/regional competitors if they're significant
- Include both global and local competitors
- Return ONLY a valid JSON array, no explanations

Competitors for "${entity}" in "${categoryName}" (${country}):`;

  try {
    const response = await callGemini(prompt, apiKey, {
      model: CATEGORY_DISCOVERY_MODEL,
      temperature: 0.3,
      maxOutputTokens: 500
    });

    return parseJsonArray(response);
  } catch (error) {
    console.error(`Error suggesting competitors for ${entity} in ${categoryName}:`, error.message);
    return [];
  }
}

/**
 * Translate a category name to a target language
 * @param {string} categoryName - Original category name
 * @param {string} sourceLanguage - Source language
 * @param {string} targetLanguage - Target language
 * @param {string} apiKey - Gemini API key
 * @returns {string} - Translated category name
 */
export async function translateCategory(categoryName, sourceLanguage, targetLanguage, apiKey) {
  if (sourceLanguage === targetLanguage) {
    return categoryName;
  }

  const prompt = `Translate this product/service category name from ${sourceLanguage} to ${targetLanguage}.

Category: "${categoryName}"

Return ONLY the translated category name, nothing else. The translation should be:
- Natural and commonly used in the target language
- What consumers would actually search for
- NOT a literal word-for-word translation if that sounds unnatural

Translation:`;

  try {
    const response = await callGemini(prompt, apiKey, {
      model: CATEGORY_DISCOVERY_MODEL,
      temperature: 0.1,
      maxOutputTokens: 100
    });

    return response.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error(`Error translating category "${categoryName}":`, error.message);
    return categoryName;
  }
}

/**
 * Translate multiple categories to a target language (batch)
 */
export async function translateCategories(categories, sourceLanguage, targetLanguage, apiKey) {
  if (sourceLanguage === targetLanguage) {
    return categories;
  }

  const prompt = `Translate these product/service category names from ${sourceLanguage} to ${targetLanguage}.

Categories:
${categories.map((c, i) => `${i + 1}. "${c}"`).join('\n')}

Return a JSON array with the translations in the same order:
["translation1", "translation2", ...]

The translations should be:
- Natural and commonly used in ${targetLanguage}
- What consumers would actually search for
- NOT literal word-for-word translations if that sounds unnatural

Return ONLY the JSON array:`;

  try {
    const response = await callGemini(prompt, apiKey, {
      model: CATEGORY_DISCOVERY_MODEL,
      temperature: 0.1,
      maxOutputTokens: 1000
    });

    return parseJsonArray(response);
  } catch (error) {
    console.error('Error batch translating categories:', error.message);
    return categories;
  }
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Parse a JSON array from LLM response
 */
function parseJsonArray(text) {
  try {
    // Try direct parse first
    const cleaned = text.trim();
    if (cleaned.startsWith('[')) {
      return JSON.parse(cleaned);
    }

    // Try to extract JSON array from text
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }

    return [];
  } catch (error) {
    console.error('Failed to parse JSON array:', error.message);
    return [];
  }
}

/**
 * Parse a JSON object from LLM response
 * Uses brace-counting algorithm for robust extraction
 */
function parseJsonObject(text) {
  if (!text || typeof text !== 'string') {
    console.error('Failed to parse JSON object: Invalid input type');
    return {};
  }

  try {
    const cleaned = text.trim();

    // Find the start of JSON object
    const startIdx = cleaned.indexOf('{');
    if (startIdx === -1) {
      return {};
    }

    // Use brace-counting to find the matching closing brace
    let braceCount = 0;
    let endIdx = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = startIdx; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx === -1) {
      // Try simple regex as fallback
      const match = cleaned.match(/\{[\s\S]*?\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return {};
    }

    const jsonStr = cleaned.substring(startIdx, endIdx + 1);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse JSON object:', error.message);
    return {};
  }
}

/**
 * Convert a string to a slug (lowercase, underscores)
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '');
}

export default {
  discoverCategories,
  suggestCompetitors,
  translateCategory,
  translateCategories
};
