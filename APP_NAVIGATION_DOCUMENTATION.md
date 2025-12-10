# GEO Multi-LLM Brand Monitoring - Navigation & Data Documentation

## Overview

This application is a brand monitoring dashboard for **FXTM** (Forex Time broker) analyzing the **online forex trading** market. It provides multi-LLM analysis across reputation, visibility, and competitive positioning.

---

## Navigation Structure

### Sidebar Navigation (`AppSidebar.tsx`)

The sidebar is the primary navigation component with three main sections:

```
├── Analysis Types
│   └── Reputation Analysis (activeView: "reputation")
│
├── Category Analysis
│   └── Online forex trading (collapsible)
│       ├── Visibility (activeView: "online-forex-trading-visibility")
│       └── Competitive (activeView: "online-forex-trading-competitive")
│
└── Locations
    └── [Dynamic based on countryLanguageCombos]
```

### View Routing (`Index.tsx`)

The main page uses a state-based routing system:

```typescript
const [activeView, setActiveView] = useState("reputation");

// View mapping:
{activeView === "reputation" && <ReputationAnalysis />}
{activeView === "corporate" && <CorporateAnalysis />}  // Hidden but available
{activeView === "online-forex-trading-visibility" && <VisibilityCompetitiveAnalysis section="visibility" />}
{activeView === "online-forex-trading-competitive" && <VisibilityCompetitiveAnalysis section="competitive" />}
```

---

## Tab Components & Data Consumption

### 1. Reputation Analysis (`ReputationAnalysis.tsx`)

**Purpose:** Analyzes how FXTM is discussed by LLMs and which domains influence the conversation.

**Data Source:** Inline data objects (not imported from data files)

#### Data Structures:

| Data Object | Description | UI Component |
|-------------|-------------|--------------|
| `categoriesAssociated` | Categories where FXTM appears (Forex Trading, Stock Trading, etc.) | Table with ranking evolution |
| `topConcepts` | Key themes with sentiment (positive/mixed/negative) | Progress bars grouped by sentiment |
| `sentimentTopics` | Detailed sentiment breakdowns with quotes and sources | Grouped cards by sentiment type |
| `domainsBySourceType` | Domains grouped by source type | Table |
| `sourceTypeSov` | Share of voice by source type | Pie Chart |

#### JSON Structure Example - `categoriesAssociated`:

```json
{
  "name": "Forex Trading",
  "category_sov": 1,
  "average_position": 1,
  "mentions": 6,
  "frequency": 1,
  "comment": "FXTM is primarily known as an online broker...",
  "rankingEvolution": 0,
  "top_competitors": [
    {
      "name": "IG Group",
      "average_rank": 1,
      "mentions": 3,
      "frequency": 0.5,
      "comment": "Leading forex broker with global presence"
    }
  ]
}
```

---

### 2. Visibility Analysis (`VisibilityCompetitiveAnalysis.tsx` with `section="visibility"`)

