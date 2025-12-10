# Data Schema Documentation

## Overview
This schema documents the data structure for the FXTM Competitive Analysis Dashboard, analyzing brand visibility and reputation in the online forex trading market.

---

## Root Object

| Field | Type | Description |
|-------|------|-------------|
| `metadata` | Object | Dataset metadata |
| `visibility` | Object | Current visibility metrics for FXTM |
| `trendData` | Array | Time-series visibility data |
| `competitorsRanking` | Array | Competitor ranking table |
| `sourceTypeSov` | Array | Share of voice by source type |
| `sourceTypeBreakdown` | Array | Detailed source breakdown with domains |
| `topDomains` | Object | Top domains by category |
| `reputationAnalysis` | Object | Brand reputation data |
| `questions` | Object | LLM question analysis |

---

## Schema Details

### `metadata`
```typescript
{
  entity: string;           // Brand being analyzed (e.g., "FXTM")
  category: string;         // Market category (e.g., "Online forex trading")
  generatedAt: string;      // ISO date string
  totalQuestions: number;   // Total questions analyzed
}
```

### `visibility`
```typescript
{
  visibility: number;       // 0-100, percentage of questions where brand appears
  averagePosition: number;  // Average ranking position (lower is better)
  shareOfVoice: number;     // 0-100, calculated SOV percentage
  sovStatus: string;        // "Poor" | "Fair" | "Good" | "Excellent"
  sovEvolution: number;     // Change from previous period
  totalQuestions: number;   // Questions in analysis set
  mentions: number;         // Total brand mentions
}
```

### `trendData[]`
```typescript
{
  month: string;            // Month abbreviation (e.g., "Jan")
  visibility: number;       // Visibility score 0-100
  sov: number;              // Share of voice 0-100
  ranking: number;          // Average ranking position
}
```

### `competitorsRanking[]`
```typescript
{
  rank: number;             // Position in ranking (1-based)
  name: string;             // Competitor brand name
  sov: number;              // Share of voice (0-1 decimal)
  visibility: number;       // Visibility (0-1 decimal)
  avgPosition: number;      // Average position in LLM responses
  mentions: number;         // Total mentions across questions
}
```

### `sourceTypeSov[]`
```typescript
{
  name: string;             // Source type name
  value: number;            // Percentage value
  percentage: string;       // Formatted percentage string
}
```

**Source Types:**
- `Corporate Blogs & Content` - Industry review sites, broker comparison sites
- `Journalism` - News outlets, financial publications
- `Social / UGC` - User-generated content, forums, YouTube

### `sourceTypeBreakdown[]`
```typescript
{
  type: string;             // Source type name
  count: number;            // Number of sources
  domains: Array<{
    domain: string;         // Domain name
    percentage: number;     // Contribution percentage
  }>
}
```

### `topDomains`
```typescript
{
  news: Array<{
    domain: string;
    percentage: number;
  }>;
  nonNews: Array<{
    domain: string;
    percentage: number;
  }>;
}
```

### `reputationAnalysis.categoriesAssociated[]`
```typescript
{
  name: string;             // Category name (e.g., "Forex Trading")
  categorySov: number;      // SOV within this category (0-1)
  averagePosition: number;  // Average ranking in category
  mentions: number;         // Mentions in category
  frequency: number;        // Frequency of appearance (0-1)
  comment: string;          // Descriptive comment
  topCompetitors: string[]; // List of top competitors
}
```

### `reputationAnalysis.topConcepts[]`
```typescript
{
  concept: string;          // Concept/topic name
  sentiment: string;        // "positive" | "negative" | "mixed"
  value: number;            // Strength score 0-100
  frequency: number;        // Frequency of mention (0-1)
}
```

### `questions.notRankedFirst[]`
```typescript
{
  question: string;         // The question asked
  llm: string;              // LLM source (e.g., "Gemini", "OpenAI")
  topBrand: string;         // Brand ranked first
  overallRanking: string[]; // Full ranking array
  comment: string;          // LLM's reasoning
  sources: Array<{
    name: string;           // Source name
    url: string;            // Source URL
  }>
}
```

---

## Aggregation Logic

### Share of Voice (SOV) Calculation
```javascript
SOV = (brandMentions / totalMentions) * 100

// Per question contribution:
questionSov = 1 / position  // Position 1 = 1.0, Position 2 = 0.5, etc.

// Total SOV:
totalSov = sum(questionSov) / totalQuestions
```

### Visibility Calculation
```javascript
visibility = (questionsWithMention / totalQuestions) * 100
```

### Average Position
```javascript
avgPosition = sum(positions) / questionsWithMention
// Lower is better (1 = always first)
```

---

## Data Flow

```
Raw LLM Responses → Question Parser → Aggregation Engine → Visualization Data
                          ↓
                   Source Extraction
                          ↓
                   Domain Classification
```
