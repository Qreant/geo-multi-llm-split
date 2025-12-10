/**
 * Analysis API Routes
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Report } from '../models/Report.js';
import { generateAllQuestions, getTotalQuestionCount } from '../utils/questionTemplates.js';
import { runAnalysis } from '../services/analysisOrchestrator.js';
import { runMultiMarketAnalysis } from '../services/multiMarketOrchestrator.js';
import { translateQuestions, translateTemplates } from '../services/translationService.js';
import {
  discoverCategories,
  suggestCompetitors,
  translateCategories
} from '../services/categoryDiscoveryService.js';

const router = express.Router();

// Store active SSE connections
const activeConnections = new Map();

/**
 * POST /api/analysis/discover-categories
 * Discover categories an entity is known for across multiple markets
 * Links categories across languages into unified "category families"
 */
router.post('/discover-categories', async (req, res) => {
  try {
    const { entity, markets } = req.body;

    if (!entity) {
      return res.status(400).json({ error: 'Entity is required' });
    }

    if (!markets || markets.length === 0) {
      return res.status(400).json({ error: 'At least one market is required' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Validate and normalize markets
    const normalizedMarkets = markets.map((m, idx) => ({
      country: m.country,
      language: m.language,
      code: m.code || `${m.language.toLowerCase().slice(0, 2)}-${m.country.replace(/\s+/g, '').slice(0, 2).toUpperCase()}`,
      isPrimary: m.isPrimary || idx === 0
    }));

    console.log(`📍 Discovering categories for "${entity}" across ${normalizedMarkets.length} markets`);

    const result = await discoverCategories(entity, normalizedMarkets, geminiApiKey);

    res.json({
      entity,
      markets: normalizedMarkets,
      ...result
    });
  } catch (error) {
    console.error('Error discovering categories:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analysis/suggest-competitors
 * Suggest competitors for an entity in a specific category and market
 */
router.post('/suggest-competitors', async (req, res) => {
  try {
    const { entity, categoryName, market } = req.body;

    if (!entity || !categoryName || !market) {
      return res.status(400).json({ error: 'Entity, categoryName, and market are required' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const competitors = await suggestCompetitors(entity, categoryName, market, geminiApiKey);

    res.json({
      entity,
      category: categoryName,
      market: market.code,
      competitors
    });
  } catch (error) {
    console.error('Error suggesting competitors:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analysis/translate-categories
 * Translate category names from one language to another
 */
router.post('/translate-categories', async (req, res) => {
  try {
    const { categories, sourceLanguage, targetLanguage } = req.body;

    if (!categories || categories.length === 0) {
      return res.status(400).json({ error: 'Categories array is required' });
    }

    if (!sourceLanguage || !targetLanguage) {
      return res.status(400).json({ error: 'Source and target languages are required' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const translations = await translateCategories(categories, sourceLanguage, targetLanguage, geminiApiKey);

    res.json({
      sourceLanguage,
      targetLanguage,
      translations: categories.map((cat, idx) => ({
        original: cat,
        translated: translations[idx] || cat
      }))
    });
  } catch (error) {
    console.error('Error translating categories:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analysis/translate-templates
 * Translate question templates to a target language using AI
 * Uses Gemini 2.5 Flash Lite for fast, natural translations
 */
router.post('/translate-templates', async (req, res) => {
  try {
    const { templates, targetLanguage, entity } = req.body;

    if (!templates || !Array.isArray(templates) || templates.length === 0) {
      return res.status(400).json({ error: 'Templates array is required' });
    }

    if (!targetLanguage) {
      return res.status(400).json({ error: 'Target language is required' });
    }

    // Skip translation for English
    if (targetLanguage === 'English') {
      return res.json({ translations: templates });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const translations = await translateTemplates(templates, targetLanguage, entity || 'brand', geminiApiKey);

    res.json({
      targetLanguage,
      translations
    });
  } catch (error) {
    console.error('Error translating templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analysis/preview-questions
 * Preview questions that will be asked for a given configuration
 * If a language is specified (other than English), questions are translated
 */
router.post('/preview-questions', async (req, res) => {
  try {
    const { entity, category, competitors, language } = req.body;

    if (!entity || !category) {
      return res.status(400).json({ error: 'Entity and category are required' });
    }

    // Generate questions in English first
    let questions = generateAllQuestions({
      entity,
      category,
      competitors: competitors || []
    });

    // Translate if language is specified and not English
    if (language && language !== 'English') {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        questions = await translateQuestions(questions, language, geminiApiKey);
      } else {
        console.warn('⚠️ No Gemini API key - skipping translation');
      }
    }

    const totalCount = getTotalQuestionCount(questions);

    res.json({
      questions,
      totalCount,
      language: language || 'English'
    });
  } catch (error) {
    console.error('Error previewing questions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analysis/start
 * Start a new analysis
 */
router.post('/start', async (req, res) => {
  try {
    const {
      entity,
      category,
      competitors,
      countries,
      languages,
      questions // User can provide modified questions
    } = req.body;

    // Validation
    if (!entity || !category) {
      return res.status(400).json({ error: 'Entity and category are required' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!geminiApiKey || !openaiApiKey) {
      return res.status(500).json({ error: 'API keys not configured. Please set GEMINI_API_KEY and OPENAI_API_KEY in .env file' });
    }

    // Generate or use provided questions
    const finalQuestions = questions || generateAllQuestions({
      entity,
      category,
      competitors: competitors || []
    });

    const totalQuestions = getTotalQuestionCount(finalQuestions);

    // Create report record
    const reportId = uuidv4();
    const reportData = {
      id: reportId,
      entity,
      category,
      competitors: competitors || [],
      countries: countries || [],
      languages: languages || [],
      totalQuestions
    };

    Report.create(reportData);

    // Save configuration
    Object.entries(finalQuestions).forEach(([analysisType, questionList]) => {
      Report.saveConfiguration(reportId, analysisType, questionList);
    });

    // Start analysis in background
    const config = {
      entity,
      category,
      competitors: competitors || [],
      countries: countries || [],
      languages: languages || []
    };

    // Run analysis asynchronously
    runAnalysis(reportId, finalQuestions, config, geminiApiKey, openaiApiKey)
      .catch(error => {
        console.error('Analysis failed:', error);
        Report.updateStatus(reportId, 'failed', null, error.message);
      });

    res.json({
      reportId,
      status: 'processing',
      message: 'Analysis started successfully'
    });
  } catch (error) {
    console.error('Error starting analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/analysis/start-multi-market
 * Start a new multi-market, multi-category analysis
 * This is the V2.19 enhanced analysis that handles:
 * - Multiple markets (country-language combinations)
 * - Multiple category families with linked translations
 * - Market-specific competitor lists
 * - Custom questions per market and category
 */
router.post('/start-multi-market', async (req, res) => {
  try {
    const {
      entity,
      markets,
      categoryFamilies,
      competitors,
      reputationQuestions,
      categoryQuestions
    } = req.body;

    // Validation
    if (!entity) {
      return res.status(400).json({ error: 'Entity is required' });
    }

    if (!markets || markets.length === 0) {
      return res.status(400).json({ error: 'At least one market is required' });
    }

    if (!categoryFamilies || categoryFamilies.length === 0) {
      return res.status(400).json({ error: 'At least one category is required' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!geminiApiKey || !openaiApiKey) {
      return res.status(500).json({
        error: 'API keys not configured. Please set GEMINI_API_KEY and OPENAI_API_KEY in .env file'
      });
    }

    // Get primary market for backward compatibility
    const primaryMarket = markets.find(m => m.isPrimary) || markets[0];
    const primaryCategory = categoryFamilies[0];
    const primaryCategoryName = primaryCategory?.translations?.[primaryMarket.code]?.name ||
                                primaryCategory?.canonical_name ||
                                'products';

    // Get primary market competitors for backward compatibility
    const primaryCompetitors = competitors?.[primaryCategory?.id]?.[primaryMarket.code] || [];

    // Calculate total questions
    let totalQuestions = 0;
    markets.forEach(market => {
      const repQuestions = reputationQuestions?.[market.code] || [];
      totalQuestions += repQuestions.length;

      categoryFamilies.forEach(cat => {
        const catQuestions = categoryQuestions?.[market.code]?.[cat.id] || {};
        totalQuestions += (catQuestions.visibility?.length || 0);
        totalQuestions += (catQuestions.competitive?.length || 0);
      });
    });

    // Create report record
    const reportId = uuidv4();
    const reportData = {
      id: reportId,
      entity,
      category: primaryCategoryName,
      competitors: primaryCompetitors,
      countries: markets.map(m => m.country),
      languages: [...new Set(markets.map(m => m.language))],
      totalQuestions
    };

    Report.create(reportData);

    // Save multi-market data
    Report.saveMarkets(reportId, markets);
    Report.saveCategoryFamilies(reportId, categoryFamilies);
    if (competitors) {
      Report.saveMarketCompetitors(reportId, competitors);
    }

    // Build full config for multi-market orchestrator
    const multiMarketConfig = {
      entity,
      markets,
      categoryFamilies,
      competitors: competitors || {},
      reputationQuestions: reputationQuestions || {},
      categoryQuestions: categoryQuestions || {}
    };

    console.log(`📊 Starting multi-market analysis for "${entity}"`);
    console.log(`   Markets: ${markets.map(m => m.code).join(', ')}`);
    console.log(`   Categories: ${categoryFamilies.map(cf => cf.canonical_name).join(', ')}`);
    console.log(`   Total questions: ${totalQuestions}`);

    // DETAILED LOGGING: Show what categoryQuestions were received from frontend
    console.log('\n📋 ========== CATEGORY QUESTIONS RECEIVED FROM FRONTEND ==========');
    if (categoryQuestions && Object.keys(categoryQuestions).length > 0) {
      for (const marketCode of Object.keys(categoryQuestions)) {
        console.log(`\n  🌍 Market: ${marketCode}`);
        const marketQuestions = categoryQuestions[marketCode];
        if (marketQuestions && typeof marketQuestions === 'object') {
          for (const catId of Object.keys(marketQuestions)) {
            const catQ = marketQuestions[catId] || {};
            console.log(`     📂 Category "${catId}":`);
            console.log(`        - Visibility: ${catQ.visibility?.length || 0} questions`);
            console.log(`        - Competitive: ${catQ.competitive?.length || 0} questions`);
            if (catQ.competitive && catQ.competitive.length > 0) {
              catQ.competitive.slice(0, 3).forEach((q, i) => {
                console.log(`          [${i}] ${q.id}: "${(q.question || '').substring(0, 60)}..."`);
              });
              if (catQ.competitive.length > 3) {
                console.log(`          ... and ${catQ.competitive.length - 3} more`);
              }
            }
          }
        } else {
          console.log(`     ⚠️ Market questions is not an object: ${typeof marketQuestions}`);
        }
      }
    } else {
      console.log('  ⚠️ categoryQuestions is EMPTY or undefined!');
    }
    console.log('========== END CATEGORY QUESTIONS RECEIVED ==========\n');

    // Run multi-market analysis asynchronously
    runMultiMarketAnalysis(reportId, multiMarketConfig, geminiApiKey, openaiApiKey)
      .catch(error => {
        console.error('Multi-market analysis failed:', error);
        Report.updateStatus(reportId, 'failed', null, error.message);
      });

    res.json({
      reportId,
      status: 'processing',
      message: 'Multi-market analysis started successfully',
      config: {
        markets: markets.length,
        categories: categoryFamilies.length,
        totalQuestions
      }
    });
  } catch (error) {
    console.error('Error starting multi-market analysis:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analysis/progress/:reportId
 * Server-Sent Events endpoint for real-time progress updates
 */
router.get('/progress/:reportId', (req, res) => {
  const { reportId } = req.params;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', reportId })}\n\n`);

  // Store connection
  activeConnections.set(reportId, res);

  // Handle client disconnect
  req.on('close', () => {
    activeConnections.delete(reportId);
  });
});

/**
 * Helper function to send progress update via SSE
 */
export function sendProgressUpdate(reportId, data) {
  const connection = activeConnections.get(reportId);
  if (connection) {
    connection.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

/**
 * Helper function to close SSE connection
 */
export function closeProgressConnection(reportId) {
  const connection = activeConnections.get(reportId);
  if (connection) {
    connection.end();
    activeConnections.delete(reportId);
  }
}

export default router;
