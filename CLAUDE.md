# GEO Multi-LLM Brand Analysis System

This file provides guidance to Claude Code when working with the GEO Multi-LLM Brand Analysis system.

## Git Repository

**Repository:** https://github.com/Qreant/geo-multi-llm-split

**IMPORTANT Git Rules:**
1. **NEVER push to git automatically** - Only push when the user explicitly asks to push
2. **Only push to the above repository** - Do not push to any other remote
3. Commits can be made freely, but pushing requires explicit user request
4. When asked to push, use: `git push origin <branch>`

## Project Overview

A full-stack web application for analyzing brand reputation and visibility across AI search engines (Gemini, OpenAI GPT-4o). The system performs multi-dimensional brand analysis by querying LLMs with structured prompts and aggregating results into actionable insights.

**Tech Stack:**
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js + Express.js
- **Database:** SQLite (better-sqlite3)
- **APIs:** Gemini 2.5 Flash, OpenAI GPT-4o

## IMPORTANT: Legacy vs Active Code

### Active Implementation (MODIFY THIS)
```
/backend/src/          - Node.js Express backend (all new features go here)
/frontend/src/         - React frontend
```

### Legacy Reference Only (DO NOT MODIFY)
```
GEO_Multi-LLM_Analysis_V2.17_DUAL_LLM.gs  - Original Google Apps Script
```

**The `.gs` file is the original Google Apps Script implementation. It serves as REFERENCE ONLY for understanding the analysis logic, prompt patterns, and data structures. ALL new development and modifications should be made to the Node.js backend and React frontend.**

## System Architecture

### LLM Providers
- **Gemini 2.5 Flash**: Primary analysis engine (max 65K output tokens)
- **OpenAI GPT-4o-search-preview**: Parallel analysis with web search support
- **Dual LLM Execution**: Both models query same questions in parallel, results merged with nested structure

### Analysis Types
1. **Reputation Analysis** - Brand sentiment, topics, strengths/weaknesses
2. **Visibility Analysis** - AI search rankings, missed opportunities, brand presence
3. **Competitive Analysis** - Win/loss rates, SOV, pros/cons, competitive positioning
4. **Corporate Reputation Analysis** - Employer reputation, DEI, leadership/governance
5. **PR Insights** (V2.18) - Prioritized improvement opportunities using Impact-Effort Matrix

### Configuration Constants
```javascript
MODEL: 'gemini-2.5-flash'
TEMPERATURE: 0.1
MAX_OUTPUT_TOKENS: 56000
BATCH_SIZE: 25
```

## Prompt Engineering Patterns

All prompts follow strict JSON-only output format:

```
System Instructions:
"You are a JSON-only assistant. Return ONLY valid JSON with no markdown, explanations, or additional text."

Prompt Structure:
1. Context: "Analyze {entity} based on these AI responses..."
2. Instructions: Numbered steps with explicit JSON schema
3. Output Format: Exact JSON structure with field descriptions
```

### Critical Prompt Requirements
- JSON-only output (no markdown wrappers, no conversational text)
- Grounding citations required (url, title fields populated from LLM-provided sources)
- Evidence fields limited to 100 characters (truncate with "...")
- Description fields limited to 80 characters
- Never reference "AI responses", "LLM outputs", or "search results" in user-facing text
- Use neutral, journalistic tone for all narrative descriptions

## Source Classification System

9-category taxonomy for source attribution:

1. **Corporate Blogs & Content** - Official brand content
2. **Journalism** - News organizations, investigative reporting
3. **Government/NGO** - Official government sites, non-profit organizations
4. **Aggregator/Encyclopedic** - Comparison sites, knowledge bases
5. **Academic/Research** - Universities, research institutions
6. **Press Release** - PR distributions, official announcements
7. **Review Sites** - Glassdoor, Trustpilot, product review platforms
8. **Social/UGC** - Forums, Reddit, social media discussions
9. **Other** - Uncategorized sources

**Classification Logic:**
- Domain-based pattern matching (e.g., `.edu` → Academic)
- Content analysis via LLM with confidence scoring
- Automatic reclassification when sources updated

