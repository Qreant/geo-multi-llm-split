# Google AI Mode Integration - Implementation Plan

**Target Version:** V2.19
**Status:** Ready for implementation
**API:** SerpAPI Google AI Mode (`engine=google_ai_mode`)

---

## Executive Summary

Add Google AI Mode as a third LLM source alongside Gemini and OpenAI. This provides Google's AI-generated search perspective with structured entity data and grounded citations.

### Test Results
- **Response Time:** 6-7 seconds per query
- **Success Rate:** 100% (always returns AI content)
- **Data Quality:** Rich text blocks + tables + 10 references

---

## Implementation Steps

### Step 1: Add API Key Management

**File:** `GEO_Multi-LLM_Analysis_V2.17_DUAL_LLM.gs`

```javascript
// Add to CONFIG section (~line 200)
SERPAPI_KEY_CELL: 'B17',  // New cell for SerpAPI key

// Update setApiKey() function to include SerpAPI
function setApiKey() {
  const ui = SpreadsheetApp.getUi();

  // Existing Gemini prompt...
  // Existing OpenAI prompt...

  // Add SerpAPI prompt
  const serpResult = ui.prompt(
    'SerpAPI Key',
    'Enter your SerpAPI API key (for Google AI Mode):',
    ui.ButtonSet.OK_CANCEL
  );

  if (serpResult.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties().setProperty('SERPAPI_KEY', serpResult.getResponseText().trim());
  }
}

// Update getApiKeys_() function
function getApiKeys_(ss) {
  const configSheet = ss.getSheetByName('Config') || ss.getSheets()[0];

  return {
    gemini: configSheet.getRange('B15').getValue() ||
            PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'),
    openai: configSheet.getRange('B16').getValue() ||
            PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY'),
    serpapi: configSheet.getRange('B17').getValue() ||
             PropertiesService.getScriptProperties().getProperty('SERPAPI_KEY')
  };
}
```

### Step 2: Create SerpAPI Call Function

```javascript
/**
 * Calls SerpAPI Google AI Mode API
 * V2.19: Third LLM source for GEO analysis
 * @param {string} question - The search query
 * @param {Object} config - Configuration with country/language
 * @param {string} apiKey - SerpAPI API key
 * @returns {Object} {text: string, citations: array, metadata: object}
 */
function callSerpAPI_(question, config, apiKey) {
  const startTime = new Date().getTime();

  const params = [
    'engine=google_ai_mode',
    'q=' + encodeURIComponent(question),
    'api_key=' + apiKey,
    'hl=' + (config.language || 'en'),
    'gl=' + (config.country || 'us')
  ].join('&');

  const url = 'https://serpapi.com/search.json?' + params;

  const options = {
    method: 'get',
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      console.log('SerpAPI error: ' + responseCode + ' - ' + response.getContentText().substring(0, 200));
      return null;
    }

    const data = JSON.parse(response.getContentText());
    const endTime = new Date().getTime();

    return extractSerpAPIResponse_(data, endTime - startTime);

  } catch (e) {
    console.log('SerpAPI call failed: ' + e.toString());
    return null;
  }
}

/**
 * Extracts and normalizes SerpAPI response to match Gemini/OpenAI format
 * @param {Object} data - Raw SerpAPI response
 * @param {number} responseTime - Response time in ms
 * @returns {Object} Normalized response
 */
function extractSerpAPIResponse_(data, responseTime) {
  // Extract text from text_blocks
  let fullText = '';
  const entities = [];

  if (data.text_blocks) {
    data.text_blocks.forEach(block => {
      if (block.snippet) {
        fullText += block.snippet + '\n';
      }

      // Extract from lists
      if (block.list) {
        block.list.forEach(item => {
          if (item.snippet) {
            fullText += '- ' + (item.title || '') + ' ' + item.snippet + '\n';
          }
        });
      }

      // Extract entities from tables (valuable for competitive analysis)
      if (block.table && block.formatted) {
        block.formatted.forEach(row => {
          if (row.tool) {
            entities.push({
              name: row.tool,
              strengths: row.key_strengths_for_enterprise || '',
              best_for: row.best_for || ''
            });
          }
        });
      }
    });
  }

  // Map references to citations format
  const citations = (data.references || []).map(ref => ({
    url: ref.link || '',
    title: ref.title || '',
    domain: extractDomain_(ref.link || ''),
    source_type: categorizeSourceType_(ref.link || '', ref.source || ''),
    snippet: ref.snippet || ''
  }));

  return {
    text: fullText.trim(),
    citations: citations,
    metadata: {
      llm_provider: 'google_ai_mode',
      response_time_ms: responseTime,
      text_block_count: data.text_blocks?.length || 0,
      reference_count: citations.length,
      extracted_entities: entities
    }
  };
}
```

