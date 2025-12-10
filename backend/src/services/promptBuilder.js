/**
 * Prompt Builder Service
 * Generates prompts for different analysis types
 * Ported from Google Apps Script V2.17
 */

/**
 * Build filter instructions based on country and language
 * Supports both single values (country, language) and arrays (countries, languages)
 * Also supports market object from multi-market config
 */
function buildFilterInstructions(config) {
  const filters = [];

  // Get country - support market object, single value, or array
  const country = config.market?.country || config.country || (config.countries && config.countries[0]);
  // Get language - support market object, single value, or array
  const language = config.market?.language || config.language || (config.languages && config.languages[0]);

  if (country) {
    filters.push(`Focus on ${country}`);
  }

  if (language) {
    filters.push(`in ${language} language`);
    // Add explicit search instruction for non-English to improve grounded search
    if (language.toLowerCase() !== 'english') {
      filters.push(`Search for and cite ${language}-language sources when available`);
    }
  }

  return filters.length > 0 ? ` ${filters.join('. ')}.` : '';
}

/**
 * Build reputation analysis prompt
 */
export function buildReputationPrompt(question, entity, config) {
  const filterInstructions = buildFilterInstructions(config);

  return `Question: ${question}

Provide a detailed response about ${entity}.${filterInstructions}

CRITICAL OUTPUT RULES:
- Return ONLY raw JSON, starting with { and ending with }
- Do NOT wrap your response in markdown code blocks
- Do NOT use backticks or code formatting in your response
- Do NOT escape quotes (use " not "")
- Do NOT add any explanatory text before or after the JSON
- Include 3-5 REAL, VERIFIABLE sources with actual URLs

Output ONLY valid JSON in this exact format:
{
  "raw_response": "Your detailed response here (2-3 sentences providing clear, factual information)",
  "sources_cited": [
    {
      "url": "https://www.example-real-source.com/article",
      "domain": "example-real-source.com",
      "title": "Article Title",
      "relevance_score": 0.95,
      "youtube_channel": null
    }
  ]
}

YOUTUBE SOURCE RULES (REQUIRED):
- For ALL YouTube sources, you MUST set "youtube_channel" to the channel name (e.g., "Marques Brownlee", "TechLinked", "Autopedia")
- This is REQUIRED even for video URLs like youtube.com/watch?v=xyz - identify and include the channel name
- Extract channel name from URL (@username, /c/name) or from your knowledge of the video's creator
- For non-YouTube sources, set "youtube_channel" to null

Use REAL, EXISTING sources. Include at least 3 sources.`;
}

/**
 * Build visibility analysis prompt
 */
export function buildVisibilityPrompt(question, category, entity, config) {
  const filterInstructions = buildFilterInstructions(config);

  return `Question: ${question}

<INSTRUCTIONS>
You are a JSON-only assistant used inside an automated system. Your output is parsed by a JSON parser.

CRITICAL OUTPUT RULES:
- Return ONLY raw JSON, starting with { and ending with }
- Do NOT wrap your response in markdown code blocks
- Do NOT use backticks or code formatting in your response
- Do NOT escape quotes (use " not "")
- Do NOT add any explanatory text before or after the JSON
</INSTRUCTIONS>

<TASK>
Given: a category: "${category}"${filterInstructions}

Return a ranking of entities for this category, and explain each ranking briefly. Then provide a single, global list of sources that support your overall analysis.
</TASK>

<JSON FORMAT>
Output ONLY valid JSON in this exact format:
{
  "entities_ranking": [
    { "rank": 1, "name": "Brand Name", "comment": "Why this brand is notable for ${category}" },
    { "rank": 2, "name": "Another Brand", "comment": "Why this brand is notable for ${category}" }
  ],
  "sources_cited_news": [
    {
      "url": "https://www.bbc.com/news/example-article",
      "title": "Example News Article Relevant to the Ranking",
      "publisher": "BBC News",
      "published_date": "2025-01-15",
      "youtube_channel": null
    }
  ],
  "sources_cited_other": [
    {
      "url": "https://www.nerdwallet.com/best/finance/best-credit-monitoring-services",
      "title": "NerdWallet Best Credit Monitoring Services 2025",
      "youtube_channel": null
    }
  ]
}
</JSON FORMAT>

<FIELD RULES>
- "sources_cited_news" and "sources_cited_other":
  - Use "sources_cited_news" for clearly news-like sources (news sites, online newspapers, press outlets, magazine).
  - Use "sources_cited_other" for everything else (reviews, wikis, forums, etc.).
  - If no sources are available, use an empty array [].

Each source object MUST have:
- "url": the source URL.
- "title": a short descriptive title.
- Optional: "publisher" and "published_date" for news sources if available.
- "youtube_channel": REQUIRED for YouTube sources - provide the channel name (e.g., "Marques Brownlee", "Autopedia", "TechLinked"). For non-YouTube sources, set to null. IMPORTANT: Always identify and include the YouTube channel name, even for video URLs like youtube.com/watch?v=xyz.
</FIELD RULES>`;
}

