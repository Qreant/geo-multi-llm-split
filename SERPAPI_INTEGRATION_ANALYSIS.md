# SerpAPI Google AI Overview - Integration Analysis

## Test Results Summary

### Performance Metrics
| API Call | Response Time | Notes |
|----------|---------------|-------|
| Google Search API | 112-124ms | Very fast (cached results) |
| AI Overview API | 22-3233ms | Variable, depends on availability |
| **Total (2-step)** | ~3400ms | When AI Overview available |

**Comparison to existing LLMs:**
- Gemini API: 2000-4000ms per query
- OpenAI GPT-4o: 2000-4000ms per query
- **SerpAPI is competitive** at ~3400ms total

### Data Availability

**Important Finding:** Google AI Overview is NOT always available. For our test query "What are the best PR analytics software tools for enterprise companies?", the AI Overview API returned "Fully empty".

However, the initial **Google Search response** already contains rich data:

1. **Answer Box** - Direct brand rankings (9 brands extracted)
2. **Related Questions** - Some include full AI Overview with text_blocks + references
3. **Organic Results** - Top 9 search results with metadata
4. **Discussions & Forums** - Reddit/Quora answers with votes

---

## Data Structure Mapping

### SerpAPI Response vs. Existing GEO Format

#### 1. Source/Citation Mapping

**SerpAPI Format (references):**
```json
{
  "title": "Top 15 Data Analytics Tools...",
  "link": "https://ischool.syracuse.edu/...",
  "snippet": "Jun 1, 2025 — Key Takeaways...",
  "source": "iSchool | Syracuse University",
  "index": 0
}
```

**GEO Format (citations):**
```json
{
  "url": "https://ischool.syracuse.edu/...",
  "title": "Top 15 Data Analytics Tools...",
  "domain": "ischool.syracuse.edu",
  "source_type": "Academic/Research",
  "snippet": "Jun 1, 2025 — Key Takeaways..."
}
```

**Mapping:** Direct 1:1 mapping with domain extraction + source_type classification.

#### 2. Text Content Mapping

**SerpAPI Format (text_blocks):**
```json
{
  "type": "paragraph|list|heading|expandable",
  "snippet": "Main text content...",
  "reference_indexes": [0, 1, 2],
  "list": [
    {"title": "Item 1:", "snippet": "Description..."},
    {"title": "Item 2:", "snippet": "Description..."}
  ]
}
```

**GEO Format (text):**
- Single concatenated string with all content
- Used for JSON-based analysis prompts

**Mapping:** Concatenate all snippets from text_blocks into single text.

#### 3. Entity Extraction

**SerpAPI provides:**
- `answer_box.expanded_list[]` - Direct brand rankings
- `text_blocks[].list[].title` - Entity mentions within AI Overview
- `organic_results[].snippet_highlighted_words` - Highlighted entities

**GEO uses:**
- Entity rankings from LLM response parsing
- Brand mentions in analysis JSON

---

## Recommended Integration Approach

### Option A: Full Replacement (AI Overview as 3rd LLM)
Add SerpAPI as third LLM alongside Gemini + OpenAI.

**Pros:**
- Different perspective (actual Google Search results)
- Fast response times
- Rich source citations

**Cons:**
- AI Overview not always available
- Limited to what Google chooses to show
- No custom prompt control

### Option B: Supplementary Data Source
Use SerpAPI data to enrich existing Gemini/OpenAI analysis.

**Recommended Implementation:**
```javascript
function callSerpAPI_(query, config) {
  const searchResult = callGoogleSearch_(query, config);

  return {
    // Primary data from answer_box
    brand_rankings: extractBrandRankings_(searchResult.answer_box),

    // AI Overview if available
    ai_overview: searchResult.ai_overview?.text_blocks ?
      extractAIOverview_(searchResult) : null,

    // Organic results for source analysis
    organic_results: searchResult.organic_results,

    // Related questions (often contain AI Overviews)
    related_questions: searchResult.related_questions,

    // Discussion forums (Reddit/Quora)
    discussions: searchResult.discussions_and_forums
  };
}
```

### Option C: Hybrid Approach (Recommended)
1. **Always call Google Search API** - Get answer_box + organic results
2. **Try AI Overview API** - Use if available, skip if empty
3. **Merge with Gemini/OpenAI** - Add as third source in citations

---

## Implementation Code for GEO Integration

