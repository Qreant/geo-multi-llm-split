/**
 * Data Loader
 * Extract and manage source data for benchmark testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract sources from the SQLite database
 * @param {string} dbPath - Path to the SQLite database
 * @param {number} limit - Maximum number of sources to extract
 * @param {string} reportId - Optional specific report ID to extract from
 * @returns {Array} Array of source objects
 */
export function extractSourcesFromDB(dbPath, limit = 500, reportId = null) {
  const db = new Database(dbPath, { readonly: true });

  try {
    let query = `
      SELECT
        url,
        title,
        domain,
        source_type,
        classification_confidence,
        classification_reasoning,
        competitor_name,
        youtube_channel,
        cited_by
      FROM sources
    `;

    const params = [];

    if (reportId) {
      query += ' WHERE report_id = ?';
      params.push(reportId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const sources = db.prepare(query).all(...params);

    console.log(`Extracted ${sources.length} sources from database`);
    return sources.map(s => ({
      url: s.url,
      title: s.title || '',
      domain: s.domain || '',
      existing_type: s.source_type,
      existing_confidence: s.classification_confidence,
      existing_reasoning: s.classification_reasoning,
      competitor_name: s.competitor_name,
      youtube_channel: s.youtube_channel,
      cited_by: s.cited_by ? JSON.parse(s.cited_by) : []
    }));
  } finally {
    db.close();
  }
}

/**
 * Get the most recent report ID from the database
 * @param {string} dbPath - Path to the SQLite database
 * @returns {string|null} Report ID or null if no reports exist
 */
export function getMostRecentReportId(dbPath) {
  const db = new Database(dbPath, { readonly: true });

  try {
    const result = db.prepare(`
      SELECT id, entity, created_at
      FROM reports
      ORDER BY created_at DESC
      LIMIT 1
    `).get();

    if (result) {
      console.log(`Most recent report: ${result.entity} (${result.id}) - ${result.created_at}`);
      return result.id;
    }
    return null;
  } finally {
    db.close();
  }
}

/**
 * Get reports with sufficient source counts
 * @param {string} dbPath - Path to the SQLite database
 * @param {number} minSources - Minimum number of sources required
 * @returns {Array} Array of report objects with source counts
 */
export function getReportsWithSources(dbPath, minSources = 100) {
  const db = new Database(dbPath, { readonly: true });

  try {
    const reports = db.prepare(`
      SELECT
        r.id,
        r.entity,
        r.created_at,
        COUNT(s.id) as source_count
      FROM reports r
      LEFT JOIN sources s ON r.id = s.report_id
      GROUP BY r.id
      HAVING source_count >= ?
      ORDER BY r.created_at DESC
    `).all(minSources);

    console.log(`Found ${reports.length} reports with >= ${minSources} sources`);
    return reports;
  } finally {
    db.close();
  }
}

/**
 * Load test sources from a JSON file
 * @param {string} filepath - Path to the JSON file
 * @returns {Array} Array of source objects
 */
export function loadTestSources(filepath) {
  const fullPath = path.resolve(__dirname, '..', filepath);

  if (!fs.existsSync(fullPath)) {
    console.log(`Test sources file not found: ${fullPath}`);
    return null;
  }

  const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  console.log(`Loaded ${data.sources?.length || 0} sources from ${filepath}`);
  return data;
}

/**
 * Save test sources to a JSON file for reproducibility
 * @param {Array} sources - Array of source objects
 * @param {string} filepath - Path to save the JSON file
 * @param {Object} metadata - Optional metadata about the sources
 */
export function saveTestSources(sources, filepath, metadata = {}) {
  const fullPath = path.resolve(__dirname, '..', filepath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data = {
    metadata: {
      extractedAt: new Date().toISOString(),
      count: sources.length,
      ...metadata
    },
    sources
  };

  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
  console.log(`Saved ${sources.length} sources to ${filepath}`);
}

/**
 * Load golden set from JSON file
 * @param {string} filepath - Path to the golden set JSON file
 * @returns {Array} Array of golden set source objects with verified classifications
 */
export function loadGoldenSet(filepath = 'data/golden-set.json') {
  const fullPath = path.resolve(__dirname, '..', filepath);

  if (!fs.existsSync(fullPath)) {
    console.log(`Golden set file not found: ${fullPath}`);
    return null;
  }

  const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  console.log(`Loaded golden set with ${data.sources?.length || 0} verified classifications`);
  return data.sources || data;
}

/**
 * Prepare source batches for testing
 * @param {Array} sources - Array of source objects
 * @param {number} batchSize - Number of sources per batch
 * @returns {Array} Array of batches
 */
export function prepareBatches(sources, batchSize) {
  const batches = [];

  for (let i = 0; i < sources.length; i += batchSize) {
    batches.push(sources.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Get sources for benchmark testing
 * First tries to load from cached file, then extracts from DB
 * @param {string} dbPath - Path to the SQLite database
 * @param {Object} options - Options
 * @returns {Array} Array of source objects
 */
export async function getTestSources(dbPath, options = {}) {
  const {
    cacheFile = 'data/test-sources.json',
    forceRefresh = false,
    limit = 500,
    reportId = null
  } = options;

  // Try loading from cache first
  if (!forceRefresh) {
    const cached = loadTestSources(cacheFile);
    if (cached && cached.sources && cached.sources.length >= limit) {
      return cached.sources.slice(0, limit);
    }
  }

  // Extract from database
  const finalReportId = reportId || getMostRecentReportId(dbPath);

  if (!finalReportId) {
    throw new Error('No reports found in database. Run an analysis first to generate test data.');
  }

  const sources = extractSourcesFromDB(dbPath, limit, finalReportId);

  if (sources.length < limit) {
    console.warn(`Warning: Only found ${sources.length} sources (requested ${limit})`);
  }

  // Cache for future runs
  saveTestSources(sources, cacheFile, {
    reportId: finalReportId,
    requestedLimit: limit
  });

  return sources;
}

/**
 * Extract domain info from URL (matches sourceClassifier.js logic)
 * @param {string} url - Full URL
 * @returns {Object} Domain info
 */
export function extractDomainInfo(url) {
  if (!url) return { domain: '', isYouTube: false, channelName: null };

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');
    const isYouTube = hostname.includes('youtube.com') || hostname.includes('youtu.be');

    let channelName = null;
    if (isYouTube) {
      const pathname = urlObj.pathname;
      const handleMatch = pathname.match(/^\/@([^\/]+)/);
      if (handleMatch) {
        channelName = `@${handleMatch[1]}`;
      }
    }

    return {
      domain: channelName ? `youtube.com/${channelName}` : hostname,
      isYouTube,
      channelName
    };
  } catch (e) {
    return { domain: url, isYouTube: false, channelName: null };
  }
}
