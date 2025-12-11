/**
 * PR Insights API Routes
 * Handles opportunities, implementation tracking, and execution history
 */

import express from 'express';
import { Report } from '../models/Report.js';

const router = express.Router();

/**
 * Check if an entity name matches the target brand (including product variations)
 * e.g., "Nike Pegasus" matches target "Nike"
 */
function isSameBrandFamily(entityName, targetBrand) {
  if (!entityName || !targetBrand) return false;

  const entity = entityName.toLowerCase().trim();
  const target = targetBrand.toLowerCase().trim();

  // Exact match
  if (entity === target) return true;

  // One contains the other (handles "Nike" matching "Nike Pegasus", "Nike Air Max", etc.)
  if (entity.includes(target)) return true;
  if (target.includes(entity)) return true;

  return false;
}

/**
 * Generate priority source targets from sources and opportunities
 */
function generatePrioritySourceTargets(allSources, opportunities, config) {
  const domainMap = new Map();
  const urlMap = new Map();
  const targetEntity = config?.entity || '';

  // Helper to extract domain from URL
  const extractDomain = (url) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  // Step 1: Initialize with ALL sources
  (allSources || []).forEach(source => {
    const url = source.url || '';
    let domain = source.domain || extractDomain(url);
    const sourceType = source.source_type || source.sourceType || 'Unknown';
    const title = source.title || '';
    const citedBy = source.cited_by || [];

    // Skip redirect URLs - they're not real domains
    if (domain === 'vertexaisearch.cloud.google.com') {
      domain = '';
    }

    if (!url && !domain) return;

    if (domain) {
      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          domain,
          source_type: sourceType,
          citation_count: 0,
          cited_by_llms: new Set(),
          urls: new Set(),
          opportunity_count: 0,
          opportunity_ids: [],
          opportunity_types: new Set(),
          priority_tiers: new Set(),
          visibility_gap_count: 0,
          competitive_loss_count: 0,
          total_impact_score: 0,
          is_high_authority: ['Journalism', 'Academic/Research', 'Government/NGO'].includes(sourceType),
          competitor_mentions: []
        });
      }
      const domainData = domainMap.get(domain);
      domainData.citation_count++;
      if (url) domainData.urls.add(url);
      citedBy.forEach(llm => domainData.cited_by_llms.add(llm));
    }

    if (url) {
      if (!urlMap.has(url)) {
        urlMap.set(url, {
          url,
          domain,
          title,
          source_type: sourceType,
          citation_count: 0,
          cited_by_llms: new Set(),
          opportunity_count: 0,
          opportunity_ids: [],
          opportunity_types: new Set(),
          priority_tiers: new Set(),
          visibility_gap_count: 0,
          competitive_loss_count: 0,
          total_impact_score: 0,
          is_high_authority: ['Journalism', 'Academic/Research', 'Government/NGO'].includes(sourceType),
          competitor_mentions: []
        });
      }
      const urlData = urlMap.get(url);
      urlData.citation_count++;
      citedBy.forEach(llm => urlData.cited_by_llms.add(llm));
    }
  });

  // Build a URL to domain lookup from allSources for matching
  const urlToDomain = new Map();
  (allSources || []).forEach(source => {
    if (source.url && source.domain) {
      urlToDomain.set(source.url, source.domain);
    }
  });

  // Step 2: Cross-reference with opportunities
  opportunities.forEach(opp => {
    const sources = opp.sources || [];
    const oppType = opp.opportunity_type;
    const oppId = opp.id;
    const priority = opp.priority?.tier || 'Low Priority';
    const impactScore = opp.scores?.impact_score || 0;
    const isVisibilityGap = oppType === 'AI Visibility Gap';
    const isCompetitiveLoss = oppType === 'Competitive Positioning Gap';

    sources.forEach(source => {
      const url = source.url || '';
      // Look up the real domain from allSources by URL, or fall back to extraction
      let domain = source.domain || urlToDomain.get(url) || extractDomain(url);

      // Skip if it's the redirect URL domain
      if (domain === 'vertexaisearch.cloud.google.com') {
        domain = '';
      }

      if (domain && domainMap.has(domain)) {
        const domainData = domainMap.get(domain);
        domainData.opportunity_count++;
        domainData.opportunity_ids.push(oppId);
        domainData.opportunity_types.add(oppType);
        domainData.priority_tiers.add(priority);
        domainData.total_impact_score += impactScore;
        if (isVisibilityGap) domainData.visibility_gap_count++;
        if (isCompetitiveLoss) domainData.competitive_loss_count++;
        // Only track competitors that aren't the same brand family
        const topRankedEntity = opp.competitor_analysis?.top_ranked_entity;
        if (topRankedEntity && !isSameBrandFamily(topRankedEntity, targetEntity)) {
          domainData.competitor_mentions.push(topRankedEntity);
        }
      }

      if (url && urlMap.has(url)) {
        const urlData = urlMap.get(url);
        urlData.opportunity_count++;
        urlData.opportunity_ids.push(oppId);
        urlData.opportunity_types.add(oppType);
        urlData.priority_tiers.add(priority);
        urlData.total_impact_score += impactScore;
        if (isVisibilityGap) urlData.visibility_gap_count++;
        if (isCompetitiveLoss) urlData.competitive_loss_count++;
        // Only track competitors that aren't the same brand family
        const topRankedEntity = opp.competitor_analysis?.top_ranked_entity;
        if (topRankedEntity && !isSameBrandFamily(topRankedEntity, targetEntity)) {
          urlData.competitor_mentions.push(topRankedEntity);
        }
      }
    });
  });

  // Step 3: Calculate priority scores
  const maxCitations = Math.max(...Array.from(domainMap.values()).map(d => d.citation_count), 1);

  const getTopCompetitor = (mentions) => {
    if (!mentions?.length) return null;
    // Filter out same-brand entities before counting
    const filteredMentions = mentions.filter(m => !isSameBrandFamily(m, targetEntity));
    if (!filteredMentions.length) return null;
    const counts = {};
    filteredMentions.forEach(m => counts[m] = (counts[m] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  };

  const calculatePriorityScore = (data) => {
    let score = 0;
    score += (data.citation_count / maxCitations) * 30;
    score += Math.min(data.visibility_gap_count * 12.5, 25);
    score += Math.min(data.competitive_loss_count * 12.5, 25);
    if (data.is_high_authority) score += 10;
    if (data.priority_tiers.has('Critical')) score += 10;
    else if (data.priority_tiers.has('Strategic')) score += 5;
    return Math.min(Math.round(score), 100);
  };

  const domainTargets = Array.from(domainMap.values()).map(d => ({
    ...d,
    cited_by_llms: Array.from(d.cited_by_llms),
    opportunity_types: Array.from(d.opportunity_types),
    priority_tiers: Array.from(d.priority_tiers),
    urls: Array.from(d.urls),
    url_count: d.urls.size,
    priority_score: calculatePriorityScore(d),
    top_competitor: getTopCompetitor(d.competitor_mentions),
    brand_problem_count: d.visibility_gap_count + d.competitive_loss_count
  })).sort((a, b) => b.priority_score - a.priority_score);

  const urlTargets = Array.from(urlMap.values()).map(u => ({
    ...u,
    cited_by_llms: Array.from(u.cited_by_llms),
    opportunity_types: Array.from(u.opportunity_types),
    priority_tiers: Array.from(u.priority_tiers),
    priority_score: calculatePriorityScore(u),
    top_competitor: getTopCompetitor(u.competitor_mentions),
    brand_problem_count: u.visibility_gap_count + u.competitive_loss_count
  })).sort((a, b) => b.priority_score - a.priority_score);

  const criticalDomains = domainTargets.filter(d => d.priority_score >= 70);
  const highPriorityDomains = domainTargets.filter(d => d.priority_score >= 50 && d.priority_score < 70);
  const mediumPriorityDomains = domainTargets.filter(d => d.priority_score >= 30 && d.priority_score < 50);
  const highAuthorityTargets = domainTargets.filter(d => d.is_high_authority).sort((a, b) => b.priority_score - a.priority_score);

  return {
    summary: {
      total_domains: domainTargets.length,
      total_urls: urlTargets.length,
      total_citations: allSources?.length || 0,
      critical_targets: criticalDomains.length,
      high_priority_targets: highPriorityDomains.length,
      high_authority_targets: highAuthorityTargets.length,
      visibility_gap_domains: domainTargets.filter(d => d.visibility_gap_count > 0).length,
      competitive_loss_domains: domainTargets.filter(d => d.competitive_loss_count > 0).length
    },
    domain_targets: {
      critical: criticalDomains.slice(0, 10),
      high_priority: highPriorityDomains.slice(0, 10),
      medium_priority: mediumPriorityDomains.slice(0, 10)
    },
    url_targets: {
      top_priority: urlTargets.filter(u => u.citation_count >= 2 || u.priority_score >= 50).slice(0, 20)
    },
    high_authority_targets: highAuthorityTargets.slice(0, 15)
  };
}

/**
 * GET /api/insights/:reportId
 * Get all PR insights for a report
 * Query params:
 *   - market: 'master' (all markets) or specific market code
 *   - llms: comma-separated list of LLMs to include (e.g., 'gemini,openai')
 */
router.get('/:reportId', (req, res) => {
  try {
    const { reportId } = req.params;
    const { market, llms } = req.query;

    const report = Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Parse LLMs filter
    const llmsFilter = llms ? llms.split(',').map(l => l.trim().toLowerCase()) : null;

    let insights = Report.getPRInsights(reportId);
    const history = Report.getExecutionHistory(reportId);

    // Filter opportunities by LLM if specified
    if (llmsFilter && llmsFilter.length > 0 && insights.opportunities) {
      insights = {
        ...insights,
        opportunities: insights.opportunities.filter(opp => {
          // Keep opportunity if any of its sources were cited by selected LLMs
          if (!opp.sources || opp.sources.length === 0) return true;
          return opp.sources.some(source => {
            const citedBy = source.cited_by || [];
            return citedBy.some(llm => llmsFilter.includes(llm.toLowerCase()));
          });
        })
      };

      // Recalculate totals
      insights.total_opportunities = insights.opportunities.length;
      insights.priority_summary = {
        critical: insights.opportunities.filter(o => o.priority?.tier === 'Critical').length,
        strategic: insights.opportunities.filter(o => o.priority?.tier === 'Strategic').length,
        quick_wins: insights.opportunities.filter(o => o.priority?.tier === 'Quick Wins').length,
        low_priority: insights.opportunities.filter(o => o.priority?.tier === 'Low Priority').length
      };
    }

    // Generate priority source targets from stored sources and opportunities
    let allSources = Report.getSources(reportId);

    // Filter sources by LLM if specified
    if (llmsFilter && llmsFilter.length > 0) {
      allSources = allSources.filter(source => {
        const citedBy = source.cited_by || [];
        if (citedBy.length === 0) return true; // Keep sources without LLM info
        return citedBy.some(llm => llmsFilter.includes(llm.toLowerCase()));
      });
    }

    const prioritySourceTargets = generatePrioritySourceTargets(
      allSources,
      insights.opportunities || [],
      { entity: report.entity }
    );
    insights.priority_source_targets = prioritySourceTargets;

    res.json({
      reportId,
      entity: report.entity,
      insights,
      executionHistory: history
    });
  } catch (error) {
    console.error('Error fetching PR insights:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insights/:reportId/opportunities
 * Get all opportunities with optional filtering
 */
router.get('/:reportId/opportunities', (req, res) => {
  try {
    const { reportId } = req.params;
    const { priority_tier, theme_category, is_implemented } = req.query;

    const report = Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    let opportunities = Report.getOpportunities(reportId);

    // Apply filters
    if (priority_tier) {
      opportunities = opportunities.filter(o => o.priority_tier === priority_tier);
    }
    if (theme_category) {
      opportunities = opportunities.filter(o => o.theme_category === theme_category);
    }
    if (is_implemented !== undefined) {
      const implemented = is_implemented === 'true' || is_implemented === '1';
      opportunities = opportunities.filter(o => o.is_implemented === (implemented ? 1 : 0));
    }

    res.json({
      reportId,
      total: opportunities.length,
      opportunities
    });
  } catch (error) {
    console.error('Error fetching opportunities:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insights/:reportId/opportunities/:opportunityId
 * Get a single opportunity
 */
router.get('/:reportId/opportunities/:opportunityId', (req, res) => {
  try {
    const { reportId, opportunityId } = req.params;

    const opportunity = Report.getOpportunityById(reportId, opportunityId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const actions = Report.getOpportunityActions(opportunityId);

    res.json({
      ...opportunity,
      actions
    });
  } catch (error) {
    console.error('Error fetching opportunity:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/insights/:reportId/opportunities/:opportunityId/implement
 * Mark an opportunity as implemented
 */
router.post('/:reportId/opportunities/:opportunityId/implement', (req, res) => {
  try {
    const { reportId, opportunityId } = req.params;
    const { notes } = req.body;

    const opportunity = Report.getOpportunityById(reportId, opportunityId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const success = Report.markOpportunityImplemented(opportunityId, notes);

    if (success) {
      // Log the implementation action
      Report.logOpportunityAction(opportunityId, reportId, 'implemented', 'Marked as implemented', 'completed', notes);

      res.json({
        success: true,
        message: 'Opportunity marked as implemented'
      });
    } else {
      res.status(500).json({ error: 'Failed to update opportunity' });
    }
  } catch (error) {
    console.error('Error implementing opportunity:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/insights/:reportId/opportunities/:opportunityId/action
 * Log an action taken on an opportunity
 */
router.post('/:reportId/opportunities/:opportunityId/action', (req, res) => {
  try {
    const { reportId, opportunityId } = req.params;
    const { action_type, action_description, outcome, notes } = req.body;

    if (!action_type) {
      return res.status(400).json({ error: 'action_type is required' });
    }

    const opportunity = Report.getOpportunityById(reportId, opportunityId);
    if (!opportunity) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const success = Report.logOpportunityAction(
      opportunityId,
      reportId,
      action_type,
      action_description,
      outcome,
      notes
    );

    if (success) {
      res.json({
        success: true,
        message: 'Action logged successfully'
      });
    } else {
      res.status(500).json({ error: 'Failed to log action' });
    }
  } catch (error) {
    console.error('Error logging action:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insights/:reportId/history
 * Get execution history for a report
 */
router.get('/:reportId/history', (req, res) => {
  try {
    const { reportId } = req.params;
    const { limit, offset } = req.query;

    const report = Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const history = Report.getExecutionHistory(
      reportId,
      parseInt(limit) || 50,
      parseInt(offset) || 0
    );

    res.json({
      reportId,
      history
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/insights/:reportId/summary
 * Get a summary of PR insights (priority counts, theme distribution)
 */
router.get('/:reportId/summary', (req, res) => {
  try {
    const { reportId } = req.params;

    const report = Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const summary = Report.getPRInsightsSummary(reportId);

    res.json({
      reportId,
      entity: report.entity,
      ...summary
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
