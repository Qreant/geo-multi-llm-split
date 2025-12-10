/**
 * Reports API Routes
 */

import express from 'express';
import { Report } from '../models/Report.js';
import { resolveVertexRedirect } from '../services/llmService.js';

const router = express.Router();

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
    const sources = Report.getSources(id);

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
 */
router.get('/:id/overview', (req, res) => {
  try {
    const { id } = req.params;

    const overviewData = Report.getOverviewData(id);
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

export default router;
