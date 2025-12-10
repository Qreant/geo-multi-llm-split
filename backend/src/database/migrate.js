/**
 * Database Migration Script
 * Handles schema migrations for existing databases
 */

import { getDatabase } from './schema.js';

export function migrateDatabase() {
  const db = getDatabase();

  try {
    let migrationsMade = false;

    // Migration 1: Add category column to analysis_results
    const analysisTableInfo = db.prepare('PRAGMA table_info(analysis_results)').all();
    const hasCategoryColumn = analysisTableInfo.some(col => col.name === 'category');

    if (!hasCategoryColumn) {
      console.log('📦 Running migration: Adding category column to analysis_results');
      db.exec('ALTER TABLE analysis_results ADD COLUMN category TEXT');
      db.exec('CREATE INDEX IF NOT EXISTS idx_analysis_category ON analysis_results(report_id, category, analysis_type)');
      console.log('✅ Added category column');
      migrationsMade = true;
    }

    // Migration 2: Add ownership columns to sources table
    const sourcesTableInfo = db.prepare('PRAGMA table_info(sources)').all();
    const hasOwnership = sourcesTableInfo.some(col => col.name === 'ownership');
    const hasCompetitorName = sourcesTableInfo.some(col => col.name === 'competitor_name');

    if (!hasOwnership) {
      console.log('📦 Running migration: Adding ownership column to sources');
      db.exec("ALTER TABLE sources ADD COLUMN ownership TEXT DEFAULT 'third-party'");
      console.log('✅ Added ownership column');
      migrationsMade = true;
    }

    if (!hasCompetitorName) {
      console.log('📦 Running migration: Adding competitor_name column to sources');
      db.exec('ALTER TABLE sources ADD COLUMN competitor_name TEXT');
      console.log('✅ Added competitor_name column');
      migrationsMade = true;
    }

    // Migration 3: Add youtube_channel column to sources table
    const hasYouTubeChannel = sourcesTableInfo.some(col => col.name === 'youtube_channel');

    if (!hasYouTubeChannel) {
      console.log('📦 Running migration: Adding youtube_channel column to sources');
      db.exec('ALTER TABLE sources ADD COLUMN youtube_channel TEXT');
      console.log('✅ Added youtube_channel column');
      migrationsMade = true;
    }

    // Migration 4: Add share_token column to reports table
    const reportsTableInfo = db.prepare('PRAGMA table_info(reports)').all();
    console.log('📋 Reports table columns:', reportsTableInfo.map(c => c.name).join(', '));
    const hasShareToken = reportsTableInfo.some(col => col.name === 'share_token');

    if (!hasShareToken) {
      console.log('📦 Running migration: Adding share_token column to reports');
      db.exec('ALTER TABLE reports ADD COLUMN share_token TEXT');
      // Create index separately (UNIQUE constraint via index)
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_share_token ON reports(share_token)');
      console.log('✅ Added share_token column');
      migrationsMade = true;
    } else {
      console.log('✓ share_token column already exists');
    }

    if (!migrationsMade) {
      console.log('✓ Database schema is up to date');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}