```javascript
/**
 * SerpAPI Google Search + AI Overview Integration
 * Adds Google AI Overview as third LLM source in GEO Analysis
 */

const SERPAPI_KEY = PropertiesService.getScriptProperties().getProperty('SERPAPI_KEY');

function callSerpAPI_(question, config) {
  const startTime = new Date().getTime();

  // Step 1: Google Search API
  const searchUrl = 'https://serpapi.com/search.json?' +
    'engine=google' +
    '&q=' + encodeURIComponent(question) +
    '&api_key=' + SERPAPI_KEY +
    '&hl=' + (config.language || 'en') +
    '&gl=' + (config.country || 'us');

  const searchResponse = UrlFetchApp.fetch(searchUrl);
  const searchData = JSON.parse(searchResponse.getContentText());

  // Extract citations from multiple sources
  const citations = [];

  // From organic results
  if (searchData.organic_results) {
    searchData.organic_results.forEach(result => {
      citations.push({
        url: result.link,
        title: result.title,
        domain: extractDomain_(result.link),
        source_type: categorizeSourceType_(result.link, result.source || ''),
        snippet: result.snippet || ''
      });
    });
  }

  // From answer box (brand rankings)
  const brandRankings = [];
  if (searchData.answer_box?.expanded_list) {
    searchData.answer_box.expanded_list.forEach((item, idx) => {
      brandRankings.push({
        rank: idx + 1,
        entity: item.title,
        source: 'google_answer_box'
      });
    });
  }

  // Build response text from available data
  let responseText = '';

  // Add answer box brands
  if (brandRankings.length > 0) {
    responseText += 'Top brands mentioned: ' +
      brandRankings.map(b => b.entity).join(', ') + '\n\n';
  }

  // Add organic result snippets
  if (searchData.organic_results) {
    searchData.organic_results.slice(0, 5).forEach(r => {
      responseText += `${r.title}: ${r.snippet}\n`;
    });
  }

  const endTime = new Date().getTime();

  return {
    text: responseText,
    citations: citations,
    metadata: {
      llm_provider: 'google_search',
      response_time_ms: endTime - startTime,
      brand_rankings: brandRankings,
      has_ai_overview: !!searchData.ai_overview?.text_blocks
    }
  };
}

/**
 * Merge SerpAPI results with Gemini/OpenAI responses
 */
function mergeDualLLMWithSerpAPI_(geminiResponse, openaiResponse, serpResponse) {
  // Existing merge logic for gemini + openai
  const baseResult = mergeDualLLMSources_(geminiResponse, openaiResponse);

  // Add SerpAPI citations with 'google_search' attribution
  if (serpResponse?.citations) {
    serpResponse.citations.forEach(serpCitation => {
      const existing = baseResult.sources.find(s =>
        s.url === serpCitation.url || s.domain === serpCitation.domain
      );

      if (existing) {
        // Add google_search to cited_by array
        if (!existing.cited_by.includes('google_search')) {
          existing.cited_by.push('google_search');
        }
      } else {
        // Add new source
        baseResult.sources.push({
          ...serpCitation,
          cited_by: ['google_search']
        });
      }
    });
  }

  // Add brand rankings to metadata
  if (serpResponse?.metadata?.brand_rankings) {
    baseResult.google_brand_rankings = serpResponse.metadata.brand_rankings;
  }

  return baseResult;
}
```

---

## Data Fields Available

| Field | Location | Use Case |
|-------|----------|----------|
| Brand rankings | `answer_box.expanded_list` | Visibility analysis |
| Organic URLs | `organic_results[].link` | Source classification |
| Result snippets | `organic_results[].snippet` | Entity mentions |
| Related Q&A | `related_questions` | Topic expansion |
| Reddit/Quora | `discussions_and_forums` | UGC sentiment |
| AI Overview text | `ai_overview.text_blocks` | Full analysis (when available) |
| AI Overview refs | `ai_overview.references` | Grounded citations |

---

## Limitations

1. **AI Overview not guaranteed** - Only available for certain query types
2. **Token expiration** - page_token expires in ~1 minute
3. **API cost** - Each SerpAPI call uses credits
4. **Rate limits** - Check SerpAPI plan limits
5. **No prompt customization** - Unlike Gemini/OpenAI, can't control response format

---

## Recommendation

**Implement Option C (Hybrid)** for V2.19:

1. Add SerpAPI as optional third source (config flag to enable)
2. Always extract `answer_box` brand rankings for visibility analysis
3. Merge organic result sources with Gemini/OpenAI citations
4. Use AI Overview when available, gracefully skip when empty
5. Add `google_search` to `cited_by` arrays for source deduplication

This provides Google's real-time search perspective without breaking existing LLM analysis workflow.