/**
 * Build competitive analysis prompt
 */
export function buildCompetitivePrompt(question, entities, category, config) {
  const entityList = entities.join(', ');
  const categoryContext = category ? ` for ${category}` : '';
  const filterInstructions = buildFilterInstructions(config);

  const entityAnalysisTemplate = {};
  entities.forEach(e => {
    entityAnalysisTemplate[e] = {
      "pros": [
        {
          "point": "Positive aspect of this brand",
          "sources": [
            {
              "url": "https://example.com/source",
              "title": "Source title",
              "youtube_channel": null
            }
          ]
        }
      ],
      "cons": [
        {
          "point": "Negative aspect of this brand",
          "sources": [
            {
              "url": "https://example.com/source",
              "title": "Source title",
              "youtube_channel": null
            }
          ]
        }
      ]
    };
  });

  return `Question: ${question}

Compare these entities${categoryContext}: ${entityList}${filterInstructions}

<INSTRUCTIONS>
You are a JSON-only assistant used inside an automated system. Your output is parsed by a JSON parser.

CRITICAL OUTPUT RULES:
- Return ONLY raw JSON, starting with { and ending with }
- Do NOT wrap your response in markdown code blocks
- Do NOT use backticks or code formatting in your response
- Do NOT escape quotes (use " not "")
- Do NOT add any explanatory text before or after the JSON
</INSTRUCTIONS>

<TASK>
Given:
- a list of entities: ${entityList}
- a category: "${category}"

Choose exactly ONE entity from this list that best fits the category.
Return your choice, a structured analysis of this entity, and a single, global list of sources that support your choice and overall analysis.
</TASK>

<JSON FORMAT>
Output ONLY valid JSON in this exact format:
{
  "entity_choice": "Brand Name",
  "entity_analysis": ${JSON.stringify(entityAnalysisTemplate, null, 2)},
  "sources_cited_news": [
    {
      "url": "https://www.bbc.com/news/example-article",
      "title": "Example News Article Relevant to the Choice",
      "publisher": "BBC News",
      "published_date": "2025-01-15",
      "youtube_channel": null
    }
  ],
  "sources_cited_other": [
    {
      "url": "https://www.nerdwallet.com/best/finance/best-credit-monitoring-services",
      "title": "NerdWallet Best Credit Monitoring Services 2025",
      "youtube_channel": null
    }
  ],
  "raw_response": "Brief explanation (1-2 sentences, max 150 chars) of why this entity was chosen."
}
</JSON FORMAT>

<FIELD RULES>
- "entity_choice": MUST be exactly one of: ${entityList}
- "entity_analysis": Include exactly 2 pros and 2 cons per entity (not more)
- "sources_cited_news" and "sources_cited_other": MAX 10 sources total combined. Only include the most relevant sources.
- "raw_response": max 150 characters
- "youtube_channel": REQUIRED for YouTube sources - provide the channel name. For non-YouTube sources, set to null.
</FIELD RULES>`;
}

