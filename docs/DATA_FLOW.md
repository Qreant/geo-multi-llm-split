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

| Analysis Type | Questions | Purpose |
|--------------|-----------|---------|
| **Reputation** | 10 | Sentiment, topics, strengths/weaknesses |
| **Visibility** | 10 per category | Brand ranking, search presence |
| **Competitive** | 10 per category | Win/loss, competitive positioning |
| **Category Detection** | 3 | Category associations, top competitors |
| **Corporate Reputation** | 12 (3 dimensions) | Employer reputation, DEI, leadership |

### Default Questions by Category

#### Reputation Analysis (10 Questions)
| ID | Question Template |
|----|-------------------|
| REP_Q1 | Is {{entity}} good? |
| REP_Q2 | Is {{entity}} worth it? |
| REP_Q3 | Should I buy {{entity}}? |
| REP_Q4 | Is {{entity}} reliable? |
| REP_Q5 | Is {{entity}} a good value? |
| REP_Q6 | Is {{entity}} popular right now? |
| REP_Q7 | Does {{entity}} have good reviews? |
| REP_Q8 | Reviews about {{entity}}? |
| REP_Q9 | {{entity}} pros and cons? |
| REP_Q10 | What do people say about {{entity}}? |

#### Visibility Analysis (10 Questions)
| ID | Question Template |
|----|-------------------|
| VIS_Q1 | Best {{category}}? |
| VIS_Q2 | Top {{category}} brands? |
| VIS_Q3 | Top {{category}} models? |
| VIS_Q4 | Which {{category}} should I choose? |
| VIS_Q5 | What should I look for in {{category}}? |
| VIS_Q6 | Most affordable {{category}}? |
| VIS_Q7 | Most durable {{category}}? |
| VIS_Q8 | Best {{category}} for beginners? |
| VIS_Q9 | Best {{category}} for experts? |
| VIS_Q10 | Recommend {{category}}. |

#### Competitive Analysis (10 Questions)
| ID | Question Template |
|----|-------------------|
| COMP_Q1 | {{entity}} vs {{competitor1}} vs {{competitor2}}... — which is better{{category_suffix}}? |
| COMP_Q2 | Compare {{entity}}, {{competitor1}}, {{competitor2}}...{{category_suffix}}. |
| COMP_Q3 | {{entity}}, {{competitor1}}, {{competitor2}}...{{category_suffix}}? |
| COMP_Q4 | {{entity}} vs {{competitor1}} vs {{competitor2}}...{{category_suffix}} |
| COMP_Q5 | Which is better: {{entity}}, {{competitor1}}, {{competitor2}}...{{category_suffix}}? |
| COMP_Q6 | {{entity}} vs {{competitor1}} vs {{competitor2}}... — which should I buy{{category_suffix}}? |
| COMP_Q7 | What's the difference between {{entity}}, {{competitor1}}, {{competitor2}}...{{category_suffix}}? |
| COMP_Q8 | Which is better value: {{entity}}, {{competitor1}}, {{competitor2}}...{{category_suffix}}? |
| COMP_Q9 | Which is more reliable: {{entity}}, {{competitor1}}, {{competitor2}}...{{category_suffix}}? |
| COMP_Q10 | Should I get: {{entity}}, {{competitor1}}, or {{competitor2}}...{{category_suffix}}? |

#### Category Detection (3 Questions)
| ID | Question Template |
|----|-------------------|
| CAT_Q1 | What is {{entity}} known for? |
| CAT_Q2 | What is {{entity}} good for? |
| CAT_Q3 | What does {{entity}} do? |

#### Corporate Reputation (12 Questions, 3 Dimensions)

**Dimension 1: Employer Reputation**
| ID | Question Template |
|----|-------------------|
| CORP_Q1 | Is {{entity}} a good employer? |
| CORP_Q2 | Should I work for {{entity}}? |
| CORP_Q3 | What is {{entity}}'s workplace culture like? |
| CORP_Q4 | Does {{entity}} offer good employee benefits? |
| CORP_Q5 | What do employees say about working at {{entity}}? |

**Dimension 2: DEI & Social Responsibility**
| ID | Question Template |
|----|-------------------|
| CORP_Q6 | Is {{entity}} a brand that respects DEI? |
| CORP_Q7 | Does {{entity}} prioritize diversity and inclusion? |
| CORP_Q8 | Is {{entity}} sustainable and environmentally responsible? |
| CORP_Q9 | What are {{entity}}'s ethical practices? |

