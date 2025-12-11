import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Railway volume path if available, otherwise local path
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../database/reports.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('Created database directory:', dbDir);
}

export function initDatabase() {
  const db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Reports table - main metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      category TEXT NOT NULL,
      competitors TEXT,
      countries TEXT,
      languages TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'processing',
      progress INTEGER DEFAULT 0,
      total_questions INTEGER DEFAULT 0,
      execution_time INTEGER,
      error_message TEXT,
      share_token TEXT UNIQUE
    )
  `);

  // Note: share_token migration is handled in migrate.js for existing databases

  // Report configuration - stores the questions used
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      analysis_type TEXT NOT NULL,
      questions TEXT NOT NULL,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `);

  // Analysis results - stores aggregated analysis
  db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      analysis_type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `);

  // LLM responses - stores raw responses from both LLMs
  db.exec(`
    CREATE TABLE IF NOT EXISTS llm_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      analysis_type TEXT NOT NULL,
      gemini_response TEXT,
      openai_response TEXT,
      gemini_sources TEXT,
      openai_sources TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `);

  // Sources table - stores deduplicated sources with classifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      url TEXT NOT NULL,
      resolved_url TEXT,
      title TEXT,
      domain TEXT,
      source_type TEXT,
      ownership TEXT DEFAULT 'third-party',
      competitor_name TEXT,
      youtube_channel TEXT,
      classification_confidence REAL,
      classification_reasoning TEXT,
      cited_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `);

  // PR Insights opportunities table - stores prioritized improvement opportunities
  db.exec(`
    CREATE TABLE IF NOT EXISTS pr_insights_opportunities (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      opportunity_type TEXT NOT NULL,
      theme_category TEXT NOT NULL,
      current_state TEXT,
      competitor_analysis TEXT,
      impact_score REAL,
      impact_label TEXT,
      effort_score REAL,
      effort_label TEXT,
      priority_tier TEXT,
      priority_urgency INTEGER,
      priority_timeline TEXT,
      priority_color TEXT,
      recommended_actions TEXT,
      ai_collaboration_recommendations TEXT,
      evidence TEXT,
      sources TEXT,
      metadata TEXT,
      expected_visibility_increase REAL,
      expected_authority_boost REAL,
      expected_sentiment_improvement REAL,
      is_implemented INTEGER DEFAULT 0,
      implemented_at DATETIME,
      implementation_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `);

  // Opportunity execution history - tracks actions taken on opportunities
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunity_execution_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_description TEXT,
      outcome TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (opportunity_id) REFERENCES pr_insights_opportunities(id) ON DELETE CASCADE,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `);

  // ==========================================
  // Multi-Market, Multi-Category Tables (V2.19)
  // ==========================================

  // Markets table - stores country/language combinations for a report
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_markets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      country TEXT NOT NULL,
      language TEXT NOT NULL,
      market_code TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      UNIQUE(report_id, market_code)
    )
  `);

  // Category families - unified category concepts across languages
  db.exec(`
    CREATE TABLE IF NOT EXISTS category_families (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      canonical_name TEXT NOT NULL,
      source TEXT DEFAULT 'detected',
      is_selected INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    )
  `);

  // Category translations - localized names per market
  db.exec(`
    CREATE TABLE IF NOT EXISTS category_translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_family_id TEXT NOT NULL,
      market_code TEXT NOT NULL,
      translated_name TEXT NOT NULL,
      was_detected INTEGER DEFAULT 0,
      detection_confidence REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_family_id) REFERENCES category_families(id) ON DELETE CASCADE,
      UNIQUE(category_family_id, market_code)
    )
  `);

  // Market-specific competitors per category
  db.exec(`
    CREATE TABLE IF NOT EXISTS category_market_competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      category_family_id TEXT NOT NULL,
      market_code TEXT NOT NULL,
      competitors TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY (category_family_id) REFERENCES category_families(id) ON DELETE CASCADE,
      UNIQUE(report_id, category_family_id, market_code)
    )
  `);

  // Analysis results per market (extends existing analysis_results)
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_analysis_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      market_code TEXT NOT NULL,
      category_family_id TEXT,
      analysis_type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY (category_family_id) REFERENCES category_families(id) ON DELETE CASCADE
    )
  `);

  // ==========================================
  // Domain Logos Cache Table
  // ==========================================

  // Domain logos cache - shared across all reports for efficiency
  db.exec(`
    CREATE TABLE IF NOT EXISTS domain_logos (
      domain TEXT PRIMARY KEY,
      logo_url TEXT,
      icon_url TEXT,
      fetch_status TEXT DEFAULT 'pending',
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_domain_logos_status ON domain_logos(fetch_status);
    CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_entity ON reports(entity);
    CREATE INDEX IF NOT EXISTS idx_analysis_results_report ON analysis_results(report_id, analysis_type);
    CREATE INDEX IF NOT EXISTS idx_llm_responses_report ON llm_responses(report_id);
    CREATE INDEX IF NOT EXISTS idx_sources_report ON sources(report_id);
    CREATE INDEX IF NOT EXISTS idx_pr_insights_report ON pr_insights_opportunities(report_id);
    CREATE INDEX IF NOT EXISTS idx_pr_insights_priority ON pr_insights_opportunities(priority_tier);
    CREATE INDEX IF NOT EXISTS idx_execution_history_opportunity ON opportunity_execution_history(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_execution_history_report ON opportunity_execution_history(report_id);
    CREATE INDEX IF NOT EXISTS idx_report_markets_report ON report_markets(report_id);
    CREATE INDEX IF NOT EXISTS idx_category_families_report ON category_families(report_id);
    CREATE INDEX IF NOT EXISTS idx_category_translations_family ON category_translations(category_family_id);
    CREATE INDEX IF NOT EXISTS idx_category_market_competitors_report ON category_market_competitors(report_id);
    CREATE INDEX IF NOT EXISTS idx_market_analysis_results_report ON market_analysis_results(report_id, market_code);
  `);

  console.log('Database initialized successfully at:', dbPath);
  return db;
}

export function getDatabase() {
  return new Database(dbPath);
}