/**
 * Build category detection prompt
 * Asks LLM to identify what categories the entity is associated with
 */
export function buildCategoryDetectionPrompt(question, entity, config) {
  const filterInstructions = buildFilterInstructions(config);

  return `Question: ${question}

<INSTRUCTIONS>
You are a JSON-only assistant used inside an automated system. Your output is parsed by a JSON parser.

CRITICAL OUTPUT RULES:
- Return ONLY raw JSON, starting with { and ending with }
- Do NOT wrap your response in markdown code blocks
- Do NOT use backticks or code formatting in your response
- Do NOT escape quotes (use " not "")
- Do NOT add any explanatory text before or after the JSON
</INSTRUCTIONS>

Analyze what core product/service categories ${entity} is associated with.${filterInstructions}

CRITICAL RULES FOR CATEGORY NAMING:

1. **Remove marketing qualifiers**: Strip out brand-specific adjectives
   ❌ "Maximalist Running Shoes" → ✅ "Running Shoes"
   ❌ "Premium Credit Monitoring" → ✅ "Credit Monitoring"
   ❌ "Performance Athletic Apparel" → ✅ "Athletic Apparel"
   ❌ "AI-Powered CRM Software" → ✅ "CRM Software"

2. **Use 1-3 words**: Keep it concise
   ✅ "Running Shoes"
   ✅ "Athletic Apparel"
   ✅ "Sports Equipment"

3. **Be specific about WHAT, not HOW**:
   - Identify the product type: "Running Shoes" (not just "Shoes")
   - Don't include positioning: Remove "Premium", "Luxury", "Budget", "Pro"
   - Don't include features: Remove "Cushioned", "Lightweight", "Waterproof"

4. **Avoid these marketing terms**:
   - Qualifiers: Premium, Luxury, Budget, Pro, Ultra, Mega, Super
   - Features: Cushioned, Lightweight, Advanced, Enhanced, Optimized
   - Positioning: Performance, Maximalist, Minimalist, Professional

For ${entity}, identify core categories following these rules:
- What products/services do they sell? (core types only)
- Remove all marketing qualifiers
- Keep it to 1-3 words
- Focus on searchable, recognizable category names
- **RANK categories by importance/strength of association** (1 = most important/strongest)

For each category, also identify the top 3-5 competitor brands in that specific category.

Output ONLY valid JSON in this exact format:
{
  "categories": [
    {
      "rank": 1,
      "name": "Running Shoes",
      "comment": "Known for cushioned running shoes with distinctive oversized midsoles",
      "top_competitors": [
        {"rank": 1, "name": "Nike", "comment": "Market leader in running shoes"},
        {"rank": 2, "name": "Brooks", "comment": "Specialized running shoe brand"},
        {"rank": 3, "name": "Asics", "comment": "Popular for technical running shoes"}
      ]
    },
    {
      "rank": 2,
      "name": "Athletic Apparel",
      "comment": "Offers athletic wear for various sports",
      "top_competitors": [
        {"rank": 1, "name": "Adidas", "comment": "Leading sportswear brand"},
        {"rank": 2, "name": "Under Armour", "comment": "Performance athletic apparel"},
        {"rank": 3, "name": "Lululemon", "comment": "Premium athletic wear"}
      ]
    }
  ]
}

FINAL CHECK:
- **Rank** (category): 1-7, ordered by strength of association with ${entity} (1 = strongest)
- **Category names**: 1-3 words, NO marketing qualifiers
- **Comments** (category): 10-20 words, can mention specifics about the brand
- **Top competitors**: 3-5 brands per category, ranked by market position in that specific category. **NEVER include ${entity} in top_competitors - we are analyzing ${entity}, so competitors must be OTHER brands**
- **Competitor comments**: Brief (5-10 words) noting their position/strength in category
- Return 3-7 categories total
- Categories should be searchable/recognizable
- No additional text outside JSON`;
}