## Data Structures

### Aggregated Analysis Object
```javascript
{
  reputation: {
    entity: string,
    sentiment_topics: {
      positive_topics: [{topic, frequency, sentiment_score, quotes, sources}],
      negative_topics: [{topic, frequency, sentiment_score, quotes, sources}],
      neutral_topics: [{topic, frequency, sentiment_score, quotes, sources}]
    },
    strengths: [{strength, description, evidence, sources}],
    weaknesses: [{weakness, description, evidence, sources}],
    source_analysis: {...},
    questions: number
  },
  visibility: {
    entity: string,
    brand_visibility: number,
    missed_opportunities: {
      opportunities: [{question_text, current_rank, top_ranked_entity, top_ranked_comment, why_missed, top_sources}]
    },
    not_mentioned_count: number,
    source_analysis: {...}
  },
  competitive_metrics: {
    category: string,
    entity: string,
    sov_choice_by_llm: {...},
    pros_cons: {
      pros: [{attribute, frequency, sources}],
      cons: [{attribute, frequency, sources}]
    },
    win_rate: number,
    source_analysis: {...}
  },
  competitive_opportunities: {
    won_opportunities: {...},
    missed_opportunities: {...}
  },
  corporate_reputation: {
    employer_reputation: {dimension, sentiment_dist, themes: [{theme, strengths, challenges}]},
    dei_social: {...},
    leadership_governance: {...},
    source_analysis: {...}
  },
  pr_insights: {
    analysis_type: "pr_insights",
    entity: string,
    total_opportunities: number,
    priority_summary: {critical, strategic, quick_wins, low_priority},
    theme_distribution: {},
    metrics_overview: {},
    opportunities: [...]
  }
}
```

### PR Insights Opportunity Structure
```javascript
{
  id: "REP_001",
  title: string,
  description: string,
  opportunity_type: "Reputation Issue" | "AI Visibility Gap" | "Competitive Positioning Gap" | "Corporate Reputation Challenge",
  theme_category: "Reputation Management" | "AI Search Visibility" | "Competitive Positioning" | "Corporate Reputation",
  current_state: {metric, frequency?, rank?, sentiment_score?},
  competitor_analysis?: {top_ranked_entity, winning_attributes, why_they_win},
  scores: {
    impact_score: number,
    impact_label: "High" | "Medium" | "Low",
    effort_score: number,
    effort_label: "Low" | "Medium" | "High"
  },
  priority: {
    tier: "Critical" | "Strategic" | "Quick Wins" | "Low Priority",
    label: string,
    urgency: 1-4,
    timeline: string,
    color: "red" | "orange" | "yellow" | "gray"
  },
  recommended_actions: string[],
  evidence: [{type, text, source_title, source_url}],
  sources: [{url, domain, title, source_type, cited_by}],
  metadata: {...}
}
```

## Impact-Effort Scoring Algorithm

### Impact Score Formula (0-1 scale)
```
Impact = (frequency × 0.4) + (sentiment_gap × 0.3) + (source_quality × 0.2) + (competitive_relevance × 0.1)
```

**Components:**
- **Frequency** (40%): How often mentioned (0-1)
- **Sentiment Gap** (30%): Absolute sentiment score or normalized rank gap
- **Source Quality** (20%): Journalism = 0.9, Others = 0.6
- **Competitive Relevance** (10%): Competitive choice percentage or default 0.5

**Thresholds:**
- High Impact: ≥ 0.70
- Medium Impact: 0.40-0.69
- Low Impact: < 0.40

### Effort Score Formula (0-1 scale)
Based on opportunity type and attributes:

**Reputation Opportunities:**
- High frequency (≥0.6) + few sources (≤3) = 0.25 (content fix)
- High frequency (≥0.6) + many sources (>3) = 0.55 (narrative shift)
- Medium frequency (0.3-0.6) = 0.30 (targeted campaign)
- Low frequency (<0.3) = 0.25 (quick fix)