**Dimension 3: Leadership & Governance**
| ID | Question Template |
|----|-------------------|
| CORP_Q10 | Does {{entity}} have strong leadership? |
| CORP_Q11 | What is the reputation of {{entity}}'s CEO? |
| CORP_Q12 | How well does {{entity}} handle corporate crises? |

### Question Generation Functions

| Function | File | Purpose |
|----------|------|---------|
| `buildReputationQuestions(entity)` | questionTemplates.js | Generate REP_Q1-Q10 |
| `buildVisibilityQuestions(category)` | questionTemplates.js | Generate VIS_Q1-Q10 |
| `buildCompetitiveQuestions(entity, competitors, category)` | questionTemplates.js | Generate COMP_Q1-Q10 |
| `buildCategoryDetectionQuestions(entity)` | questionTemplates.js | Generate CAT_Q1-Q3 |
| `generateAllQuestions(config)` | questionTemplates.js | Generate all questions for a report |

**Note:** All questions are editable (`editable: true`) in the UI before analysis runs.

---

## Step 1b: LLM Prompts & System Instructions

**File:** `backend/src/services/promptBuilder.js`

All prompts enforce these critical rules:
- JSON-only output (no markdown wrappers, no code blocks)
- Exact JSON schema specification
- 3-5 real, verifiable sources required
- Character limits (Evidence: 100 chars, Description: 80 chars)
- YouTube channel identification for video sources
- Country/language filters for market specificity

### Reputation Analysis Prompt

```
Question: ${question}

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
- For ALL YouTube sources, you MUST set "youtube_channel" to the channel name
- Extract channel name from URL (@username, /c/name) or from your knowledge
- For non-YouTube sources, set "youtube_channel" to null

Use REAL, EXISTING sources. Include at least 3 sources.
```

### Visibility Analysis Prompt

```
Question: ${question}

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
    { "rank": 1, "name": "Brand Name", "comment": "Why this brand is notable" },
    { "rank": 2, "name": "Another Brand", "comment": "Why this brand is notable" }
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
      "url": "https://www.example.com/article",
      "title": "Example Article Title",
      "youtube_channel": null
    }
  ]
}
</JSON FORMAT>

<FIELD RULES>
- "sources_cited_news": news sites, online newspapers, press outlets, magazines
- "sources_cited_other": reviews, wikis, forums, etc.
- If no sources available, use an empty array []
- "youtube_channel": REQUIRED for YouTube sources, null for others
</FIELD RULES>
```

### Competitive Analysis Prompt

```
Question: ${question}

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
Return your choice, a structured analysis of this entity, and sources.
</TASK>

<JSON FORMAT>
Output ONLY valid JSON in this exact format:
{
  "entity_choice": "Brand Name",
  "entity_analysis": {
    "Brand Name": {
      "pros": [
        {
          "point": "Positive aspect of this brand",
          "sources": [{ "url": "https://...", "title": "...", "youtube_channel": null }]
        }
      ],
      "cons": [
        {
          "point": "Negative aspect of this brand",
          "sources": [{ "url": "https://...", "title": "...", "youtube_channel": null }]
        }
      ]
    }
  },
  "sources_cited_news": [...],
  "sources_cited_other": [...],
  "raw_response": "Brief explanation (1-2 sentences, max 150 chars)"
}
</JSON FORMAT>

<FIELD RULES>
- "entity_choice": MUST be exactly one of: ${entityList}
- "entity_analysis": Include exactly 2 pros and 2 cons per entity
- MAX 10 sources total combined
- "raw_response": max 150 characters
</FIELD RULES>
```

### Category Detection Prompt

