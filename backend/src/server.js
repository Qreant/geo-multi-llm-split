/**
 * GEO Multi-LLM Analysis - Express Server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './database/schema.js';
import { migrateDatabase } from './database/migrate.js';
import reportsRouter from './routes/reports.js';
import analysisRouter from './routes/analysis.js';
import insightsRouter from './routes/insights.js';
import { checkAndResumeInterruptedReports } from './services/resumeService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration for split deployment
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize database
initDatabase();
migrateDatabase();

// Routes
app.use('/api/reports', reportsRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/insights', insightsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 GEO Multi-LLM Analysis Server running on http://localhost:${PORT}`);
  console.log(`📊 Database initialized`);
  console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);
  console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Missing'}`);
  console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Missing'}\n`);

  // Check for and resume any interrupted analyses
  if (process.env.GEMINI_API_KEY) {
    try {
      await checkAndResumeInterruptedReports(
        process.env.GEMINI_API_KEY,
        process.env.OPENAI_API_KEY
      );
    } catch (error) {
      console.error('Error checking for interrupted reports:', error.message);
    }
  }
});

export default app;