**Visibility Opportunities:**
- Rank 2 = 0.25 (positioning tweak)
- Rank 3-4 = 0.50 (content enhancement)
- Rank 5+ = 0.75 (major positioning shift)

**Competitive Opportunities:**
- Feature/capability gap = 0.90 (product development)
- Price/cost attribute = 0.60 (pricing strategy)
- Messaging/positioning = 0.35 (messaging update)

**Corporate Opportunities:**
- Employer dimension = 0.95 (culture change)
- DEI/Social dimension = 0.65 (program implementation)
- Leadership dimension = 0.60 (governance/comms)

**Thresholds:**
- Low Effort: < 0.40 (1-3 months)
- Medium Effort: 0.40-0.69 (3-6 months)
- High Effort: ≥ 0.70 (6-12+ months)

### Priority Categorization (Impact-Effort Matrix)
```
             Low Effort              High Effort
High Impact  Critical (Red)          Strategic (Orange)
             Do First (1-3 mo)       Plan Long-term (6-12 mo)

Low Impact   Quick Wins (Yellow)     Low Priority (Gray)
             Easy Wins (1-2 mo)      Deprioritize (12+ mo)
```

## Key Functions Reference

### Analysis Aggregation
- `aggregateReputationAnalysis_(rawResponses, config)` - Lines 1850-2200
- `aggregateVisibilityAnalysis_(rawResponses, config)` - Lines 2350-2700
- `aggregateCompetitiveAnalysis_(rawResponses, config, apiKey, ss)` - Returns {metrics, opportunities}
- `aggregateCorporateReputationAnalysis_(rawResponses, config)` - Lines 3700-3924

### PR Insights (V2.18)
- `aggregatePRInsights_(aggregatedAnalysis, config)` - Main orchestrator (Lines 4686-4839)
- `extractReputationOpportunities_(reputationAnalysis, config)` - Lines 4136-4232
- `extractVisibilityOpportunities_(visibilityAnalysis, config)` - Lines 4240-4348
- `extractCompetitiveOpportunities_(metricsAnalysis, opportunitiesAnalysis, config)` - Lines 4357-4548
- `extractCorporateOpportunities_(corporateAnalysis, config)` - Lines 4556-4677
- `calculateImpactScore_(data)` - Lines 3960-3984
- `calculateEffortScore_(data)` - Lines 4004-4064
- `categorizePriority_(impactScore, effortScore)` - Lines 4083-4124

### Source Management
- `generateSourceAnalysis_(rawResponses)` - Aggregates source metadata
- `classifySourceType_(url, title, apiKey)` - LLM-based classification with confidence
- `writeSourceClassifications_(ss, aggregatedAnalysis, config, apiKey)` - V2.13 sheet output

### Output Functions
- `writeAggregatedAnalysis_(ss, aggregatedAnalysis)` - Writes JSON rows to sheet (Lines 6431+)
- `computeAllSummaries_(ss, config, aggregatedAnalysis)` - Generates Summary sheet
- `writeResultRow_(sheet, response, analysisType, llmSource)` - Individual result rows

## Sheet Structure

1. **Results** - Individual LLM responses (Gemini, OpenAI columns)
2. **Summary** - Dashboard with tabs: Reputation, Visibility, Competitive, Corporate
3. **Raw JSON Responses** - Full JSON for debugging
4. **Aggregated Analysis** - One row per analysis type (reputation, visibility, competitive_metrics, competitive_opportunities, corporate_reputation, pr_insights)
5. **Source Classifications** - Source type analysis with confidence scores
6. **URL Resolution Debug** - Redirect resolution tracking

## Execution Flow

1. **User Input** - Config sheet (B3-B16): entity, competitors, countries, languages, API keys
2. **Question Generation** - Build prompts for selected analysis types
3. **Parallel LLM Calls** - Gemini + OpenAI query same questions simultaneously
4. **Response Parsing** - Robust JSON extraction with brace-counting algorithm
5. **Source Resolution** - Batch redirect resolution (parallel UrlFetchApp.fetchAll)
6. **Source Classification** - LLM-based categorization with 9-type taxonomy
7. **Aggregation** - Combine responses into structured analysis objects
8. **PR Insights Generation** (V2.18) - Extract and prioritize opportunities
9. **Sheet Output** - Write to Aggregated Analysis and Summary sheets
10. **User Alert** - Show completion stats (success/fail counts per LLM)