### Step 3: Update Parallel Execution

Modify `processBatchParallel_()` or equivalent to include SerpAPI calls:

```javascript
/**
 * Process questions with all three LLMs in parallel
 * V2.19: Adds Google AI Mode as third source
 */
function processQuestionsTripleLLM_(questions, config, apiKeys) {
  const results = [];

  questions.forEach(question => {
    // Prepare parallel requests
    const requests = [];

    // Gemini request
    requests.push({
      type: 'gemini',
      request: buildGeminiRequest_(question, config, apiKeys.gemini)
    });

    // OpenAI request
    requests.push({
      type: 'openai',
      request: buildOpenAIRequest_(question, config, apiKeys.openai)
    });

    // SerpAPI request (if key provided)
    if (apiKeys.serpapi) {
      requests.push({
        type: 'serpapi',
        request: buildSerpAPIRequest_(question, config, apiKeys.serpapi)
      });
    }

    // Execute in parallel using UrlFetchApp.fetchAll()
    // ... implementation details
  });

  return results;
}
```

### Step 4: Update Source Merging

Extend `mergeDualLLMSources_()` to handle triple LLM:

```javascript
/**
 * Merges sources from Gemini, OpenAI, and SerpAPI
 * V2.19: Extended for triple LLM support
 * @param {Object} geminiResponse
 * @param {Object} openaiResponse
 * @param {Object} serpapiResponse - Can be null if not available
 * @returns {Object} Merged sources with cited_by attribution
 */
function mergeTripleLLMSources_(geminiResponse, openaiResponse, serpapiResponse) {
  const sourceMap = new Map();

  // Process Gemini sources
  processSourcesForMerge_(geminiResponse?.citations, 'gemini', sourceMap);

  // Process OpenAI sources
  processSourcesForMerge_(openaiResponse?.citations, 'openai', sourceMap);

  // Process SerpAPI sources (if available)
  if (serpapiResponse?.citations) {
    processSourcesForMerge_(serpapiResponse.citations, 'google_ai_mode', sourceMap);
  }

  // Convert map to array
  const mergedSources = Array.from(sourceMap.values());

  return {
    sources: mergedSources,
    llm_responses: {
      gemini: geminiResponse,
      openai: openaiResponse,
      google_ai_mode: serpapiResponse || null
    }
  };
}

function processSourcesForMerge_(citations, llmSource, sourceMap) {
  if (!citations) return;

  citations.forEach(citation => {
    const key = citation.url || citation.domain;

    if (sourceMap.has(key)) {
      // Add to existing source's cited_by
      const existing = sourceMap.get(key);
      if (!existing.cited_by.includes(llmSource)) {
        existing.cited_by.push(llmSource);
      }
    } else {
      // Add new source
      sourceMap.set(key, {
        ...citation,
        cited_by: [llmSource]
      });
    }
  });
}
```

### Step 5: Update Results Sheet Structure

Add column for Google AI Mode data:

```javascript
// Update RESULTS_HEADERS constant
const RESULTS_HEADERS = [
  'Timestamp',
  'Analysis_Type',
  'Question_ID',
  'Question',
  'Entity/Brand',
  'Rank',
  'Data',
  'Sources_Combined_JSON',
  'LLM_Responses_JSON'  // Now contains gemini, openai, AND google_ai_mode
];
```

### Step 6: Update Aggregation Functions

Modify aggregation to include Google AI Mode data:

