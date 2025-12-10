# GEO Multi-LLM Brand Analysis - Data Flow Documentation

This document describes the complete data pipeline from user input to final insights.

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INPUT                                         │
│  Entity, Competitors, Countries, Languages, Categories                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: QUESTION GENERATION                                                 │
│  Generate structured prompts for each analysis type                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: DUAL LLM EXECUTION                                                  │
│  Gemini 2.5 Flash + OpenAI GPT-4o in parallel                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: RESPONSE PARSING                                                    │
│  Multi-stage JSON extraction with error recovery                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: SOURCE EXTRACTION & MERGING                                         │
│  Combine grounded sources + cited sources, resolve redirects                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: SOURCE CLASSIFICATION (AI-Powered)                                  │
│  10-category taxonomy with confidence scoring                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: CONCEPT & TOPIC EXTRACTION                                          │
│  AI extraction of sentiment topics, strengths, weaknesses                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7: DATA AGGREGATION                                                    │
│  Aggregate by analysis type (Reputation, Visibility, Competitive, etc.)     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 8: PR INSIGHTS GENERATION                                              │
│  Impact-Effort scoring and priority categorization                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 9: AI COLLABORATION RECOMMENDATIONS                                    │
│  Generate pitch strategies for high-priority opportunities                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FINAL OUTPUT                                        │
│  Dashboard with analysis results, PR insights, sources, recommendations      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Question Generation

**Files:** `backend/src/utils/questionTemplates.js`, `backend/src/services/promptBuilder.js`

### Analysis Types & Questions

| Analysis Type | Questions/Market | Purpose |
|--------------|------------------|---------|
| **Reputation** | 3 | Sentiment, topics, strengths/weaknesses |
| **Visibility** | 2-5 per category | Brand ranking, search presence |
| **Competitive** | 2-5 per category | Win/loss, competitive positioning |
| **Category Detection** | 3 | Category associations, top competitors |

### Prompt Structure
All prompts enforce:
- JSON-only output (no markdown wrappers)
- Exact JSON schema specification
- 3-5 real, verifiable sources required
- Country/language filters for market specificity

---

## Step 2: Dual LLM Execution

**File:** `backend/src/services/llmService.js`

### Architecture
```
                    ┌─────────────────┐
                    │   Questions     │
                    │    Batch        │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │  Gemini 2.5     │           │  OpenAI GPT-4o  │
    │  Flash          │           │                 │
    │                 │           │                 │
    │  • Web search   │           │  • JSON mode    │
    │    grounding    │           │  • Web search   │
    │  • 56K tokens   │           │  • 16K tokens   │
    └────────┬────────┘           └────────┬────────┘
             │                             │
             └──────────────┬──────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Merged Results │
                   │  per Question   │
                   └─────────────────┘
```

### Execution Details
- **Parallel execution:** Both LLMs called simultaneously
- **Batch size:** 15-500 questions (configurable)
- **Retry logic:** 3 attempts with exponential backoff
- **Timeout:** 5 minutes per question

---

## Step 3: Response Parsing

**File:** `backend/src/utils/jsonParser.js`

### Multi-Stage Recovery Pipeline
```
Stage 1: Direct JSON.parse(text)
    ↓ fails
Stage 2: Sanitize → JSON.parse()
    • Remove markdown code blocks
    • Strip control characters
    ↓ fails
Stage 3: Sanitize + Repair → JSON.parse()
    • Fix missing commas
    • Remove trailing commas
    ↓ fails
Stage 4: Brace-Counting Extraction
    • Find first { and matching }
    • Apply sanitization + repair
    ↓ fails
Return null (logged for debugging)
```

---

## Step 4: Source Extraction & Merging

**Files:** `backend/src/services/analysisOrchestrator.js`

### Source Origins

| Source Type | Origin | Relevance Score |
|------------|--------|-----------------|
| **Grounded Sources** | Gemini grounding API | 0.95 |
| **News Citations** | LLM JSON `sources_cited_news` | 0.90 |
| **Other Citations** | LLM JSON `sources_cited_other` | 0.85 |

### Merging Process
- Deduplicate by URL
- Resolve Vertex AI redirects
- Extract domains
- Merge with LLM attribution

---

## Step 5: Source Classification

**File:** `backend/src/services/sourceClassifier.js`

### 10-Category Taxonomy

