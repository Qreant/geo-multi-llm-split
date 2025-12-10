# GEO Multi-LLM Brand Analysis

A localhost application for analyzing brand reputation and visibility across AI search engines (Gemini & OpenAI GPT-4).

## Features

- **Multi-LLM Analysis**: Query both Gemini 2.0 Flash and OpenAI GPT-4 in parallel
- **Three Analysis Types**:
  - Reputation Analysis - Brand sentiment, topics, strengths/weaknesses
  - Visibility Analysis - AI search rankings, brand presence
  - Competitive Analysis - Head-to-head comparisons, win/loss tracking
- **Editable Questions**: Customize questions before running analysis
- **Real-time Progress**: Live updates via Server-Sent Events
- **Data Persistence**: SQLite database stores all reports
- **Highcharts Visualizations**: Interactive charts for all analysis types

## Architecture

```
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # LLM integration & analysis
│   │   ├── models/       # Database models
│   │   ├── database/     # SQLite schema
│   │   └── utils/        # Question templates, JSON parsing
├── frontend/             # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/        # Main pages
│   │   ├── components/   # Reusable components
│   │   └── lib/          # Utilities
└── database/             # SQLite database files
```

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Gemini API Key (from Google AI Studio)
- OpenAI API Key (with GPT-4 access)

## Installation

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure API Keys

Create `backend/.env` from the example:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=3001
NODE_ENV=development

# Required: Add your API keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Database
DATABASE_PATH=../database/reports.db

# LLM Configuration
GEMINI_MODEL=gemini-2.0-flash-exp
OPENAI_MODEL=gpt-4o-2024-11-20
TEMPERATURE=0.1
MAX_OUTPUT_TOKENS=56000
BATCH_SIZE=25
```

### 3. Initialize Database

The database will be automatically created on first run. It will be located at:
```
database/reports.db
```

## Running the Application

### Development Mode (Recommended)

Run both backend and frontend concurrently:

```bash
npm run dev
```

This will start:
- Backend API: http://localhost:3001
- Frontend: http://localhost:5173

### Production Mode

```bash
# Build frontend
npm run build

# Start backend
npm start
```

## Usage

### Creating a New Report

1. Navigate to http://localhost:5173
2. Click "New Report"
3. Fill in the configuration:
   - **Entity**: Your brand name (e.g., "FXTM")
   - **Category**: Product/service category (e.g., "online forex trading")
   - **Competitors**: Comma-separated list (e.g., "IG, Pepperstone, FOREX.com")
   - **Countries**: Optional filter (e.g., "United States, United Kingdom")
   - **Languages**: Optional filter (e.g., "English")
4. Review and edit questions (optional)
5. Click "Start Analysis"
6. Watch real-time progress
7. View results when complete

### Viewing Reports

- All reports are listed on the homepage
- Click "View" to see detailed analysis
- Reports are saved permanently in SQLite database
- Delete reports you no longer need

## Analysis Types

### Reputation Analysis

Analyzes how your brand is discussed across AI responses:
- Sentiment topics (positive, negative, neutral)
- Key themes and frequency
- Source attribution
- Sentiment trends

**Example Visualizations**:
- Sentiment Distribution Pie Chart
- Topic Frequency Bar Chart
- Source Type Distribution

### Visibility Analysis

Shows where your brand appears in AI search results:
- Visibility percentage
- Average ranking position
- Share of Voice (SOV)
- Questions where brand ranked #1
- Missed opportunities

**Example Visualizations**:
- Ranking Trends Line Chart
- SOV by Competitor Pie Chart
- Position Distribution

### Competitive Analysis

Head-to-head brand comparisons:
- Win/loss tracking
- Competitive positioning
- Pros and cons analysis
- Brand choice frequency

**Example Visualizations**:
- Win Rate Comparison Bar Chart
- Competitive Matrix Heatmap
- Choice Distribution

## API Endpoints

### Reports

- `GET /api/reports` - List all reports
- `GET /api/reports/:id` - Get single report with analysis
- `DELETE /api/reports/:id` - Delete report

### Analysis

- `POST /api/analysis/preview-questions` - Preview questions for configuration
- `POST /api/analysis/start` - Start new analysis
- `GET /api/analysis/progress/:reportId` - SSE endpoint for real-time progress

## Database Schema

### Reports Table
- Metadata (entity, category, competitors, etc.)
- Status tracking (processing/completed/failed)
- Execution time

### Analysis Results Table
- Aggregated analysis by type
- JSON data storage

### LLM Responses Table
- Raw responses from both LLMs
- Question-response mapping
- Source citations

### Sources Table
- Deduplicated sources
- URL resolution
- Classification metadata

## Question Templates

### Reputation Questions (10 default)
- "Is {entity} good for {category}?"
- "Is {entity} worth it for {category}?"
- "Should I buy {entity} for {category}?"
- etc.

### Visibility Questions (10 default)
- "Best {category}?"
- "Top {category} brands?"
- "Which {category} should I choose?"
- etc.

### Competitive Questions (10 default)
- "{entity} vs {competitor} — which is better?"
- "Compare {entity}, {competitor1}, {competitor2}"
- etc.

**All questions are editable before running analysis.**

## Performance

- **Expected Execution Time**: 65-70 seconds for 30 questions
- **Parallel Processing**: Gemini + OpenAI query simultaneously
- **Batch Size**: 25 questions per batch
- **Rate Limiting**: Handled with exponential backoff

## Error Handling

- **JSON Parsing**: Robust brace-counting algorithm
- **API Failures**: Automatic retry with exponential backoff
- **Source Resolution**: Batch redirect resolution with fallback
- **Progress Tracking**: Real-time status updates via SSE

## Troubleshooting

### Backend won't start
- Check API keys are set in `.env`
- Ensure port 3001 is available
- Check Node.js version >= 18

### Frontend won't connect to backend
- Ensure backend is running on port 3001
- Check Vite proxy configuration
- Verify CORS settings

### Analysis fails
- Verify API keys are valid
- Check API quota/rate limits
- Review console logs for errors

### Database errors
- Ensure `database/` directory exists
- Check write permissions
- Delete `reports.db` to reset

## Extending the Application

### Adding New Analysis Types

1. Create aggregator in `backend/src/services/aggregators/`
2. Add question templates in `backend/src/utils/questionTemplates.js`
3. Update prompt builder in `backend/src/services/promptBuilder.js`
4. Create visualization components in `frontend/src/components/`

### Customizing Questions

Edit `backend/src/utils/questionTemplates.js` to change default templates.

### Adding Visualizations

Use Highcharts in `frontend/src/components/charts/` directory.

## Version History

- **v1.0** - Initial localhost implementation
- Based on Google Apps Script V2.17 (Dual LLM support)
- Ported from Google Sheets to standalone app

## Credits

- Original Google Apps Script by GEO Multi-LLM Analysis team
- Ported to Node.js/React standalone application
- Powered by Google Gemini and OpenAI GPT-4

## License

Proprietary - Internal use only

## Support

For issues or questions, please file an issue in the repository.
