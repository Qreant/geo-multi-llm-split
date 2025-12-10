# GEO Multi-LLM Analysis - Setup Guide

This guide will walk you through setting up and running the GEO Multi-LLM Brand Analysis application on your local machine.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js version 18 or higher installed
- [ ] npm or yarn package manager
- [ ] A Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- [ ] An OpenAI API key with GPT-4 access from [OpenAI Platform](https://platform.openai.com/api-keys)
- [ ] A terminal/command prompt
- [ ] A code editor (optional, but recommended)

## Step 1: Verify Node.js Installation

Open your terminal and run:

```bash
node --version
```

You should see v18.0.0 or higher. If not, download and install Node.js from [nodejs.org](https://nodejs.org).

## Step 2: Navigate to Project Directory

```bash
cd "/Users/quentinreant/Desktop/GEO module"
```

## Step 3: Install Dependencies

### Install Root Dependencies

```bash
npm install
```

This installs `concurrently` which allows running both backend and frontend simultaneously.

### Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

This installs:
- Express (web server)
- SQLite (database)
- Axios (HTTP client)
- Other backend dependencies

### Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

This installs:
- React (UI framework)
- Vite (build tool)
- Tailwind CSS (styling)
- Highcharts (visualizations)
- Other frontend dependencies

## Step 4: Configure API Keys

### Create Environment File

```bash
cp backend/.env.example backend/.env
```

### Edit Environment File

Open `backend/.env` in a text editor and add your API keys:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# API Keys - REQUIRED
GEMINI_API_KEY=your_actual_gemini_api_key_here
OPENAI_API_KEY=your_actual_openai_api_key_here

# Database
DATABASE_PATH=../database/reports.db

# LLM Configuration
GEMINI_MODEL=gemini-2.0-flash-exp
OPENAI_MODEL=gpt-4o-2024-11-20
TEMPERATURE=0.1
MAX_OUTPUT_TOKENS=56000
BATCH_SIZE=25
```

**Important:** Replace `your_actual_gemini_api_key_here` and `your_actual_openai_api_key_here` with your real API keys.

### Getting API Keys

**Gemini API Key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API Key"
3. Create a new API key or use an existing one
4. Copy the key

**OpenAI API Key:**
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Name your key and copy it immediately (you won't see it again)

## Step 5: Create Database Directory

```bash
mkdir -p database
```

The database file will be automatically created on first run.

## Step 6: Start the Application

### Development Mode (Recommended)

From the project root directory:

```bash
npm run dev
```

This starts both backend and frontend simultaneously:
- **Backend API**: http://localhost:3001
- **Frontend**: http://localhost:5173

You should see output like:
```
[backend] 🚀 GEO Multi-LLM Analysis Server running on http://localhost:3001
[backend] 📊 Database initialized
[backend] 🔑 Gemini API Key: ✓ Set
[backend] 🔑 OpenAI API Key: ✓ Set
[frontend] VITE v5.0.8 ready in 523 ms
[frontend] ➜ Local: http://localhost:5173/
```

### Alternative: Run Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Step 7: Access the Application

Open your web browser and navigate to:

```
http://localhost:5173
```

You should see the GEO Multi-LLM Analysis homepage.

## Step 8: Create Your First Report

1. Click "New Report" in the top-right corner
2. Fill in the form:
   - **Entity**: Your brand name (e.g., "FXTM")
   - **Category**: Product/service category (e.g., "online forex trading")
   - **Competitors**: Comma-separated list (e.g., "IG, Pepperstone, FOREX.com")
3. Click "Preview & Edit Questions"
4. Review the generated questions (optionally edit them)
5. Click "Start Analysis"
6. Watch real-time progress (takes ~65-70 seconds)
7. View results when complete!

## Troubleshooting

### Error: "API keys not configured"

**Solution:** Make sure you:
1. Created `backend/.env` file
2. Added valid API keys
3. Restarted the backend server

### Error: "Port 3001 already in use"

**Solution:** Either:
- Kill the process using port 3001: `lsof -ti:3001 | xargs kill -9`
- Change the port in `backend/.env`: `PORT=3002`

### Error: "Cannot find module"

**Solution:**
1. Delete `node_modules` folders
2. Run `npm install` again in root, backend, and frontend

### Frontend shows blank page

**Solution:**
1. Check browser console for errors (F12)
2. Ensure backend is running on port 3001
3. Check Vite proxy configuration in `frontend/vite.config.js`

### Database errors

**Solution:**
1. Delete `database/reports.db`
2. Restart the backend (database will be recreated)

### API rate limits

If you're hitting API limits:
1. Reduce `BATCH_SIZE` in `.env`
2. Add delays between requests (requires code modification)
3. Check your API quota in Google AI Studio / OpenAI Platform

## Testing the Installation

### Test Backend Health

```bash
curl http://localhost:3001/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2025-12-03T...",
  "env": "development"
}
```

### Test Database

```bash
curl http://localhost:3001/api/reports
```

Should return:
```json
{
  "reports": [],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

## Next Steps

### Customize Question Templates

Edit `backend/src/utils/questionTemplates.js` to change default questions.

### Add More Visualizations

Create new chart components in `frontend/src/components/` using Highcharts.

### Export Data

Reports are stored in `database/reports.db` (SQLite format). Use any SQLite client to query/export data.

### Production Deployment

For production use:

1. Build frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Serve static files from Express:
   ```javascript
   // Add to backend/src/server.js
   app.use(express.static(path.join(__dirname, '../../frontend/dist')));
   ```

3. Set `NODE_ENV=production` in `.env`

4. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start backend/src/server.js --name geo-api
   ```

## Getting Help

If you encounter issues not covered here:

1. Check the main README.md for additional information
2. Review console logs in both terminal and browser
3. Verify all dependencies are installed correctly
4. Ensure API keys are valid and have sufficient quota

## System Requirements

- **RAM**: Minimum 2GB, Recommended 4GB+
- **Disk Space**: 500MB for application + database
- **Internet**: Required for API calls to Gemini and OpenAI
- **Browser**: Modern browser (Chrome, Firefox, Safari, Edge)

## Security Notes

- **Never commit your `.env` file** - it contains sensitive API keys
- **Keep your API keys secret** - don't share them publicly
- **Monitor API usage** - check your usage dashboards regularly
- **This is a localhost app** - not designed for public internet deployment without additional security measures

---

**Congratulations!** You're now ready to use the GEO Multi-LLM Brand Analysis application.

For more information, see README.md and CLAUDE.md.
