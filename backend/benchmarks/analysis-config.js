/**
 * Analysis Benchmark Configuration
 * Configuration for testing new OpenAI models on main analysis prompts
 */

export const ANALYSIS_BENCHMARK_CONFIG = {
  // Models to test (GPT-4o as baseline + new models)
  models: [
    {
      id: 'gpt-4o',
      provider: 'openai',
      model: 'gpt-4o-2024-11-20',
      description: 'Current baseline - best accuracy'
    },
    {
      id: 'gpt-4.1-nano',
      provider: 'openai',
      model: 'gpt-4.1-nano',
      description: 'Ultra-cheap, fastest inference (96% cheaper)'
    },
    {
      id: 'gpt-4.1-mini',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      description: 'Mid-tier efficiency model (84% cheaper)'
    },
    {
      id: 'gpt-5-nano',
      provider: 'openai',
      model: 'gpt-5-nano',
      description: 'GPT-5 ultra-cheap variant (98% cheaper)'
    },
    {
      id: 'gpt-5-mini',
      provider: 'openai',
      model: 'gpt-5-mini',
      description: 'GPT-5 balanced variant (80% cheaper)'
    }
  ],

  // Analysis types to test
  analysisTypes: ['reputation', 'visibility', 'competitive', 'category'],

  // Number of questions per analysis type per run
  questionsPerType: {
    reputation: 2,
    visibility: 2,
    competitive: 2,
    category: 1
  },

  // Test configuration
  warmupRuns: 1,
  testRuns: 3,

  // API configuration
  temperature: 0.1,
  timeout: 120000, // 2 minutes per request

  // Retry configuration
  maxRetries: 2,
  retryDelayMs: 2000,

  // Token limits per model (output tokens)
  // Note: GPT-5 models use reasoning tokens which count against max_completion_tokens
  // so they need higher limits to leave room for actual output after reasoning
  tokenLimits: {
    'gpt-4o': 16384,
    'gpt-4.1-nano': 16384,
    'gpt-4.1-mini': 16384,
    'gpt-5-nano': 32768,  // Higher for reasoning tokens overhead
    'gpt-5-mini': 32768   // Higher for reasoning tokens overhead
  },

  // Pricing per 1M tokens (USD)
  pricing: {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4.1-nano': { input: 0.10, output: 0.40 },
    'gpt-4.1-mini': { input: 0.40, output: 1.60 },
    'gpt-5-nano': { input: 0.05, output: 0.40 },
    'gpt-5-mini': { input: 0.25, output: 2.00 }
  },

  // Test data configuration
  testData: {
    brand: 'Nike',
    competitors: ['Adidas', 'Puma', 'New Balance', 'Under Armour'],
    categories: ['Running Shoes', 'Athletic Apparel', 'Sports Equipment'],
    markets: [
      { country: 'United States', language: 'English' },
      { country: 'United Kingdom', language: 'English' }
    ]
  }
};

// Failure reason categories
export const FAILURE_REASONS = {
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  SERVER_ERROR: 'server_error',
  PARSE_ERROR: 'parse_error',
  VALIDATION_ERROR: 'validation_error',
  AUTH_ERROR: 'auth_error',
  TOKEN_LIMIT: 'token_limit',
  MODEL_NOT_FOUND: 'model_not_found',
  UNKNOWN: 'unknown'
};

// API endpoint
export const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId) {
  return ANALYSIS_BENCHMARK_CONFIG.models.find(m => m.id === modelId);
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(modelId, inputTokens, outputTokens) {
  const pricing = ANALYSIS_BENCHMARK_CONFIG.pricing[modelId];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}
