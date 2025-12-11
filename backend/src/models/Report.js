import crypto from 'crypto';
import { getDatabase } from '../database/schema.js';
import { extractDomainInfo } from '../services/sourceClassifier.js';

export class Report {
  static create(reportData) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO reports (id, entity, category, competitors, countries, languages, total_questions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      reportData.id,
      reportData.entity,
      reportData.category,
      JSON.stringify(reportData.competitors || []),
      JSON.stringify(reportData.countries || []),
      JSON.stringify(reportData.languages || []),
      reportData.totalQuestions || 0
    );

    return result.changes > 0;
  }

  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM reports WHERE id = ?');
    const report = stmt.get(id);

    if (!report) return null;

    return {
      ...report,
      competitors: JSON.parse(report.competitors || '[]'),
      countries: JSON.parse(report.countries || '[]'),
      languages: JSON.parse(report.languages || '[]')
    };
  }

  static findAll(limit = 50, offset = 0) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM reports
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const reports = stmt.all(limit, offset);

    return reports.map(report => ({
      ...report,
      competitors: JSON.parse(report.competitors || '[]'),
      countries: JSON.parse(report.countries || '[]'),
      languages: JSON.parse(report.languages || '[]')
    }));
  }

  static updateStatus(id, status, progress = null, errorMessage = null) {
    const db = getDatabase();
    const updates = ['status = ?'];
    const params = [status];

    if (progress !== null) {
      updates.push('progress = ?');
      params.push(progress);
    }

    if (errorMessage !== null) {
      updates.push('error_message = ?');
      params.push(errorMessage);
    }

    params.push(id);

    const stmt = db.prepare(`
      UPDATE reports
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    return stmt.run(...params).changes > 0;
  }

  static updateExecutionTime(id, executionTime) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE reports SET execution_time = ? WHERE id = ?');
    return stmt.run(executionTime, id).changes > 0;
  }

  static saveConfiguration(reportId, analysisType, questions) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO report_configurations (report_id, analysis_type, questions)
      VALUES (?, ?, ?)
    `);

    return stmt.run(reportId, analysisType, JSON.stringify(questions)).changes > 0;
  }

  static getConfiguration(reportId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT analysis_type, questions
      FROM report_configurations
      WHERE report_id = ?
    `);

    const configs = stmt.all(reportId);
    return configs.map(config => ({
      analysisType: config.analysis_type,
      questions: JSON.parse(config.questions)
    }));
  }

  static saveAnalysisResult(reportId, analysisType, data, category = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO analysis_results (report_id, analysis_type, category, data)
      VALUES (?, ?, ?, ?)
    `);

    return stmt.run(reportId, analysisType, category, JSON.stringify(data)).changes > 0;
  }

  static getAnalysisResults(reportId) {
    const db = getDatabase();

    // Get report info for backward compatibility
    const reportStmt = db.prepare('SELECT category FROM reports WHERE id = ?');
    const report = reportStmt.get(reportId);
    const defaultCategory = report?.category || 'Default';

    const stmt = db.prepare(`
      SELECT analysis_type, category, data
      FROM analysis_results
      WHERE report_id = ?
      ORDER BY created_at ASC
    `);

    const results = stmt.all(reportId);

    // Group results by category
    const grouped = {
      reputation: null,
      categories_associated: null,
      categories: []
    };

    const categoryMap = new Map();

    results.forEach(result => {
      const parsedData = JSON.parse(result.data);

      if (result.analysis_type === 'reputation') {
        // Reputation is report-level, no category grouping
        grouped.reputation = parsedData;
      } else if (result.analysis_type === 'categories_associated') {
        // Categories Associated from category detection questions
        grouped.categories_associated = parsedData;
      } else if (result.analysis_type === 'visibility' || result.analysis_type === 'competitive') {
        // Use category from result, fall back to report.category for backward compatibility
        const catName = result.category || defaultCategory;

        if (!categoryMap.has(catName)) {
          categoryMap.set(catName, {
            name: catName,
            visibility: null,
            competitive: null
          });
        }

        const category = categoryMap.get(catName);
        category[result.analysis_type] = parsedData;
      }
    });

    // Convert category map to array
    grouped.categories = Array.from(categoryMap.values());

    return grouped;
  }

  static saveLLMResponse(reportId, questionId, questionText, analysisType, geminiResponse, openaiResponse, geminiSources, openaiSources) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO llm_responses (
        report_id, question_id, question_text, analysis_type,
        gemini_response, openai_response, gemini_sources, openai_sources
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      reportId,
      questionId,
      questionText,
      analysisType,
      JSON.stringify(geminiResponse),
      JSON.stringify(openaiResponse),
      JSON.stringify(geminiSources || []),
      JSON.stringify(openaiSources || [])
    ).changes > 0;
  }

  static getLLMResponses(reportId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM llm_responses
      WHERE report_id = ?
      ORDER BY created_at ASC
    `);

    const responses = stmt.all(reportId);
    return responses.map(response => ({
      ...response,
      gemini_response: JSON.parse(response.gemini_response || 'null'),
      openai_response: JSON.parse(response.openai_response || 'null'),
      gemini_sources: JSON.parse(response.gemini_sources || '[]'),
      openai_sources: JSON.parse(response.openai_sources || '[]')
    }));
  }

  static saveSource(reportId, sourceData) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO sources (
        report_id, url, resolved_url, title, domain, source_type,
        competitor_name, youtube_channel,
        classification_confidence, classification_reasoning, cited_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      reportId,
      sourceData.url,
      sourceData.resolvedUrl,
      sourceData.title,
      sourceData.domain,
      sourceData.sourceType,
      sourceData.competitorName || null,
      sourceData.youtubeChannel || null,
      sourceData.confidence,
      sourceData.reasoning,
      JSON.stringify(sourceData.citedBy || [])
    ).changes > 0;
  }

  static getSources(reportId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM sources
      WHERE report_id = ?
      ORDER BY created_at ASC
    `);

    const sources = stmt.all(reportId);
    return sources.map(source => ({
      ...source,
      cited_by: JSON.parse(source.cited_by || '[]')
    }));
  }

  /**
   * Get sources with logos joined from domain_logos table
   */
  static getSourcesWithLogos(reportId) {
    const db = getDatabase();
    try {
      const stmt = db.prepare(`
        SELECT s.*, dl.logo_url, dl.icon_url, dl.fetch_status as logo_status
        FROM sources s
        LEFT JOIN domain_logos dl ON s.domain = dl.domain
        WHERE s.report_id = ?
        ORDER BY s.created_at ASC
      `);

      const sources = stmt.all(reportId);
      return sources.map(source => ({
        ...source,
        cited_by: JSON.parse(source.cited_by || '[]'),
        logo_url: source.logo_url || null,
        icon_url: source.icon_url || null,
        logo_status: source.logo_status || 'pending'
      }));
    } catch (e) {
      // Fall back to regular getSources if domain_logos table doesn't exist
      return this.getSources(reportId);
    }
  }

  /**
   * Get logos for a list of domains from cache
   */
  static getLogosForDomains(domains) {
    if (!domains || domains.length === 0) {
      return {};
    }

    const db = getDatabase();
    try {
      const placeholders = domains.map(() => '?').join(',');
      const stmt = db.prepare(`
        SELECT domain, logo_url, icon_url, fetch_status
        FROM domain_logos
        WHERE domain IN (${placeholders})
      `);
      const rows = stmt.all(...domains);

      const result = {};
      rows.forEach(row => {
        result[row.domain] = {
          logo_url: row.logo_url,
          icon_url: row.icon_url,
          fetch_status: row.fetch_status
        };
      });
      return result;
    } catch (e) {
      // Table might not exist yet
      return {};
    }
  }

  static delete(id) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM reports WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  static count() {
    const db = getDatabase();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM reports');
    return stmt.get().count;
  }

  /**
   * Find reports that were interrupted (status='processing' with LLM responses but no aggregated results)
   * These can be resumed by running only the aggregation phase
   */
  static findInterruptedReports() {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT r.*,
        (SELECT COUNT(*) FROM llm_responses WHERE report_id = r.id) as response_count,
        (SELECT COUNT(*) FROM market_analysis_results WHERE report_id = r.id) as market_result_count,
        (SELECT COUNT(*) FROM analysis_results WHERE report_id = r.id) as analysis_result_count
      FROM reports r
      WHERE r.status = 'processing'
      AND (SELECT COUNT(*) FROM llm_responses WHERE report_id = r.id) > 0
    `);

    const reports = stmt.all();

    return reports.map(report => ({
      ...report,
      competitors: JSON.parse(report.competitors || '[]'),
      countries: JSON.parse(report.countries || '[]'),
      languages: JSON.parse(report.languages || '[]'),
      response_count: report.response_count,
      market_result_count: report.market_result_count,
      analysis_result_count: report.analysis_result_count,
      // Can resume if has responses but no aggregated results
      can_resume: report.response_count > 0 && (report.market_result_count === 0 || report.analysis_result_count === 0)
    }));
  }

  /**
   * Get report configuration for resume (markets, categories, competitors)
   */
  static getResumeConfig(reportId) {
    const report = this.findById(reportId);
    if (!report) return null;

    const markets = this.getMarkets(reportId);
    const categoryFamilies = this.getCategoryFamilies(reportId);
    const competitors = this.getMarketCompetitors(reportId);
    const llmResponses = this.getLLMResponses(reportId);

    return {
      report,
      markets,
      categoryFamilies,
      competitors,
      llmResponses,
      isMultiMarket: markets.length > 0
    };
  }

  // ==========================================
  // PR Insights Methods
  // ==========================================

  /**
   * Save a PR insights opportunity
   */
  static saveOpportunity(reportId, opportunity) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO pr_insights_opportunities (
        id, report_id, title, description, opportunity_type, theme_category,
        current_state, competitor_analysis, impact_score, impact_label,
        effort_score, effort_label, priority_tier, priority_urgency,
        priority_timeline, priority_color, recommended_actions,
        ai_collaboration_recommendations, evidence, sources, metadata,
        expected_visibility_increase, expected_authority_boost,
        expected_sentiment_improvement
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      opportunity.id,
      reportId,
      opportunity.title,
      opportunity.description,
      opportunity.opportunity_type,
      opportunity.theme_category,
      JSON.stringify(opportunity.current_state || {}),
      JSON.stringify(opportunity.competitor_analysis || null),
      opportunity.scores?.impact_score,
      opportunity.scores?.impact_label,
      opportunity.scores?.effort_score,
      opportunity.scores?.effort_label,
      opportunity.priority?.tier,
      opportunity.priority?.urgency,
      opportunity.priority?.timeline,
      opportunity.priority?.color,
      JSON.stringify(opportunity.recommended_actions || []),
      JSON.stringify(opportunity.ai_collaboration_recommendations || null),
      JSON.stringify(opportunity.evidence || []),
      JSON.stringify(opportunity.sources || []),
      JSON.stringify(opportunity.metadata || {}),
      opportunity.expected_impact?.visibility_increase,
      opportunity.expected_impact?.authority_boost,
      opportunity.expected_impact?.sentiment_improvement
    ).changes > 0;
  }

  /**
   * Save multiple opportunities in a batch
   */
  static savePRInsights(reportId, prInsights) {
    const db = getDatabase();
    let savedCount = 0;

    const insertOpportunity = db.prepare(`
      INSERT OR REPLACE INTO pr_insights_opportunities (
        id, report_id, title, description, opportunity_type, theme_category,
        current_state, competitor_analysis, impact_score, impact_label,
        effort_score, effort_label, priority_tier, priority_urgency,
        priority_timeline, priority_color, recommended_actions,
        ai_collaboration_recommendations, evidence, sources, metadata,
        expected_visibility_increase, expected_authority_boost,
        expected_sentiment_improvement
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saveMany = db.transaction((opportunities) => {
      for (const opp of opportunities) {
        insertOpportunity.run(
          opp.id,
          reportId,
          opp.title,
          opp.description,
          opp.opportunity_type,
          opp.theme_category,
          JSON.stringify(opp.current_state || {}),
          JSON.stringify(opp.competitor_analysis || null),
          opp.scores?.impact_score,
          opp.scores?.impact_label,
          opp.scores?.effort_score,
          opp.scores?.effort_label,
          opp.priority?.tier,
          opp.priority?.urgency,
          opp.priority?.timeline,
          opp.priority?.color,
          JSON.stringify(opp.recommended_actions || []),
          JSON.stringify(opp.ai_collaboration_recommendations || null),
          JSON.stringify(opp.evidence || []),
          JSON.stringify(opp.sources || []),
          JSON.stringify(opp.metadata || {}),
          opp.expected_impact?.visibility_increase,
          opp.expected_impact?.authority_boost,
          opp.expected_impact?.sentiment_improvement
        );
        savedCount++;
      }
    });

    if (prInsights.opportunities && prInsights.opportunities.length > 0) {
      saveMany(prInsights.opportunities);
    }

    return savedCount;
  }

  /**
   * Get all opportunities for a report
   */
  static getOpportunities(reportId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM pr_insights_opportunities
      WHERE report_id = ?
      ORDER BY priority_urgency ASC, impact_score DESC
    `);

    const opportunities = stmt.all(reportId);
    return opportunities.map(opp => this.parseOpportunity(opp));
  }

  /**
   * Get a single opportunity by ID
   */
  static getOpportunityById(reportId, opportunityId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM pr_insights_opportunities
      WHERE report_id = ? AND id = ?
    `);

    const opportunity = stmt.get(reportId, opportunityId);
    return opportunity ? this.parseOpportunity(opportunity) : null;
  }

  /**
   * Parse opportunity from database row
   */
  static parseOpportunity(row) {
    return {
      id: row.id,
      report_id: row.report_id,
      title: row.title,
      description: row.description,
      opportunity_type: row.opportunity_type,
      theme_category: row.theme_category,
      current_state: JSON.parse(row.current_state || '{}'),
      competitor_analysis: JSON.parse(row.competitor_analysis || 'null'),
      scores: {
        impact_score: row.impact_score,
        impact_label: row.impact_label,
        effort_score: row.effort_score,
        effort_label: row.effort_label
      },
      priority: {
        tier: row.priority_tier,
        urgency: row.priority_urgency,
        timeline: row.priority_timeline,
        color: row.priority_color
      },
      recommended_actions: JSON.parse(row.recommended_actions || '[]'),
      ai_collaboration_recommendations: JSON.parse(row.ai_collaboration_recommendations || 'null'),
      evidence: JSON.parse(row.evidence || '[]'),
      sources: JSON.parse(row.sources || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      expected_impact: {
        visibility_increase: row.expected_visibility_increase,
        authority_boost: row.expected_authority_boost,
        sentiment_improvement: row.expected_sentiment_improvement
      },
      is_implemented: row.is_implemented,
      implemented_at: row.implemented_at,
      implementation_notes: row.implementation_notes,
      created_at: row.created_at
    };
  }

  /**
   * Get PR insights with summary
   */
  static getPRInsights(reportId) {
    const opportunities = this.getOpportunities(reportId);

    // Calculate summary
    const prioritySummary = {
      critical: opportunities.filter(o => o.priority.tier === 'Critical').length,
      strategic: opportunities.filter(o => o.priority.tier === 'Strategic').length,
      quick_wins: opportunities.filter(o => o.priority.tier === 'Quick Wins').length,
      low_priority: opportunities.filter(o => o.priority.tier === 'Low Priority').length
    };

    // Calculate theme distribution
    const themeDistribution = {};
    opportunities.forEach(opp => {
      const theme = opp.theme_category || 'Other';
      themeDistribution[theme] = (themeDistribution[theme] || 0) + 1;
    });

    // Calculate average expected impacts
    const implemented = opportunities.filter(o => o.is_implemented);
    const pending = opportunities.filter(o => !o.is_implemented);

    return {
      total_opportunities: opportunities.length,
      implemented_count: implemented.length,
      pending_count: pending.length,
      priority_summary: prioritySummary,
      theme_distribution: themeDistribution,
      opportunities
    };
  }

  /**
   * Get summary statistics for PR insights
   */
  static getPRInsightsSummary(reportId) {
    const db = getDatabase();

    // Priority tier counts
    const priorityStmt = db.prepare(`
      SELECT priority_tier, COUNT(*) as count
      FROM pr_insights_opportunities
      WHERE report_id = ?
      GROUP BY priority_tier
    `);
    const priorityCounts = priorityStmt.all(reportId);

    // Theme distribution
    const themeStmt = db.prepare(`
      SELECT theme_category, COUNT(*) as count
      FROM pr_insights_opportunities
      WHERE report_id = ?
      GROUP BY theme_category
    `);
    const themeCounts = themeStmt.all(reportId);

    // Implementation status
    const statusStmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_implemented = 1 THEN 1 ELSE 0 END) as implemented
      FROM pr_insights_opportunities
      WHERE report_id = ?
    `);
    const statusCounts = statusStmt.get(reportId);

    // Average impact metrics
    const metricsStmt = db.prepare(`
      SELECT
        AVG(impact_score) as avg_impact,
        AVG(effort_score) as avg_effort,
        AVG(expected_visibility_increase) as avg_visibility,
        AVG(expected_authority_boost) as avg_authority,
        AVG(expected_sentiment_improvement) as avg_sentiment
      FROM pr_insights_opportunities
      WHERE report_id = ?
    `);
    const metrics = metricsStmt.get(reportId);

    return {
      priority_summary: {
        critical: priorityCounts.find(p => p.priority_tier === 'Critical')?.count || 0,
        strategic: priorityCounts.find(p => p.priority_tier === 'Strategic')?.count || 0,
        quick_wins: priorityCounts.find(p => p.priority_tier === 'Quick Wins')?.count || 0,
        low_priority: priorityCounts.find(p => p.priority_tier === 'Low Priority')?.count || 0
      },
      theme_distribution: themeCounts.reduce((acc, t) => {
        acc[t.theme_category] = t.count;
        return acc;
      }, {}),
      implementation_status: {
        total: statusCounts?.total || 0,
        implemented: statusCounts?.implemented || 0,
        pending: (statusCounts?.total || 0) - (statusCounts?.implemented || 0)
      },
      average_metrics: {
        impact_score: metrics?.avg_impact || 0,
        effort_score: metrics?.avg_effort || 0,
        expected_visibility_increase: metrics?.avg_visibility || 0,
        expected_authority_boost: metrics?.avg_authority || 0,
        expected_sentiment_improvement: metrics?.avg_sentiment || 0
      }
    };
  }

  /**
   * Mark an opportunity as implemented
   */
  static markOpportunityImplemented(opportunityId, notes = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE pr_insights_opportunities
      SET is_implemented = 1, implemented_at = CURRENT_TIMESTAMP, implementation_notes = ?
      WHERE id = ?
    `);

    return stmt.run(notes, opportunityId).changes > 0;
  }

  /**
   * Update AI collaboration recommendations for an opportunity
   */
  static updateCollaborationRecommendations(opportunityId, recommendations) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE pr_insights_opportunities
      SET ai_collaboration_recommendations = ?
      WHERE id = ?
    `);

    return stmt.run(JSON.stringify(recommendations), opportunityId).changes > 0;
  }

  /**
   * Log an action taken on an opportunity
   */
  static logOpportunityAction(opportunityId, reportId, actionType, actionDescription, outcome = null, notes = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO opportunity_execution_history (
        opportunity_id, report_id, action_type, action_description, outcome, notes
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      opportunityId,
      reportId,
      actionType,
      actionDescription,
      outcome,
      notes
    ).changes > 0;
  }

  /**
   * Get actions for a specific opportunity
   */
  static getOpportunityActions(opportunityId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM opportunity_execution_history
      WHERE opportunity_id = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(opportunityId);
  }

  /**
   * Get execution history for a report
   */
  static getExecutionHistory(reportId, limit = 50, offset = 0) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT h.*, o.title as opportunity_title, o.priority_tier
      FROM opportunity_execution_history h
      LEFT JOIN pr_insights_opportunities o ON h.opportunity_id = o.id
      WHERE h.report_id = ?
      ORDER BY h.created_at DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(reportId, limit, offset);
  }

  // ==========================================
  // Multi-Market Methods (V2.19)
  // ==========================================

  /**
   * Save markets for a report
   */
  static saveMarkets(reportId, markets) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO report_markets (report_id, country, language, market_code, is_primary, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const saveMany = db.transaction((items) => {
      items.forEach((market, idx) => {
        stmt.run(
          reportId,
          market.country,
          market.language,
          market.code,
          market.isPrimary ? 1 : 0,
          idx
        );
      });
    });

    saveMany(markets);
    return markets.length;
  }

  /**
   * Get markets for a report
   */
  static getMarkets(reportId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM report_markets
      WHERE report_id = ?
      ORDER BY display_order ASC
    `);

    return stmt.all(reportId).map(m => ({
      country: m.country,
      language: m.language,
      code: m.market_code,
      isPrimary: m.is_primary === 1
    }));
  }

  /**
   * Save category families for a report
   */
  static saveCategoryFamilies(reportId, categoryFamilies) {
    const db = getDatabase();

    const familyStmt = db.prepare(`
      INSERT OR REPLACE INTO category_families (id, report_id, canonical_name, is_selected, display_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    const translationStmt = db.prepare(`
      INSERT OR REPLACE INTO category_translations (category_family_id, market_code, translated_name)
      VALUES (?, ?, ?)
    `);

    const saveAll = db.transaction((families) => {
      families.forEach((family, idx) => {
        // Save family
        familyStmt.run(
          family.id,
          reportId,
          family.canonical_name,
          family.isSelected ? 1 : 0,
          idx
        );

        // Save translations
        if (family.translations) {
          Object.entries(family.translations).forEach(([marketCode, translation]) => {
            const name = typeof translation === 'string' ? translation : translation.name;
            if (name) {
              translationStmt.run(family.id, marketCode, name);
            }
          });
        }
      });
    });

    saveAll(categoryFamilies);
    return categoryFamilies.length;
  }

  /**
   * Get category families for a report
   */
  static getCategoryFamilies(reportId) {
    const db = getDatabase();

    const familiesStmt = db.prepare(`
      SELECT * FROM category_families
      WHERE report_id = ?
      ORDER BY display_order ASC
    `);

    const translationsStmt = db.prepare(`
      SELECT * FROM category_translations
      WHERE category_family_id = ?
    `);

    const families = familiesStmt.all(reportId);

    return families.map(f => {
      const translations = translationsStmt.all(f.id);
      const translationMap = {};
      translations.forEach(t => {
        translationMap[t.market_code] = { name: t.translated_name };
      });

      return {
        id: f.id,
        canonical_name: f.canonical_name,
        isSelected: f.is_selected === 1,
        translations: translationMap
      };
    });
  }

  /**
   * Save competitors per category per market
   */
  static saveMarketCompetitors(reportId, competitors) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO category_market_competitors (report_id, category_family_id, market_code, competitors)
      VALUES (?, ?, ?, ?)
    `);

    const saveAll = db.transaction((competitorMap) => {
      Object.entries(competitorMap).forEach(([categoryId, marketCompetitors]) => {
        Object.entries(marketCompetitors).forEach(([marketCode, competitorList]) => {
          stmt.run(reportId, categoryId, marketCode, JSON.stringify(competitorList));
        });
      });
    });

    saveAll(competitors);
  }

  /**
   * Get competitors for a category in a market
   */
  static getMarketCompetitors(reportId, categoryId = null, marketCode = null) {
    const db = getDatabase();

    let query = 'SELECT * FROM category_market_competitors WHERE report_id = ?';
    const params = [reportId];

    if (categoryId) {
      query += ' AND category_family_id = ?';
      params.push(categoryId);
    }
    if (marketCode) {
      query += ' AND market_code = ?';
      params.push(marketCode);
    }

    const stmt = db.prepare(query);
    const results = stmt.all(...params);

    // Return as nested object: { categoryId: { marketCode: [competitors] } }
    const competitorMap = {};
    results.forEach(r => {
      if (!competitorMap[r.category_family_id]) {
        competitorMap[r.category_family_id] = {};
      }
      competitorMap[r.category_family_id][r.market_code] = JSON.parse(r.competitors || '[]');
    });

    return competitorMap;
  }

  /**
   * Save market-specific analysis result
   */
  static saveMarketAnalysisResult(reportId, marketCode, analysisType, data, categoryId = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO market_analysis_results (report_id, market_code, category_family_id, analysis_type, data)
      VALUES (?, ?, ?, ?, ?)
    `);

    return stmt.run(reportId, marketCode, categoryId, analysisType, JSON.stringify(data)).changes > 0;
  }

  /**
   * Get market-specific analysis results
   */
  static getMarketAnalysisResults(reportId, marketCode = null) {
    const db = getDatabase();

    let query = `
      SELECT mar.*, cf.canonical_name as category_name
      FROM market_analysis_results mar
      LEFT JOIN category_families cf ON mar.category_family_id = cf.id
      WHERE mar.report_id = ?
    `;
    const params = [reportId];

    if (marketCode) {
      query += ' AND mar.market_code = ?';
      params.push(marketCode);
    }

    query += ' ORDER BY mar.created_at ASC';

    const stmt = db.prepare(query);
    const results = stmt.all(...params);

    // Group by market, then by category
    const grouped = {};

    results.forEach(r => {
      if (!grouped[r.market_code]) {
        grouped[r.market_code] = {
          reputation: null,
          categories_associated: null,
          categories: {}
        };
      }

      const parsedData = JSON.parse(r.data);

      if (r.analysis_type === 'reputation') {
        grouped[r.market_code].reputation = parsedData;
      } else if (r.analysis_type === 'categories_associated') {
        grouped[r.market_code].categories_associated = parsedData;
      } else if (r.category_family_id) {
        const catId = r.category_family_id;
        if (!grouped[r.market_code].categories[catId]) {
          grouped[r.market_code].categories[catId] = {
            id: catId,
            name: r.category_name,
            visibility: null,
            competitive: null
          };
        }
        grouped[r.market_code].categories[catId][r.analysis_type] = parsedData;
      }
    });

    return grouped;
  }

  /**
   * Get full multi-market report data
   */
  static getMultiMarketReport(reportId) {
    const report = this.findById(reportId);
    if (!report) return null;

    const markets = this.getMarkets(reportId);
    const categoryFamilies = this.getCategoryFamilies(reportId);
    const competitors = this.getMarketCompetitors(reportId);
    const marketResults = this.getMarketAnalysisResults(reportId);

    return {
      ...report,
      markets,
      categoryFamilies,
      competitors,
      marketResults
    };
  }

  // ==========================================
  // Share Token Methods
  // ==========================================

  /**
   * Generate a unique share token for a report
   */
  static generateShareToken(reportId) {
    const db = getDatabase();

    // Generate a random token (URL-safe base64)
    const token = Buffer.from(crypto.randomUUID()).toString('base64url').slice(0, 16);

    const stmt = db.prepare('UPDATE reports SET share_token = ? WHERE id = ?');
    const result = stmt.run(token, reportId);

    if (result.changes > 0) {
      return token;
    }
    return null;
  }

  /**
   * Get share token for a report
   */
  static getShareToken(reportId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT share_token FROM reports WHERE id = ?');
    const result = stmt.get(reportId);
    return result?.share_token || null;
  }

  /**
   * Find a report by its share token
   */
  static findByShareToken(token) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM reports WHERE share_token = ?');
    const report = stmt.get(token);

    if (!report) return null;

    return {
      ...report,
      competitors: JSON.parse(report.competitors || '[]'),
      countries: JSON.parse(report.countries || '[]'),
      languages: JSON.parse(report.languages || '[]')
    };
  }

  /**
   * Revoke share token for a report
   */
  static revokeShareToken(reportId) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE reports SET share_token = NULL WHERE id = ?');
    return stmt.run(reportId).changes > 0;
  }

  // ==========================================
  // Health Check Methods
  // ==========================================

  /**
   * Get all actively processing reports
   */
  static getActiveReports() {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT r.*,
        (SELECT COUNT(*) FROM llm_responses WHERE report_id = r.id) as questions_processed,
        (SELECT MAX(created_at) FROM llm_responses WHERE report_id = r.id) as last_activity
      FROM reports r
      WHERE r.status = 'processing'
      ORDER BY r.created_at DESC
    `);

    return stmt.all().map(report => ({
      ...report,
      competitors: JSON.parse(report.competitors || '[]'),
      countries: JSON.parse(report.countries || '[]'),
      languages: JSON.parse(report.languages || '[]')
    }));
  }

  /**
   * Get reports that appear stuck (processing too long or no recent activity)
   */
  static getStuckReports(stuckThresholdMinutes = 10) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT r.*,
        (SELECT COUNT(*) FROM llm_responses WHERE report_id = r.id) as questions_processed,
        (SELECT MAX(created_at) FROM llm_responses WHERE report_id = r.id) as last_activity,
        ROUND((julianday('now') - julianday(r.created_at)) * 24 * 60) as elapsed_minutes
      FROM reports r
      WHERE r.status = 'processing'
      AND (
        (julianday('now') - julianday(r.created_at)) * 24 * 60 > ?
        OR (
          (SELECT MAX(created_at) FROM llm_responses WHERE report_id = r.id) IS NOT NULL
          AND (julianday('now') - julianday((SELECT MAX(created_at) FROM llm_responses WHERE report_id = r.id))) * 24 * 60 > ?
        )
      )
      ORDER BY r.created_at DESC
    `);

    return stmt.all(stuckThresholdMinutes, stuckThresholdMinutes / 2).map(report => ({
      ...report,
      competitors: JSON.parse(report.competitors || '[]'),
      countries: JSON.parse(report.countries || '[]'),
      languages: JSON.parse(report.languages || '[]')
    }));
  }

  /**
   * Get recently failed reports
   */
  static getRecentFailures(hours = 1) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM reports
      WHERE status = 'failed'
      AND (julianday('now') - julianday(created_at)) * 24 < ?
      ORDER BY created_at DESC
    `);

    return stmt.all(hours).map(report => ({
      ...report,
      competitors: JSON.parse(report.competitors || '[]'),
      countries: JSON.parse(report.countries || '[]'),
      languages: JSON.parse(report.languages || '[]')
    }));
  }

  /**
   * Get health summary counts
   */
  static getHealthSummary() {
    const db = getDatabase();

    const activeStmt = db.prepare(`SELECT COUNT(*) as count FROM reports WHERE status = 'processing'`);
    const stuckStmt = db.prepare(`
      SELECT COUNT(*) as count FROM reports
      WHERE status = 'processing'
      AND (julianday('now') - julianday(created_at)) * 24 * 60 > 10
    `);
    const failedStmt = db.prepare(`
      SELECT COUNT(*) as count FROM reports
      WHERE status = 'failed'
      AND (julianday('now') - julianday(created_at)) * 24 < 1
    `);
    const completedStmt = db.prepare(`
      SELECT COUNT(*) as count FROM reports
      WHERE status = 'completed'
      AND (julianday('now') - julianday(created_at)) * 24 < 24
    `);

    return {
      active: activeStmt.get()?.count || 0,
      stuck: stuckStmt.get()?.count || 0,
      failed_last_hour: failedStmt.get()?.count || 0,
      completed_last_24h: completedStmt.get()?.count || 0
    };
  }

  // ==========================================
  // Overview Data Methods
  // ==========================================

  /**
   * Calculate win rate from competitive LLM responses
   * Win rate = % of competitive questions where entity_choice equals target entity
   * @param {string} reportId - Report ID
   * @param {string} entity - Target entity name
   * @param {string} categoryFamilyId - Optional category family ID to filter by
   * @param {string} marketCode - Optional market code to filter by
   * @returns {number|null} Win rate (0-1) or null if no competitive data
   */
  static calculateWinRate(reportId, entity, categoryFamilyId = null, marketCode = null) {
    // Get competitive responses
    const stmt = db.prepare(`
      SELECT question_id, gemini_response, openai_response
      FROM llm_responses
      WHERE report_id = ? AND analysis_type = 'competitive'
    `);
    const responses = stmt.all(reportId);

    if (responses.length === 0) return null;

    // Filter by category family and market if provided
    let filteredResponses = responses;
    if (categoryFamilyId || marketCode) {
      filteredResponses = responses.filter(r => {
        const questionId = r.question_id || '';
        // Question IDs include category and market info, e.g., "competitive_cat_xxx_en-US_1"
        const matchesCategory = !categoryFamilyId || questionId.includes(categoryFamilyId);
        const matchesMarket = !marketCode || questionId.includes(marketCode);
        return matchesCategory && matchesMarket;
      });
    }

    if (filteredResponses.length === 0) return null;

    // Count wins (entity was chosen as the best fit)
    let wins = 0;
    let total = 0;
    const entityLower = entity.toLowerCase();

    filteredResponses.forEach(r => {
      // Parse both LLM responses and check entity_choice
      [r.gemini_response, r.openai_response].forEach(responseJson => {
        if (!responseJson || responseJson === 'null') return;
        try {
          const parsed = JSON.parse(responseJson);
          const entityChoice = parsed.entity_choice;
          if (entityChoice) {
            total++;
            if (entityChoice.toLowerCase().includes(entityLower) ||
                entityLower.includes(entityChoice.toLowerCase())) {
              wins++;
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      });
    });

    if (total === 0) return null;
    return wins / total;
  }

  /**
   * Get aggregated overview data across all categories and markets
   * @param {string} reportId
   * @param {Object} options - Filter options
   * @param {string} options.market - 'master' for all markets or specific market code
   * @param {string[]} options.llms - Array of LLM IDs to filter by (e.g., ['gemini', 'openai'])
   */
  static getOverviewData(reportId, options = {}) {
    const report = this.findById(reportId);
    if (!report) return null;

    const { market = 'master', llms = null } = options;

    const markets = this.getMarkets(reportId);
    const isMultiMarket = markets.length > 0;
    const sources = this.getSources(reportId);
    const entity = report.entity;

    // Filter markets if a specific market is requested
    const filteredMarkets = (market && market !== 'master' && isMultiMarket)
      ? markets.filter(m => m.code === market)
      : markets;

    let categoryMetrics = [];
    let hasCompetitiveData = false;

    if (isMultiMarket) {
      // Multi-market report: aggregate across markets and category families
      const categoryFamilies = this.getCategoryFamilies(reportId);
      const marketResults = this.getMarketAnalysisResults(reportId);

      // Determine which markets to include based on filter
      const marketsToProcess = market === 'master'
        ? Object.keys(marketResults)
        : [market].filter(m => marketResults[m]);

      categoryFamilies.forEach(family => {
        marketsToProcess.forEach(marketCode => {
          const marketData = marketResults[marketCode];
          if (!marketData) return;
          const catData = marketData.categories?.[family.id];
          if (!catData?.visibility) return;

          // Use brand family metrics if available, otherwise fall back to raw visibility
          const brandFamilyRanking = catData.visibility.brand_family_ranking || [];
          const targetBrandFamily = brandFamilyRanking.find(b => b.is_target_brand);
          const rawVisMetrics = catData.visibility.visibility || {};

          // Prefer brand family metrics for consistency with the visibility tab
          const visMetrics = targetBrandFamily ? {
            visibility: targetBrandFamily.visibility,
            sov: targetBrandFamily.sov,
            averagePosition: targetBrandFamily.average_rank,
            mentions: targetBrandFamily.mentions
          } : rawVisMetrics;

          // Calculate win rate from competitive data (ranked_first_questions / totalQuestions)
          let winRate = null;
          if (catData.competitive) {
            const rankedFirst = catData.competitive.ranked_first_questions?.length || 0;
            const totalQ = catData.competitive.visibility?.totalQuestions || 0;
            if (totalQ > 0) {
              winRate = rankedFirst / totalQ;
              hasCompetitiveData = true;
            }
          }

          // Get country name from market
          const marketInfo = markets.find(m => m.code === marketCode);
          const countryName = marketInfo?.country || marketCode;

          // Get translated name for this market
          const translatedName = family.translations?.[marketCode]?.name || family.canonical_name;

          categoryMetrics.push({
            categoryId: family.id,
            categoryName: translatedName,
            marketCode,
            marketLabel: markets.length > 1
              ? `${translatedName} (${countryName})`
              : translatedName,
            visibility: visMetrics.visibility || 0,
            sov: visMetrics.sov || 0,
            avgPosition: visMetrics.averagePosition || null,
            mentions: visMetrics.mentions || 0,
            winRate
          });
        });
      });
    } else {
      // Legacy single-market report: aggregate across categories
      const analysisResults = this.getAnalysisResults(reportId);
      const categories = analysisResults.categories || [];

      categories.forEach((cat, idx) => {
        // Use brand family metrics if available, otherwise fall back to raw visibility
        const brandFamilyRanking = cat.visibility?.brand_family_ranking || [];
        const targetBrandFamily = brandFamilyRanking.find(b => b.is_target_brand);
        const rawVisMetrics = cat.visibility?.visibility || {};

        // Prefer brand family metrics for consistency with the visibility tab
        const visMetrics = targetBrandFamily ? {
          visibility: targetBrandFamily.visibility,
          sov: targetBrandFamily.sov,
          averagePosition: targetBrandFamily.average_rank,
          mentions: targetBrandFamily.mentions
        } : rawVisMetrics;

        // Calculate win rate from competitive data (ranked_first_questions / totalQuestions)
        let winRate = null;
        if (cat.competitive) {
          const rankedFirst = cat.competitive.ranked_first_questions?.length || 0;
          const totalQ = cat.competitive.visibility?.totalQuestions || 0;
          if (totalQ > 0) {
            winRate = rankedFirst / totalQ;
            hasCompetitiveData = true;
          }
        }

        categoryMetrics.push({
          categoryId: `cat_${idx}`,
          categoryName: cat.name,
          marketCode: 'default',
          marketLabel: cat.name,
          visibility: visMetrics.visibility || 0,
          sov: visMetrics.sov || 0,
          avgPosition: visMetrics.averagePosition || null,
          mentions: visMetrics.mentions || 0,
          winRate
        });
      });
    }

    // Calculate overall metrics
    const avgVisibility = categoryMetrics.length > 0
      ? categoryMetrics.reduce((sum, c) => sum + c.visibility, 0) / categoryMetrics.length
      : 0;
    const avgSOV = categoryMetrics.length > 0
      ? categoryMetrics.reduce((sum, c) => sum + c.sov, 0) / categoryMetrics.length
      : 0;
    const positionsWithData = categoryMetrics.filter(c => c.avgPosition !== null);
    const avgPosition = positionsWithData.length > 0
      ? positionsWithData.reduce((sum, c) => sum + c.avgPosition, 0) / positionsWithData.length
      : null;
    const totalMentions = categoryMetrics.reduce((sum, c) => sum + c.mentions, 0);

    // Calculate average win rate (LLM choice) from categories with competitive data
    const categoriesWithWinRate = categoryMetrics.filter(c => c.winRate !== null);
    const avgWinRate = categoriesWithWinRate.length > 0
      ? categoriesWithWinRate.reduce((sum, c) => sum + c.winRate, 0) / categoriesWithWinRate.length
      : null;

    // ==========================================
    // Logo Methods (inline for overview data)
    // ==========================================

    // Get logos for unique domains in sources
    const uniqueDomains = [...new Set(sources.map(s => s.domain).filter(Boolean))];
    const logoMap = {};
    if (uniqueDomains.length > 0) {
      try {
        const placeholders = uniqueDomains.map(() => '?').join(',');
        const logoStmt = db.prepare(`
          SELECT domain, logo_url, icon_url, fetch_status
          FROM domain_logos
          WHERE domain IN (${placeholders})
        `);
        const logoRows = logoStmt.all(...uniqueDomains);
        logoRows.forEach(row => {
          logoMap[row.domain] = {
            logo_url: row.logo_url,
            icon_url: row.icon_url,
            fetch_status: row.fetch_status
          };
        });
      } catch (e) {
        // Table might not exist yet, ignore
      }
    }

    // Aggregate source analysis
    const sourceTypeDistribution = {};
    const domainCounts = {};
    const youtubeVideos = []; // Track individual YouTube videos

    sources.forEach(source => {
      // Count by source type
      const type = source.source_type || 'Other';
      sourceTypeDistribution[type] = (sourceTypeDistribution[type] || 0) + 1;

      // Get enhanced domain info including YouTube detection
      const domainInfo = extractDomainInfo(source.url);

      // Handle YouTube sources specially - group by channel or "YouTube"
      if (domainInfo.isYouTube) {
        // Determine grouping key: use channel name if available, otherwise "YouTube"
        const youtubeKey = domainInfo.channelName
          ? `youtube.com/${domainInfo.channelName}`
          : 'YouTube';

        if (!domainCounts[youtubeKey]) {
          domainCounts[youtubeKey] = {
            domain: youtubeKey,
            citations: 0,
            sourceType: source.source_type || 'Other',
            isYouTube: true,
            videos: [],
            // YouTube uses its own icon, but include logo data for consistency
            icon_url: logoMap['youtube.com']?.icon_url || null,
            logo_url: logoMap['youtube.com']?.logo_url || null
          };
        }
        domainCounts[youtubeKey].citations += 1;

        // Add video details if we have a video ID or unique URL
        const videoEntry = {
          url: source.url,
          title: source.title !== source.domain && source.title !== 'youtube.com'
            ? source.title
            : (domainInfo.videoId ? `Video: ${domainInfo.videoId}` : source.url),
          videoId: domainInfo.videoId
        };

        // Only add if not already in the list (by URL)
        if (!domainCounts[youtubeKey].videos.find(v => v.url === source.url)) {
          domainCounts[youtubeKey].videos.push(videoEntry);
        }
      } else {
        // Regular domain handling - track individual pages
        const domain = source.domain || 'unknown';
        if (!domainCounts[domain]) {
          domainCounts[domain] = {
            domain,
            citations: 0,
            sourceType: source.source_type || 'Other',
            isYouTube: false,
            pages: [],
            // Include logo data from cache
            icon_url: logoMap[domain]?.icon_url || null,
            logo_url: logoMap[domain]?.logo_url || null
          };
        }
        domainCounts[domain].citations += 1;

        // Add page details if we have a URL
        const pageEntry = {
          url: source.url,
          title: source.title && source.title !== source.domain && source.title !== source.url
            ? source.title
            : source.url
        };

        // Only add if not already in the list (by URL)
        if (!domainCounts[domain].pages.find(p => p.url === source.url)) {
          domainCounts[domain].pages.push(pageEntry);
        }
      }
    });

    // Get top domains sorted by citations
    const topDomains = Object.values(domainCounts)
      .sort((a, b) => b.citations - a.citations)
      .slice(0, 20);

    return {
      overallMetrics: {
        avgVisibility,
        avgSOV,
        avgPosition,
        avgWinRate,
        totalMentions,
        totalCategories: new Set(categoryMetrics.map(c => c.categoryName)).size,
        totalMarkets: isMultiMarket ? (market === 'master' ? markets.length : 1) : 1
      },
      categoryMetrics,
      sourceAnalysis: {
        totalSources: sources.length,
        sourceTypeDistribution,
        topDomains
      },
      hasCompetitiveData
    };
  }
}