```javascript
/**
 * Aggregates reputation analysis from all three LLMs
 * V2.19: Includes Google AI Mode
 */
function aggregateReputationAnalysis_(rawResponses, config) {
  // Existing aggregation logic...

  // Add Google AI Mode extracted entities to analysis
  const googleEntities = [];
  rawResponses.forEach(response => {
    if (response.llm_responses?.google_ai_mode?.metadata?.extracted_entities) {
      googleEntities.push(...response.llm_responses.google_ai_mode.metadata.extracted_entities);
    }
  });

  // Include in result
  result.google_ai_mode_entities = googleEntities;

  return result;
}
```

---

## Configuration Updates

### Config Sheet (Row 17)
| Cell | Label | Value |
|------|-------|-------|
| A17 | SerpAPI Key | (label) |
| B17 | | (user enters key) |

### Optional: Enable/Disable Flag
| Cell | Label | Value |
|------|-------|-------|
| A18 | Enable Google AI Mode | (label) |
| B18 | TRUE/FALSE | (checkbox) |

---

## Data Structure Changes

### LLM_Responses_JSON (Updated)
```json
{
  "llm_responses": {
    "gemini": {
      "text": "...",
      "citations": [...]
    },
    "openai": {
      "text": "...",
      "citations": [...]
    },
    "google_ai_mode": {
      "text": "...",
      "citations": [...],
      "metadata": {
        "extracted_entities": [
          {"name": "Cision", "strengths": "...", "best_for": "..."},
          {"name": "Meltwater", "strengths": "...", "best_for": "..."}
        ]
      }
    }
  }
}
```

### Sources_Combined_JSON (Updated)
```json
{
  "sources": [
    {
      "url": "https://...",
      "title": "...",
      "domain": "...",
      "source_type": "Corporate Blogs & Content",
      "cited_by": ["gemini", "openai", "google_ai_mode"]
    }
  ]
}
```

---

## Performance Considerations

### Expected Impact
| Metric | V2.18 (Dual LLM) | V2.19 (Triple LLM) |
|--------|------------------|---------------------|
| Questions | 25 | 25 |
| API calls per question | 2 | 3 |
| Total API calls | 50 | 75 |
| Execution time | 65-70s | 80-90s (estimated) |

### Optimization Options
1. **Parallel execution** - SerpAPI can run in parallel with Gemini/OpenAI
2. **Optional enable** - Config flag to disable if not needed
3. **Selective use** - Only use for competitive/visibility analysis types

---

## Testing Checklist

- [ ] SerpAPI key validation on startup
- [ ] Graceful handling when SerpAPI key not provided
- [ ] Response parsing for all text_block types (paragraph, table, list, heading)
- [ ] Source deduplication with triple cited_by
- [ ] Entity extraction from table.formatted
- [ ] Results sheet displays all three LLM responses
- [ ] Aggregation includes Google AI Mode data
- [ ] Summary sheet reflects triple LLM consensus
- [ ] Error handling for SerpAPI failures (don't break analysis)

---

## Rollback Plan

If issues arise, revert by:
1. Setting `Enable Google AI Mode` to FALSE in Config
2. Or remove SerpAPI key from B17
3. System falls back to dual LLM (Gemini + OpenAI)

---

## Files Modified

1. `GEO_Multi-LLM_Analysis_V2.17_DUAL_LLM.gs` → `GEO_Multi-LLM_Analysis_V2.19_TRIPLE_LLM.gs`
   - New functions: `callSerpAPI_()`, `extractSerpAPIResponse_()`
   - Modified: `getApiKeys_()`, `mergeTripleLLMSources_()`, aggregation functions
   - Updated: Results headers, CONFIG constants

---

## API Reference

**Endpoint:** `https://serpapi.com/search.json`

**Required Parameters:**
- `engine`: `google_ai_mode`
- `q`: Search query
- `api_key`: SerpAPI key

**Optional Parameters:**
- `hl`: Language (default: `en`)
- `gl`: Country (default: `us`)
- `device`: `desktop` | `mobile` | `tablet`

**Response Structure:**
- `text_blocks[]`: AI-generated content blocks
- `references[]`: Cited sources with URLs
- `search_metadata`: Status, timing info

**Pricing:** Check SerpAPI plan for credit usage per query
