/**
 * Dimension Classification Service
 * AI-powered classification of pros/cons attributes into competitive dimensions
 */

import axios from 'axios';

/**
 * Approved competitive dimensions for Battle Cards
 */
const COMPETITIVE_DIMENSIONS = [
  'Quality',           // Reliability, durability, build quality, defects
  'Innovation',        // Technology, R&D, cutting-edge features
  'Pricing',           // Cost, value, affordability
  'Market Position',   // Market share, leadership, dominance
  'Brand Reputation',  // Trust, perception, image
  'Sustainability',    // Environmental, eco-friendly, ethics
  'Design',            // Aesthetics, style, appearance
  'Performance',       // Speed, efficiency, handling
  'Customer Experience' // Service, support, satisfaction
];

/**
 * Build dimension classification prompt for Gemini API
 * @param {Array} attributes - Array of {id, attribute, entity, type} objects
 * @param {string} category - Product category for context
 * @returns {string} Formatted prompt
 */
function buildDimensionClassificationPrompt(attributes, category) {
  return `You are classifying product/brand attributes into competitive dimensions for a "${category}" analysis.

Attributes to classify:
${JSON.stringify(attributes, null, 2)}

<INSTRUCTIONS>
Classify each attribute into EXACTLY ONE of these competitive dimensions.
Use the EXACT string value shown - no variations allowed.

COMPETITIVE DIMENSIONS (use these EXACT strings):
1. "Quality" - Reliability, durability, build quality, craftsmanship, defects, repairs, maintenance, longevity
2. "Innovation" - Technology, R&D, cutting-edge features, advanced tech, software, autonomous features
3. "Pricing" - Cost, value, affordability, expensive, cheap, price point, total ownership cost, insurance
4. "Market Position" - Market share, leadership, dominance, popularity, sales, presence, growth
5. "Brand Reputation" - Trust, brand image, perception, prestige, heritage, controversy, public image
6. "Sustainability" - Environmental impact, eco-friendly, green, emissions, recycling, ethics
7. "Design" - Aesthetics, style, appearance, look, interior, exterior, modern, sleek
8. "Performance" - Speed, acceleration, efficiency, handling, comfort, range, power, driving experience
9. "Customer Experience" - Service, support, warranty, dealership, buying experience, satisfaction

CLASSIFICATION RULES:
- Read the FULL attribute text to understand the main theme
- Choose the dimension that BEST captures the primary theme
- If an attribute mentions multiple themes, choose the DOMINANT one
- "reliability" and "unreliable" → Quality
- "market share" or "sales leader" → Market Position
- "repair costs" or "maintenance" → Quality (not Pricing)
- "insurance premiums" → Pricing
- "brand recognition" → Market Position (if about leadership) OR Brand Reputation (if about trust/image)

Output format (JSON only, no markdown):
{
  "classifications": [
    {"id": 0, "dimension": "Quality"},
    {"id": 1, "dimension": "Performance"},
    ...
  ]
}
</INSTRUCTIONS>`;
}

/**
 * Call Gemini API for dimension classification
 * @param {string} prompt - Classification prompt
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Classification results
 */
async function callGeminiForDimensionClassification(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8000,
      responseMimeType: 'application/json'
    }
  };

  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    return JSON.parse(text);
  } catch (error) {
    console.error('Dimension classification error:', error.message);
    return { classifications: [] };
  }
}

/**
 * Classify pros/cons attributes into competitive dimensions
 * @param {Object} prosConsData - {pros: [...], cons: [...]} structure
 * @param {string} category - Product category for context
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} prosConsData with dimension field added to each item
 */
export async function classifyDimensions(prosConsData, category, apiKey) {
  if (!prosConsData || (!prosConsData.pros?.length && !prosConsData.cons?.length)) {
    return prosConsData;
  }

  if (!apiKey) {
    console.warn('No API key for dimension classification - using fallback');
    return addFallbackDimensions(prosConsData);
  }

  // Build flat list of attributes with IDs
  const attributes = [];
  let idCounter = 0;

  prosConsData.pros.forEach((pro, idx) => {
    attributes.push({
      id: idCounter++,
      attribute: pro.attribute,
      entity: pro.entity,
      type: 'pro',
      originalIndex: idx
    });
  });

  prosConsData.cons.forEach((con, idx) => {
    attributes.push({
      id: idCounter++,
      attribute: con.attribute,
      entity: con.entity,
      type: 'con',
      originalIndex: idx
    });
  });

  // Classify in batches of 30
  const BATCH_SIZE = 30;
  const classificationMap = new Map();

  for (let i = 0; i < attributes.length; i += BATCH_SIZE) {
    const batch = attributes.slice(i, i + BATCH_SIZE);
    const prompt = buildDimensionClassificationPrompt(batch, category);
    const result = await callGeminiForDimensionClassification(prompt, apiKey);

    (result.classifications || []).forEach(c => {
      classificationMap.set(c.id, c.dimension);
    });
  }

  // Apply classifications to original data
  let proIdStart = 0;
  prosConsData.pros = prosConsData.pros.map((pro, idx) => ({
    ...pro,
    dimension: classificationMap.get(proIdStart + idx) || 'Other'
  }));

  let conIdStart = prosConsData.pros.length;
  prosConsData.cons = prosConsData.cons.map((con, idx) => ({
    ...con,
    dimension: classificationMap.get(conIdStart + idx) || 'Other'
  }));

  console.log(`Dimension classification: ${prosConsData.pros.length} pros, ${prosConsData.cons.length} cons classified`);

  return prosConsData;
}

/**
 * Fallback dimension classification using keyword matching
 * Used when API key is not available
 */
function addFallbackDimensions(prosConsData) {
  const DIMENSION_KEYWORDS = {
    'Quality': ['quality', 'reliable', 'unreliable', 'durability', 'durable', 'defect', 'repair', 'maintenance', 'breakdown', 'faulty', 'craftsmanship'],
    'Innovation': ['innovation', 'innovative', 'technology', 'tech', 'advanced', 'cutting-edge', 'autopilot', 'autonomous', 'software', 'r&d'],
    'Pricing': ['price', 'cost', 'expensive', 'affordable', 'cheap', 'value', 'budget', 'overpriced', 'insurance premium'],
    'Market Position': ['market share', 'market leader', 'dominant', 'leading', 'popular', 'best-selling', 'sales', 'growth'],
    'Brand Reputation': ['brand', 'reputation', 'trust', 'prestige', 'heritage', 'controversy', 'image', 'perception'],
    'Sustainability': ['sustainable', 'eco', 'green', 'environment', 'emission', 'carbon', 'ethical', 'renewable'],
    'Design': ['design', 'aesthetic', 'style', 'look', 'appearance', 'sleek', 'modern', 'interior', 'exterior'],
    'Performance': ['performance', 'speed', 'acceleration', 'range', 'efficiency', 'handling', 'comfort', 'power'],
    'Customer Experience': ['service', 'support', 'customer', 'warranty', 'dealership', 'satisfaction']
  };

  const classifyAttribute = (attr) => {
    const lower = attr.toLowerCase();
    for (const [dimension, keywords] of Object.entries(DIMENSION_KEYWORDS)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) return dimension;
      }
    }
    return 'Other';
  };

  prosConsData.pros = prosConsData.pros.map(pro => ({
    ...pro,
    dimension: classifyAttribute(pro.attribute)
  }));

  prosConsData.cons = prosConsData.cons.map(con => ({
    ...con,
    dimension: classifyAttribute(con.attribute)
  }));

  return prosConsData;
}

export { COMPETITIVE_DIMENSIONS };