```
Question: ${question}

<INSTRUCTIONS>
You are a JSON-only assistant. CRITICAL OUTPUT RULES apply.
</INSTRUCTIONS>

Analyze what core product/service categories ${entity} is associated with.${filterInstructions}

CRITICAL RULES FOR CATEGORY NAMING:

1. **Remove marketing qualifiers**: Strip brand-specific adjectives
   ❌ "Maximalist Running Shoes" → ✅ "Running Shoes"
   ❌ "Premium Credit Monitoring" → ✅ "Credit Monitoring"

2. **Use 1-3 words**: Keep it concise
   ✅ "Running Shoes", "Athletic Apparel", "Sports Equipment"

3. **Be specific about WHAT, not HOW**:
   - Identify the product type: "Running Shoes" (not just "Shoes")
   - Don't include positioning: Remove "Premium", "Luxury", "Budget", "Pro"
   - Don't include features: Remove "Cushioned", "Lightweight", "Waterproof"

For ${entity}, identify core categories following these rules:
- What products/services do they sell? (core types only)
- RANK categories by importance/strength of association (1 = most important)
- For each category, identify top 3-5 competitor brands

Output ONLY valid JSON in this exact format:
{
  "categories": [
    {
      "rank": 1,
      "name": "Running Shoes",
      "comment": "Known for cushioned running shoes with distinctive midsoles",
      "top_competitors": [
        {"rank": 1, "name": "Nike", "comment": "Market leader"},
        {"rank": 2, "name": "Brooks", "comment": "Specialized brand"},
        {"rank": 3, "name": "Asics", "comment": "Technical running shoes"}
      ]
    }
  ]
}

FINAL CHECK:
- Rank: 1-7, ordered by strength of association (1 = strongest)
- Category names: 1-3 words, NO marketing qualifiers
- Top competitors: 3-5 brands per category, NEVER include ${entity}
- Return 3-7 categories total
```

### Corporate Reputation Prompt

```
Question: ${question}

<INSTRUCTIONS>
You are a JSON-only assistant. CRITICAL OUTPUT RULES apply.
</INSTRUCTIONS>

Analyze ${entity}'s ${dimensionLabel}.${filterInstructions}${dimensionContext}

CRITICAL: Use REAL, VERIFIABLE sources. Keep responses CONCISE.

Output ONLY valid JSON in this exact format:
{
  "dimension": "${dimension}",
  "sentiment": "positive|negative|mixed",
  "findings": [
    {
      "theme": "Theme name from taxonomy (exact match required)",
      "strengths": [
        {
          "description": "Brief strength summary (max 80 chars)",
          "evidence": "Short quote or data point (max 100 chars)",
          "source_url": "URL from research",
          "source_title": "Source name"
        }
      ],
      "challenges": [
        {
          "description": "Brief challenge summary (max 80 chars)",
          "evidence": "Short quote (max 100 chars)",
          "source_url": "URL",
          "source_title": "Source"
        }
      ]
    }
  ],
  "sources_cited": [{ "url": "Full URL", "title": "Source title" }]
}

REQUIREMENTS:
- Only use themes from taxonomy list (exact match)
- Include 2-4 themes with findings (NOT more to avoid truncation)
- Each description: max 80 characters
- Each evidence: max 100 characters (use "..." for longer quotes)
- 1-2 strengths and 1-2 challenges per theme
- Include at least 3-5 real sources
```

**Corporate Dimension Themes:**
| Dimension | Available Themes |
|-----------|------------------|
| **Employer** | Compensation & Benefits, Career Development, Workplace Culture, Leadership Quality, Retention & Satisfaction |
| **DEI** | Diversity & Inclusion, Pay Equity, Social Responsibility, Community Engagement |
| **Leadership** | Executive Vision, Governance & Ethics, External Reputation |

### Source Classification Prompt

```
You are classifying source types for brand reputation monitoring.

Brand being monitored: "${brandName}"
Competitors: ${competitorList}

Sources to classify:
${JSON.stringify(sourcesList, null, 2)}

<INSTRUCTIONS>
Classify each source into EXACTLY ONE of these 10 categories.
Use the EXACT string value shown - no variations allowed.

APPROVED SOURCE TYPES:
1. "Corporate Blogs & Content" - Company blogs, corporate content marketing
2. "Journalism" - Professional news organizations, newspapers, news websites
3. "Government/NGO" - Official government websites, non-profit organizations
4. "Aggregators / Encyclopedic" - Wikipedia, aggregate sites, encyclopedias
5. "Academic/Research" - Academic journals, research papers, universities
6. "Owned Media" - ${brandName}'s own websites, blogs, social media
7. "Competitor Media" - Competitors' official websites and properties
8. "Paid/Advertorial" - Sponsored content, native advertising
9. "Social / UGC" - User-generated content, forums, review sites
10. "Press Release" - Official press releases, PR distribution sites

PRIORITY RULES:
- Source from ${brandName}'s domain → "Owned Media"
- Source from competitor domains → "Competitor Media"
- YouTube channels classified by WHO RUNS THE CHANNEL

Output format (JSON only, no markdown):
{
  "classifications": [
    {
      "id": 0,
      "source_type": "Journalism",
      "competitor_name": null,
      "confidence": "high",
      "reasoning": "Major news outlet"
    }
  ]
}
</INSTRUCTIONS>
```