| Category | Description | Examples |
|----------|-------------|----------|
| **Journalism** | Professional news organizations | NYT, BBC, Reuters |
| **Corporate Blogs & Content** | Third-party corporate content | Industry blogs |
| **Government/NGO** | Official government & non-profits | .gov, UN, WHO |
| **Aggregators/Encyclopedic** | Knowledge aggregation sites | Wikipedia |
| **Academic/Research** | Universities, journals | .edu, Nature |
| **Owned Media** | Brand's own properties | Brand website |
| **Competitor Media** | Competitor properties | Competitor sites |
| **Paid/Advertorial** | Sponsored content | Native ads |
| **Social/UGC** | User-generated content | Reddit, forums |
| **Press Release** | PR distribution | PRNewswire |

---

## Step 6: Concept & Topic Extraction

**File:** `backend/src/services/aggregators/reputationAggregatorAI.js`

### Extraction Strategy

**Primary: AI Extraction (Gemini)**
- Extracts sentiment topics, strengths, weaknesses
- Groups by frequency and sentiment score
- Links sources to each topic

**Fallback: Keyword Extraction**
- Scans for sentiment keywords
- Extracts containing sentences as topics
- Normalizes frequency across responses

---

## Step 7: Data Aggregation

**Files:** `backend/src/services/aggregators/`

### Aggregation by Analysis Type

| Type | Input | Output |
|------|-------|--------|
| **Reputation** | Raw responses | sentiment_topics, strengths, weaknesses |
| **Visibility** | Rankings | entities_ranking, missed_opportunities |
| **Competitive** | Comparisons | win_rates, pros_cons by entity |
| **Categories** | Detection | categories with SOV, visibility |

---

## Step 8: PR Insights Generation

**File:** `backend/src/services/aggregators/prInsightsAggregator.js`

### Impact Score Formula
```
Impact = (frequency × 0.4) + (sentiment_gap × 0.3) + (source_quality × 0.2) + (competitive_relevance × 0.1)

Thresholds:
  High Impact: ≥ 0.70
  Medium Impact: 0.40-0.69
  Low Impact: < 0.40
```

### Impact-Effort Matrix

```
                    Low Effort              High Effort
                ┌─────────────────────┬─────────────────────┐
   High Impact  │     CRITICAL        │     STRATEGIC       │
                │     (Red)           │     (Orange)        │
                │     1-3 months      │     6-12 months     │
                ├─────────────────────┼─────────────────────┤
   Low Impact   │     QUICK WINS      │     LOW PRIORITY    │
                │     (Yellow)        │     (Gray)          │
                │     1-2 months      │     12+ months      │
                └─────────────────────┴─────────────────────┘
```

---

## Step 9: AI Collaboration Recommendations

**File:** `backend/src/services/aiCollaborationService.js`

Generates pitch strategies for top Critical/Strategic opportunities based on high-authority sources (Journalism, Academic, Government/NGO).

---

## Database Storage

**Files:** `backend/src/models/Report.js`, `backend/src/database/schema.js`

### Tables

| Table | Purpose |
|-------|---------|
| `reports` | Main metadata (entity, status, progress) |
| `report_configurations` | Analysis type configs and questions |
| `analysis_results` | Aggregated analysis data (JSON) |
| `llm_responses` | Raw LLM responses per question |
| `sources` | Classified sources with confidence |
| `pr_insights_opportunities` | Individual opportunity records |

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analysis/start` | POST | Start single-market analysis |
| `/api/analysis/start-multi-market` | POST | Start multi-market analysis |
| `/api/analysis/{reportId}` | GET | Get full analysis results |
| `/api/reports/health` | GET | Monitor ongoing report health |
| `/api/insights/{reportId}` | GET | Get PR insights |
| `/api/reports/{reportId}` | GET | Get report metadata |

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| Single-market analysis | 2-3 minutes |
| Multi-market analysis | 5-10 minutes |
| Parallel LLM execution | 50-70% overlap |
| Redirect resolution | 2-3 seconds for 100+ URLs |

---

## Configuration Constants

```javascript
TEMPERATURE: 0.1              // Low randomness for consistency
MAX_OUTPUT_TOKENS_GEMINI: 56000
MAX_OUTPUT_TOKENS_OPENAI: 16000
BATCH_SIZE: 15-500            // Configurable
MAX_RETRIES: 3                // Per question
TIMEOUT: 300000ms             // 5 minutes
```