## Performance Characteristics

- **Expected Runtime**: 65-70 seconds for full analysis (25 questions)
- **Parallel Execution**: Gemini + OpenAI run simultaneously (50-55s API time)
- **Redirect Resolution**: 2-3 seconds (batch processing of 100+ URLs)
- **JSON Parsing**: Robust brace-counting handles malformed responses
- **Output Size**: ~15-25K characters per analysis type (well under 50K cell limit)

## Error Handling Patterns

### JSON Parsing Failures
- Brace-counting algorithm extracts valid JSON from markdown wrappers
- Logs failed responses to Raw JSON sheet with first 500 characters
- Console logging shows: question ID, type, response length, first/last 200 chars

### API Failures
- Retry logic with exponential backoff (50ms base delay)
- DNS error graceful fallback (continues execution)
- Per-LLM success/fail tracking (Gemini and OpenAI counted separately)

### Source Resolution Failures
- Individual URL error handling in batch resolution
- Fallback to original URL if redirect fails
- Debug logging to URL Resolution Debug sheet

## Version History Key Changes

- **V2.12**: Dual LLM support (Gemini + OpenAI parallel execution)
- **V2.13**: Source classification with 9-type taxonomy
- **V2.14**: Source deduplication and nested LLM structure
- **V2.15**: Country and language filter support
- **V2.16**: Truncation fix with increased output tokens (56K)
- **V2.17**: Evidence field restoration with 100-char limits
- **V2.17.1**: Competitive analysis split (metrics vs opportunities) to avoid 50K truncation
- **V2.18**: PR Insights with Impact-Effort Matrix prioritization

## Integration Points

### External Tools
- Export Aggregated Analysis JSON to Tableau, Power BI, Monday.com
- PR Insights designed for external PR management software
- Source Classifications compatible with BI dashboards

### API Dependencies
- Google Apps Script UrlFetchApp for HTTP requests
- Gemini API (generativelanguage.googleapis.com)
- OpenAI API (api.openai.com)

## Code Modification Guidelines

When modifying this codebase:

1. **Preserve JSON Structure** - External tools depend on exact field names
2. **Maintain Character Limits** - Evidence (100 chars), Description (80 chars)
3. **Update Version Header** - Document changes with version number and impact summary
4. **Test Both LLMs** - Ensure Gemini and OpenAI paths work identically
5. **Validate JSON Output** - Check Aggregated Analysis sheet doesn't exceed 50K per cell
6. **Consider Sheet Limits** - Google Sheets has 10M cell limit per spreadsheet
7. **Profile Performance** - Target 65-70 second execution time for 25 questions
8. **Handle Edge Cases** - Empty results, missing fields, malformed JSON
9. **Log Debugging Info** - Use console.log and debug sheets, not UI alerts during execution
10. **Batch Operations** - Use UrlFetchApp.fetchAll and sheet batch writes for performance

## Troubleshooting

**"Cell size limit exceeded" error:**
- Check Aggregated Analysis row character count
- V2.17.1 split competitive analysis into separate rows
- Consider splitting other large analysis types if needed

**JSON parsing failures:**
- Check Raw JSON sheet for actual LLM response
- Look for markdown wrappers (```json```) or conversational text
- Verify prompt includes "<INSTRUCTIONS>You are a JSON-only assistant..."

**Missing results in Summary sheet:**
- Verify aggregatedAnalysis object has expected analysis types
- Check computeAllSummaries_ receives correct parameters
- Ensure writeResultRow_ has case for analysis type

**Source classification errors:**
- Check API key validity in Script Properties or cell B15/B16
- Verify classifySourceType_ prompt returns valid JSON
- Review Source Classifications sheet for confidence scores