### Reputation Concept Extraction Prompt (AI Aggregation)

```
You are analyzing brand reputation data for: ${entity}

Raw LLM responses from multiple questions (with source citations):
${responsesText}

Task:
1. Extract TOP 10 recurring concepts/themes
2. Calculate frequency (0.0 to 1.0 = proportion mentioning it)
3. Categorize sentiment: "positive", "negative", or "mixed"
4. Extract 2-3 key phrases for each concept (under 80 chars)
5. Extract source URLs with domain and title for ALL concepts
6. Track which LLM(s) mentioned each concept using cited_by field

Additionally:
7. Categorize into positive_topics, negative_topics, neutral_topics
8. For each topic: frequency (0-1), sentiment_score (-1 to 1), quotes (under 80 chars)
9. Return UP TO 5 most significant topics per sentiment category
10. Return at least 1 topic per category if any relevant sentiment exists

Output ONLY valid JSON:
{
  "concepts": [
    {
      "concept": "Customer Service",
      "frequency": 0.45,
      "sentiment": "positive",
      "key_phrases": ["excellent support", "responsive team"],
      "cited_by": ["Gemini", "OpenAI"]
    }
  ],
  "sentiment_topics": {
    "positive_topics": [...],
    "negative_topics": [...],
    "neutral_topics": []
  }
}
```

### Collaboration Recommendations Prompt

```
<INSTRUCTIONS>
You are a JSON-only assistant specializing in PR strategy and media relations.
Return ONLY valid JSON with no markdown, explanations, or additional text.
</INSTRUCTIONS>

TASK: Generate actionable collaboration recommendations to improve "${entity}"'s positioning based on this improvement opportunity.

OPPORTUNITY DETAILS:
- Title: ${opportunity.title}
- Description: ${opportunity.description}
- Type: ${opportunity.opportunity_type}
- Theme: ${opportunity.theme_category}
- Current State: ${JSON.stringify(opportunity.current_state)}
- Impact Score: ${opportunity.scores?.impact_score}
- Effort Score: ${opportunity.scores?.effort_score}
- Priority: ${opportunity.priority?.tier}
- Recommended Actions: ${JSON.stringify(opportunity.recommended_actions)}

HIGH-AUTHORITY SOURCES IN THIS SPACE:
${sourcesList}

GENERATE JSON with this structure:
{
  "collaborations": [
    {
      "target_type": "Journalist|Academic|Industry Analyst|Influencer|Partner",
      "target_description": "Brief description of ideal target",
      "domains_to_target": ["example.com"],
      "pitch_angle": "Specific angle for approaching",
      "talking_points": ["Key point 1", "Key point 2"],
      "expected_outcome": "What this could achieve",
      "approach_strategy": "How to initiate contact"
    }
  ],
  "pitch_strategy": {
    "primary_narrative": "Main story/narrative to push",
    "key_differentiators": ["What makes ${entity} unique"],
    "proof_points": ["Data/evidence to cite"],
    "timing_recommendations": "Best timing for outreach"
  },
  "content_ideas": [
    {
      "type": "Guest Article|Research Report|Case Study|Interview|Webinar",
      "title_suggestion": "Potential title",
      "target_publications": ["publication1"],
      "key_takeaways": ["Takeaway 1"]
    }
  ]
}

REQUIREMENTS:
1. Generate 3-5 collaboration suggestions tailored to opportunity type
2. Focus on high-authority targets that influence AI search visibility
3. Provide specific, actionable pitch angles
4. Keep descriptions under 100 characters each
```

### OpenAI System Instruction

**File:** `backend/src/services/llmService.js`

```
You are a JSON-only assistant. You MUST return ONLY valid JSON with no additional text, explanations, or markdown formatting. Do not wrap JSON in code blocks or add any conversational text before or after the JSON object.
```

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
