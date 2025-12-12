/**
 * Regenerate PR Insights for a specific report
 * Usage: node scripts/regenerate-pr-insights.js <report_id>
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { aggregatePRInsights } from '../src/services/aggregators/prInsightsAggregator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database/reports.db');
const db = new Database(dbPath);

const reportId = process.argv[2] || 'b2d20f7c-53da-474b-afe2-7d3261d22874'; // Tesla report default

console.log(`\n=== Regenerating PR Insights for report: ${reportId} ===\n`);

// Get report info
const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId);
if (!report) {
  console.error('Report not found!');
  process.exit(1);
}
console.log(`Entity: ${report.entity}`);
console.log(`Category: ${report.category}`);

// Get markets
const markets = db.prepare(`
  SELECT market_code, is_primary FROM report_markets WHERE report_id = ? ORDER BY is_primary DESC
`).all(reportId);
console.log(`Markets: ${markets.map(m => m.market_code).join(', ')}`);

// Get market analysis results
const marketResults = db.prepare(`
  SELECT market_code, analysis_type, data FROM market_analysis_results WHERE report_id = ?
`).all(reportId);

// Get classified sources
const sources = db.prepare(`
  SELECT * FROM sources WHERE report_id = ?
`).all(reportId);

console.log(`\nFound ${marketResults.length} market analysis results`);
console.log(`Found ${sources.length} classified sources`);

// Build the aggregatedForPR structure: { market_code: { analysis_type: data }, reputation: primary }
// This matches how multiMarketOrchestrator builds it
const aggregatedAnalysis = {};

// Group by market_code first
for (const result of marketResults) {
  if (!aggregatedAnalysis[result.market_code]) {
    aggregatedAnalysis[result.market_code] = {};
  }
  try {
    aggregatedAnalysis[result.market_code][result.analysis_type] = JSON.parse(result.data);
  } catch (e) {
    console.warn(`Failed to parse ${result.market_code}/${result.analysis_type}:`, e.message);
  }
}

// Add top-level reputation from primary market
const primaryMarket = markets.find(m => m.is_primary) || markets[0];
if (primaryMarket && aggregatedAnalysis[primaryMarket.market_code]?.reputation) {
  aggregatedAnalysis.reputation = aggregatedAnalysis[primaryMarket.market_code].reputation;
}

// Build config
const config = {
  entity: report.entity,
  category: report.category,
  competitors: report.competitors ? JSON.parse(report.competitors) : []
};

console.log(`\nConfig:`, config);
console.log(`Primary market: ${primaryMarket?.market_code}`);
console.log(`Market keys:`, Object.keys(aggregatedAnalysis).filter(k => k !== 'reputation'));

// Show what data we have per market
for (const marketCode of Object.keys(aggregatedAnalysis)) {
  if (marketCode === 'reputation') continue;
  const marketData = aggregatedAnalysis[marketCode];
  const types = Object.keys(marketData);
  const visGaps = marketData.visibility?.missed_opportunities?.opportunities?.length || 0;
  const compData = marketData.competitive?.win_rate !== undefined;
  console.log(`  ${marketCode}: ${types.join(', ')} | ${visGaps} visibility gaps | competitive: ${compData}`);
}

// Delete existing opportunities
const deleteResult = db.prepare('DELETE FROM pr_insights_opportunities WHERE report_id = ?').run(reportId);
console.log(`\nDeleted ${deleteResult.changes} existing opportunities`);

// Run new aggregation
console.log('\n--- Running V3 PR Insights Aggregator ---\n');
const prInsights = aggregatePRInsights(aggregatedAnalysis, config, sources);

console.log(`\n--- Results ---`);
console.log(`Total opportunities: ${prInsights.total_opportunities}`);
console.log(`Priority summary:`, prInsights.priority_summary);
console.log(`Type summary:`, prInsights.type_summary);
console.log(`Gap summary:`, prInsights.gap_summary);

// Insert new opportunities
if (prInsights.opportunities && prInsights.opportunities.length > 0) {
  const insertStmt = db.prepare(`
    INSERT INTO pr_insights_opportunities (
      id, report_id, title, description, opportunity_type, theme_category,
      current_state, competitor_analysis, impact_score, impact_label,
      effort_score, effort_label, priority_tier, priority_urgency,
      priority_timeline, priority_color, recommended_actions,
      ai_collaboration_recommendations, evidence, sources, metadata,
      expected_visibility_increase, expected_authority_boost,
      expected_sentiment_improvement
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((opportunities) => {
    for (const opp of opportunities) {
      insertStmt.run(
        opp.id,
        reportId,
        opp.title,
        opp.description,
        opp.opportunity_type,
        opp.theme_category,
        JSON.stringify(opp.current_state || {}),
        JSON.stringify(opp.competitor_analysis || {}),
        opp.scores?.impact_score || 0,
        opp.scores?.impact_label || 'Low',
        opp.scores?.effort_score || 0,
        opp.scores?.effort_label || 'Medium',
        opp.priority?.tier || 'Low Priority',
        opp.priority?.urgency || 4,
        opp.priority?.timeline || '12+ months',
        opp.priority?.color || 'gray',
        JSON.stringify(opp.recommended_actions || []),
        JSON.stringify(opp.ai_collaboration_recommendations || []),
        JSON.stringify(opp.evidence || []),
        JSON.stringify(opp.sources || []),
        JSON.stringify(opp.metadata || {}),
        opp.expected_impact?.visibility_increase || 0,
        opp.expected_impact?.authority_boost || 0,
        opp.expected_impact?.sentiment_improvement || 0
      );
    }
  });

  insertMany(prInsights.opportunities);
  console.log(`\nInserted ${prInsights.opportunities.length} new opportunities`);
}

// Show sample of new opportunities by type
console.log('\n--- Sample Opportunities by Type ---');
const byType = {};
for (const opp of prInsights.opportunities || []) {
  const type = opp.opportunity_type;
  if (!byType[type]) byType[type] = [];
  byType[type].push(opp);
}

for (const [type, opps] of Object.entries(byType)) {
  console.log(`\n${type}: ${opps.length} total`);
  for (const opp of opps.slice(0, 3)) {
    console.log(`  [${opp.priority?.tier}] ${opp.title.substring(0, 60)}...`);
    console.log(`    Impact: ${opp.scores?.impact_score} | Citations: ${opp.current_state?.total_citations || 'N/A'}`);
  }
}

console.log('\n=== Done! Refresh the frontend to see changes ===\n');