**Purpose:** Shows brand visibility metrics, rankings, and where FXTM appears (or doesn't) in LLM responses.

**Data Source:** `onlineForexTradingData` object (inline in component)

#### Data Structures:

| Data Object | Description | UI Component |
|-------------|-------------|--------------|
| `visibility` | Core metrics (visibility %, SOV, avg position) | Metric Cards |
| `trendData` | Historical trend data by month | Line Chart |
| `topDomainsNews` | Top news domains cited | Domain list |
| `topDomainsNonNews` | Top non-news domains cited | Domain list |
| `sourceTypeSov` | SOV distribution by source type | Pie Chart |
| `sourceTypeBreakdown` | Detailed breakdown per source type | Expandable sections |
| `entitiesRanking` | Competitor ranking table | Table |
| `rankedFirstQuestions` | Questions where FXTM ranked #1 | Question cards |
| `notRankedFirstQuestions` | Questions where FXTM didn't rank #1 | Question cards with competitor info |

#### JSON Structure Example - `visibility`:

```json
{
  "visibility": 0,
  "averagePosition": 0,
  "sov": 0,
  "sovStatus": "Poor",
  "sovEvolution": 0,
  "sovEvolutionDirection": "down",
  "totalQuestions": 20,
  "mentions": 0
}
```

#### JSON Structure Example - `notRankedFirstQuestions`:

```json
{
  "question": "Best online forex trading?",
  "llm": "Gemini",
  "onclusiveRank": null,
  "topBrand": "IG",
  "overallRanking": ["IG", "Saxo", "Interactive Brokers", "FOREX.com", "Charles Schwab"],
  "comment": "IG is consistently ranked as a top overall forex broker...",
  "isNew": false,
  "sources": [
    {
      "name": "Statrys",
      "url": "https://www.statrys.com/blog/best-forex-platforms"
    }
  ]
}
```

---

### 3. Competitive Analysis (`VisibilityCompetitiveAnalysis.tsx` with `section="competitive"`)

**Purpose:** Shows head-to-head brand comparisons, won/missed opportunities, and competitive positioning.

**Data Source:** `onlineForexTradingData` object (inline in component) + additional competitive data arrays

#### Data Structures:

| Data Object | Description | UI Component |
|-------------|-------------|--------------|
| `brandRanking` | All brands with SOV, visibility, ranking | Table |
| `sovByLLM` | SOV distribution by brand | Pie Chart |
| `prosAndCons` | Pros/cons for each brand | Expandable cards |
| `wonOpportunities` | Questions where FXTM won | Question cards (green) |
| `missedOpportunities` | Questions where FXTM lost | Question cards (red) |

#### JSON Structure Example - `wonOpportunities`:

```json
{
  "question": "FXTM vs forex.com — which is better?",
  "whyWon": "FXTM chosen for strong regulation",
  "llm": "Gemini",
  "competitors": ["forex.com", "fxpro"],
  "sources": [
    {
      "url": "https://example.com",
      "title": "Source Title",
      "source_type": "Social / UGC"
    }
  ]
}
```

#### JSON Structure Example - `missedOpportunities`:

```json
{
  "question": "FXTM vs forex.com vs fxpro vs oanda — which is better for online forex trading?",
  "whyMissed": "Chosen by LLM: forex.com",
  "whyChosen": "forex.com is chosen for its robust regulation...",
  "llm": "Gemini",
  "chosenBrand": "forex.com",
  "competitors": ["forex.com", "fxpro", "oanda"],
  "sources": [
    {
      "url": "https://www.investing.com/brokers/reviews/fxpro/",
      "title": "FxPro Review 2025 - Investing.com",
      "source_type": "Aggregators / Encyclopedic"
    }
  ]
}
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Index.tsx (Main Page)                     │
│  ┌─────────────────┐                                            │
│  │ activeView state│ ────────────────────────────────┐          │
│  └─────────────────┘                                 │          │
│         │                                            │          │
│         ▼                                            ▼          │
│  ┌─────────────────┐                    ┌────────────────────┐  │
│  │   AppSidebar    │ ◄──────────────────│ View Components    │  │
│  │   (Navigation)  │    onViewChange    │                    │  │
│  └─────────────────┘                    │ • ReputationAnalysis│ │
│                                         │ • VisibilityCompetitive│
│                                         │   (visibility/competitive)│
│                                         └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Inline Data Objects (in component files)                  │   │
│  │  • categoriesAssociated, topConcepts, sentimentTopics    │   │
│  │  • onlineForexTradingData (visibility, trendData, etc.)  │   │
│  │  • wonOpportunities, missedOpportunities                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ External Data Files                                       │   │
│  │  • src/data/athleticShoesData.ts (sample/legacy data)    │   │
│  │  • src/data/socialListeningData.ts                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Utility Functions                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ src/lib/questionUtils.ts                                  │   │
│  │  • groupQuestionsByText() - Groups questions by LLM      │   │
│  │  • getQuestionContext() - Extracts context from grouped  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Visualization Components                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐  │
│  │  Recharts   │ │   Tables    │ │   Cards     │ │  Badges  │  │
│  │ (Pie, Line) │ │ (shadcn/ui) │ │ (shadcn/ui) │ │(shadcn/ui)│  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Question Grouping Utility

The `groupQuestionsByText()` function in `src/lib/questionUtils.ts` groups identical questions from different LLMs:

### Input:
```typescript
[
  { question: "Best forex broker?", llm: "Gemini", topBrand: "IG", ... },
  { question: "Best forex broker?", llm: "OpenAI", topBrand: "Fidelity", ... }
]
```

### Output:
```typescript
{
  question: "Best forex broker?",
  responses: [
    { llm: "Gemini", topBrand: "IG", ... },
    { llm: "OpenAI", topBrand: "Fidelity", ... }
  ]
}
```

---

## Key UI Patterns

### 1. Metric Cards
Used for displaying KPIs like visibility %, SOV, average position.

### 2. Tables with Evolution Indicators
Shows ranking changes with arrow icons (↑ green, ↓ red, = neutral).

### 3. Pie Charts (Recharts)
Used for SOV distribution by source type or brand.

### 4. Line Charts (Recharts)
Used for trend data over time (visibility, SOV evolution).

### 5. Question Cards
Display LLM responses with:
- Question text
- LLM indicator (Gemini/OpenAI badge)
- Top brand mentioned
- Source links
- Won/missed status (for competitive section)

### 6. Collapsible Sections
Used for citation type breakdowns and detailed competitor information.

---

## Source Types Classification

The app categorizes sources into:

| Source Type | Examples |
|-------------|----------|
| Corporate Blogs & Content | forexbrokers.com, fxempire.com |
| Journalism | investopedia.com, cbsnews.com |
| Social / UGC | trustpilot.com, youtube.com, reddit.com |
| Aggregators / Encyclopedic | wikipedia.org, comparison sites |
| Government/NGO | Regulatory bodies |

---

## Entity: FXTM

The dashboard is configured to analyze **FXTM** (Forex Time) in the **online forex trading** category. Key competitors tracked:

- IG
- Pepperstone  
- FOREX.com
- Interactive Brokers
- OANDA
- CMC Markets
- eToro
- AvaTrade
- FxPro

---

## File Structure Summary

```
src/
├── pages/
│   └── Index.tsx              # Main page with view routing
├── components/
│   ├── AppSidebar.tsx         # Navigation sidebar
│   ├── ReputationAnalysis.tsx # Reputation tab
│   ├── VisibilityCompetitiveAnalysis.tsx # Visibility & Competitive tabs
│   ├── LLMBadge.tsx           # LLM indicator component
│   └── ui/                    # shadcn/ui components
├── lib/
│   └── questionUtils.ts       # Question grouping utilities
└── data/
    ├── athleticShoesData.ts   # Legacy sample data
    └── socialListeningData.ts # Social listening data
```
