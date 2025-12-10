# FXTM Competitive Analysis - Visualization Export Package

A reproducible visualization package for the FXTM competitive analysis dashboard.

## 📁 Package Contents

| File | Description |
|------|-------------|
| `data.json` | Complete dataset with all metrics, rankings, and analysis |
| `schema.md` | Data schema documentation with field definitions |
| `viz-spec.json` | Chart specifications (types, scales, colors, interactions) |
| `tokens.json` | Design tokens (colors, typography, spacing) |
| `index.html` | Runnable HTML visualization |
| `styles.css` | Stylesheet with design system |
| `app.js` | Chart.js-based visualization logic |

## 🚀 Quick Start

### Option 1: Local Server (Recommended)

```bash
# Navigate to the viz-export directory
cd public/viz-export

# Using Python 3
python -m http.server 8080

# OR using Node.js (npx)
npx serve .

# OR using PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

### Option 2: Direct File (Limited)

Open `index.html` directly in a browser. Note: Data loading may fail due to CORS restrictions. Use a local server for best results.

## 📊 Visualizations Included

### 1. Metric Cards
- Brand Visibility (%)
- Share of Voice (%)
- Average Position (#)
- Total Mentions

### 2. Source Type Distribution (Pie/Donut Chart)
- Corporate Blogs & Content
- Journalism
- Social / UGC

### 3. Competitor SOV Ranking (Horizontal Bar Chart)
- Top 10 competitors by Share of Voice
- FXTM highlighted in different color

### 4. Competitive Ranking Table
- Full competitor metrics
- Sortable columns

### 5. Concept Sentiment Analysis
- Sentiment bars with color coding
- Positive (green), Negative (red), Mixed (gray)

## 🎨 Design Tokens

### Primary Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#3B82F6` | Brand color, primary actions |
| Success | `#22C55E` | Positive indicators |
| Warning | `#F59E0B` | Warnings, tertiary data |
| Destructive | `#EF4444` | Negative indicators |

### Chart Palette
```
Chart 1: #3B82F6 (Blue)
Chart 2: #22C55E (Green)
Chart 3: #F59E0B (Amber)
Chart 4: #A855F7 (Purple)
Chart 5: #EC4899 (Pink)
```

## 📐 Aggregation Logic

### Share of Voice (SOV)
```javascript
// Per position contribution
positionSov = 1 / position  // Position 1 = 1.0, Position 2 = 0.5, etc.

// Total SOV
totalSov = sum(positionSov) / totalQuestions
```

### Visibility
```javascript
visibility = (questionsWithMention / totalQuestions) * 100
```

### Average Position
```javascript
avgPosition = sum(positions) / questionsWithMention
// Lower is better (1 = always ranked first)
```

## 🔧 Customization

### Changing Colors
Edit `tokens.json` or CSS variables in `styles.css`:

```css
:root {
  --color-primary: #3B82F6;
  --color-chart-1: #3B82F6;
  /* ... */
}
```

### Adding New Charts
1. Add chart spec to `viz-spec.json`
2. Add canvas element to `index.html`
3. Add render function to `app.js`

## 📦 Dependencies

- **Chart.js 4.4.1** - Loaded via CDN
- No other external dependencies

## 📄 License

This visualization package is provided for analysis and reporting purposes.

---

Generated: 2025-12-03
Entity: FXTM
Category: Online forex trading
