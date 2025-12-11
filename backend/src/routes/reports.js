/**
 * Reports API Routes
 */

import express from 'express';
import { Report } from '../models/Report.js';
import { resolveVertexRedirect } from '../services/llmService.js';
import { getBrandLogos, batchFetchLogos } from '../services/logoService.js';

const router = express.Router();

/**
 * GET /api/reports/health
 * Get health status of all ongoing and recent reports
 * Useful for monitoring report processing health
 */
router.get('/health', (req, res) => {
  try {
    const stuckThreshold = parseInt(req.query.stuck_threshold) || 10; // minutes
    const failureWindow = parseInt(req.query.failure_window) || 1; // hours

    // Fetch all health data
    const activeReports = Report.getActiveReports();
    const stuckReports = Report.getStuckReports(stuckThreshold);
    const recentFailures = Report.getRecentFailures(failureWindow);
    const summary = Report.getHealthSummary();

    // Format active reports with computed fields
    const formattedActive = activeReports.map(report => {
      const startedAt = new Date(report.created_at);
      const elapsedSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000);

      // Determine current stage based on progress
      let currentStage = 'querying';
      if (report.progress >= 95) currentStage = 'insights';
      else if (report.progress >= 85) currentStage = 'aggregating';
      else if (report.progress >= 75) currentStage = 'classifying';
      else if (report.progress > 0) currentStage = 'querying';
      else currentStage = 'initializing';

      return {
        id: report.id,
        entity: report.entity,
        category: report.category,
        status: report.status,
        progress: report.progress || 0,
        questions_processed: report.questions_processed || 0,
        total_questions: report.total_questions || 0,
        elapsed_seconds: elapsedSeconds,
        current_stage: currentStage,
        last_activity: report.last_activity,
        started_at: report.created_at,
        markets: report.countries?.length || 1
      };
    });

    // Format stuck reports
    const formattedStuck = stuckReports.map(report => ({
      id: report.id,
      entity: report.entity,
      status: report.status,
      progress: report.progress || 0,
      questions_processed: report.questions_processed || 0,
      total_questions: report.total_questions || 0,
      elapsed_minutes: report.elapsed_minutes,
      last_activity: report.last_activity,
      started_at: report.created_at,
      reason: report.last_activity
        ? 'No activity for extended period'
        : 'Running longer than expected'
    }));

    // Format recent failures
    const formattedFailures = recentFailures.map(report => ({
      id: report.id,
      entity: report.entity,
      error_message: report.error_message,
      failed_at: report.created_at,
      execution_time: report.execution_time
    }));

    // Determine overall health status
    let healthStatus = 'healthy';
    if (summary.stuck > 0 || summary.failed_last_hour > 2) {
      healthStatus = 'degraded';
    }
    if (summary.stuck > 2 || summary.failed_last_hour > 5) {
      healthStatus = 'unhealthy';
    }

    res.json({
      status: healthStatus,
      timestamp: new Date().toISOString(),
      summary,
      active_reports: formattedActive,
      stuck_reports: formattedStuck,
      recent_failures: formattedFailures
    });
  } catch (error) {
    console.error('Error fetching health status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports
 * List all reports
 */
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const reports = Report.findAll(limit, offset);
    const total = Report.count();

    res.json({
      reports,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports/:id
 * Get a single report with all analysis data
 * Returns multi-market data if available
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const report = Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const configuration = Report.getConfiguration(id);
    const llmResponses = Report.getLLMResponses(id);
    const sources = Report.getSourcesWithLogos(id);

    // Check if this is a multi-market report
    const markets = Report.getMarkets(id);
    const isMultiMarket = markets && markets.length > 0;

    if (isMultiMarket) {
      // Return multi-market structured data
      const categoryFamilies = Report.getCategoryFamilies(id);
      const competitors = Report.getMarketCompetitors(id);
      const marketResults = Report.getMarketAnalysisResults(id);

      res.json({
        ...report,
        isMultiMarket: true,
        markets,
        categoryFamilies,
        competitors,
        marketResults,
        configuration,
        llmResponses,
        sources
      });
    } else {
      // Return legacy single-market data
      const analysisResults = Report.getAnalysisResults(id);

      res.json({
        ...report,
        isMultiMarket: false,
        configuration,
        analysisResults,
        llmResponses,
        sources
      });
    }
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports/:id/overview
 * Get aggregated overview data across all categories and markets
 * Query params:
 *   - market: 'master' (all markets) or specific market code
 *   - llms: comma-separated list of LLMs to include (e.g., 'gemini,openai')
 */
router.get('/:id/overview', (req, res) => {
  try {
    const { id } = req.params;
    const { market, llms } = req.query;

    // Parse LLMs filter
    const llmsFilter = llms ? llms.split(',').map(l => l.trim()) : null;

    const overviewData = Report.getOverviewData(id, { market, llms: llmsFilter });
    if (!overviewData) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(overviewData);
  } catch (error) {
    console.error('Error fetching overview data:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/reports/:id
 * Delete a report
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const deleted = Report.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reports/:id/resolve-sources
 * Re-resolve Vertex AI redirect URLs for a report's sources
 */
router.post('/:id/resolve-sources', async (req, res) => {
  try {
    const { id } = req.params;

    const report = Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const sources = Report.getSources(id);
    const vertexSources = sources.filter(s =>
      s.url?.includes('vertexaisearch.cloud.google.com/grounding-api-redirect/')
    );

    if (vertexSources.length === 0) {
      return res.json({
        success: true,
        message: 'No Vertex AI redirect URLs to resolve',
        resolved: 0,
        total: sources.length
      });
    }

    console.log(`📡 Re-resolving ${vertexSources.length} Vertex URLs for report ${id}...`);

    // Resolve each URL
    const results = await Promise.all(
      vertexSources.map(async (source) => {
        const resolvedUrl = await resolveVertexRedirect(source.url, source.title || source.domain);
        return {
          id: source.id,
          originalUrl: source.url,
          resolvedUrl,
          resolved: resolvedUrl !== source.url && !resolvedUrl.includes('vertexaisearch.cloud.google.com')
        };
      })
    );

    // Update sources in database
    const db = (await import('../database/schema.js')).getDatabase();
    const updateStmt = db.prepare('UPDATE sources SET url = ?, resolved_url = ? WHERE id = ?');

    let updatedCount = 0;
    results.forEach(result => {
      if (result.resolved) {
        // Extract new domain from resolved URL
        let newDomain = result.resolvedUrl;
        try {
          newDomain = new URL(result.resolvedUrl).hostname.replace('www.', '');
        } catch {}

        updateStmt.run(result.resolvedUrl, result.resolvedUrl, result.id);
        updatedCount++;
        console.log(`   ✅ ${result.originalUrl.substring(0, 50)}... -> ${result.resolvedUrl.substring(0, 50)}...`);
      } else {
        console.log(`   ⚠️  ${result.originalUrl.substring(0, 50)}... -> Could not resolve`);
      }
    });

    res.json({
      success: true,
      message: `Resolved ${updatedCount} of ${vertexSources.length} Vertex AI redirect URLs`,
      resolved: updatedCount,
      failed: vertexSources.length - updatedCount,
      total: sources.length,
      details: results
    });
  } catch (error) {
    console.error('Error resolving sources:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Share Token Routes
// ==========================================

/**
 * POST /api/reports/:id/share
 * Generate a share token for a report
 */
router.post('/:id/share', (req, res) => {
  try {
    const { id } = req.params;

    const report = Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.status !== 'completed') {
      return res.status(400).json({ error: 'Only completed reports can be shared' });
    }

    // Check if already has a token
    let token = Report.getShareToken(id);
    if (!token) {
      token = Report.generateShareToken(id);
    }

    if (!token) {
      return res.status(500).json({ error: 'Failed to generate share token' });
    }

    res.json({
      success: true,
      share_token: token,
      share_url: `/share/${token}`
    });
  } catch (error) {
    console.error('Error generating share token:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/reports/:id/share
 * Revoke share token for a report
 */
router.delete('/:id/share', (req, res) => {
  try {
    const { id } = req.params;

    const report = Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const revoked = Report.revokeShareToken(id);

    res.json({
      success: revoked,
      message: revoked ? 'Share link revoked' : 'No share link to revoke'
    });
  } catch (error) {
    console.error('Error revoking share token:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports/:id/share
 * Get current share token for a report
 */
router.get('/:id/share', (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Share] Getting share token for report: ${id}`);

    const report = Report.findById(id);
    if (!report) {
      console.log(`[Share] Report not found: ${id}`);
      return res.status(404).json({ error: 'Report not found' });
    }

    console.log(`[Share] Report found, status: ${report.status}`);
    const token = Report.getShareToken(id);
    console.log(`[Share] Token retrieved: ${token ? 'exists' : 'none'}`);

    res.json({
      has_share_link: !!token,
      share_token: token,
      share_url: token ? `/share/${token}` : null
    });
  } catch (error) {
    console.error('[Share] Error getting share token:', error);
    console.error('[Share] Stack trace:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/shared/:token
 * Get a shared report by token (public, read-only)
 */
router.get('/shared/:token', (req, res) => {
  try {
    const { token } = req.params;

    const report = Report.findByShareToken(token);
    if (!report) {
      return res.status(404).json({ error: 'Shared report not found or link expired' });
    }

    if (report.status !== 'completed') {
      return res.status(400).json({ error: 'Report is not available' });
    }

    // Get all report data (same as regular GET but via token)
    const configuration = Report.getConfiguration(report.id);
    const llmResponses = Report.getLLMResponses(report.id);
    const sources = Report.getSourcesWithLogos(report.id);

    const markets = Report.getMarkets(report.id);
    const isMultiMarket = markets && markets.length > 0;

    // Get PR insights for shared view
    const prInsights = Report.getPRInsights(report.id);

    if (isMultiMarket) {
      const categoryFamilies = Report.getCategoryFamilies(report.id);
      const competitors = Report.getMarketCompetitors(report.id);
      const marketResults = Report.getMarketAnalysisResults(report.id);

      res.json({
        ...report,
        id: undefined, // Don't expose internal ID
        share_token: undefined, // Don't expose the token in response
        isMultiMarket: true,
        isSharedView: true,
        markets,
        categoryFamilies,
        competitors,
        marketResults,
        configuration,
        llmResponses,
        sources,
        prInsights
      });
    } else {
      const analysisResults = Report.getAnalysisResults(report.id);

      res.json({
        ...report,
        id: undefined, // Don't expose internal ID
        share_token: undefined, // Don't expose the token in response
        isMultiMarket: false,
        isSharedView: true,
        configuration,
        analysisResults,
        llmResponses,
        sources,
        prInsights
      });
    }
  } catch (error) {
    console.error('Error fetching shared report:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Logo Routes
// ==========================================

/**
 * GET /api/reports/:id/brand-logos
 * Get logos for entity and competitors (for visibility rankings)
 */
router.get('/:id/brand-logos', async (req, res) => {
  try {
    const { id } = req.params;

    const report = Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Get entity and all competitors
    const brands = [report.entity, ...report.competitors];

    // Generate logo URLs for all brands
    const brandLogos = getBrandLogos(brands);

    // Also try to fetch and cache logos for any new domains
    if (process.env.LOGO_API_KEY) {
      const domains = Object.values(brandLogos)
        .map(b => {
          if (b.icon_url) {
            // Extract domain from the icon_url
            const match = b.icon_url.match(/cdn\.brandfetch\.io\/([^\/]+)/);
            return match ? match[1] : null;
          }
          return null;
        })
        .filter(Boolean);

      if (domains.length > 0) {
        try {
          await batchFetchLogos(domains);
        } catch (e) {
          console.warn('Brand logo caching failed:', e.message);
        }
      }
    }

    res.json({
      entity: report.entity,
      competitors: report.competitors,
      logos: brandLogos
    });
  } catch (error) {
    console.error('Error fetching brand logos:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
