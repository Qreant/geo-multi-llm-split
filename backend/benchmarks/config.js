/**
 * Benchmark Configuration
 * Configuration constants for source classification benchmark testing
 */

export const BENCHMARK_CONFIG = {
  // Models to test
  models: [
    {
      id: 'gemini-flash',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      description: 'High accuracy, fast'
    },
    {
      id: 'gemini-flash-lite',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      description: 'Current default, cheapest Gemini'
    },
    {
      id: 'gpt-4o',
      provider: 'openai',
      model: 'gpt-4o-2024-11-20',
      description: 'Best accuracy'
    },
    {
      id: 'gpt-4o-mini',
      provider: 'openai',
      model: 'gpt-4o-mini',
      description: 'Good balance of cost/performance'
    },
    {
      id: 'gpt-5-nano',
      provider: 'openai',
      model: 'gpt-5-nano',
      description: 'GPT-5 ultra-cheap variant (98% cheaper than gpt-4o)'
    },
    {
      id: 'gpt-5-mini',
      provider: 'openai',
      model: 'gpt-5-mini',
      description: 'GPT-5 balanced variant (80% cheaper than gpt-4o)'
    }
  ],

  // Batch sizes to test (aggressive range)
  batchSizes: [50, 100, 200, 500],

  // Test run configuration
  warmupRuns: 2,      // Runs to skip for timing (warm up caches)
  testRuns: 3,        // Runs for statistical significance

  // API configuration
  temperature: 0.1,   // Low temperature for consistent classification

  // Timeout per batch size (ms)
  timeouts: {
    50: 60000,     // 60 seconds
    100: 90000,    // 90 seconds
    200: 120000,   // 2 minutes
    500: 180000    // 3 minutes
  },

  // Retry configuration
  maxRetries: 2,
  retryDelayMs: 2000,
  retryBackoffMultiplier: 2,

  // Token limits per model (output tokens)
  // Note: GPT-5 models use reasoning tokens which count against max_completion_tokens
  // so they need higher limits to leave room for actual output after reasoning
  tokenLimits: {
    'gemini-flash': 65000,
    'gemini-flash-lite': 65000,
    'gpt-4o': 16384,
    'gpt-4o-mini': 16384,
    'gpt-5-nano': 32768,  // Higher for reasoning tokens overhead
    'gpt-5-mini': 32768   // Higher for reasoning tokens overhead
  },

  // Pricing per 1M tokens (USD)
  pricing: {
    'gemini-flash': { input: 0.075, output: 0.30 },
    'gemini-flash-lite': { input: 0.0375, output: 0.15 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-5-nano': { input: 0.05, output: 0.40 },
    'gpt-5-mini': { input: 0.25, output: 2.00 }
  }
};

// Approved source types (must match sourceClassifier.js)
export const APPROVED_SOURCE_TYPES = [
  'Corporate Blogs & Content',
  'Journalism',
  'Government/NGO',
  'Aggregators / Encyclopedic',
  'Academic/Research',
  'Owned Media',
  'Competitor Media',
  'Paid/Advertorial',
  'Social / UGC',
  'Press Release'
];

// Failure reason categories
export const FAILURE_REASONS = {
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  SERVER_ERROR: 'server_error',
  PARSE_ERROR: 'parse_error',
  VALIDATION_ERROR: 'validation_error',
  AUTH_ERROR: 'auth_error',
  TOKEN_LIMIT: 'token_limit',
  UNKNOWN: 'unknown'
};

// API endpoints
export const API_ENDPOINTS = {
  gemini: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions'
};

/**
 * Get timeout for a given batch size
 */
export function getTimeout(batchSize) {
  return BENCHMARK_CONFIG.timeouts[batchSize] || 120000;
}

/**
 * Get model configuration by ID
 */
export function getModelConfig(modelId) {
  return BENCHMARK_CONFIG.models.find(m => m.id === modelId);
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(modelId, inputTokens, outputTokens) {
  const pricing = BENCHMARK_CONFIG.pricing[modelId];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}
