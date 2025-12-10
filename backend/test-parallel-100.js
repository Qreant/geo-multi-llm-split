/**
 * Test script to fire 100 questions simultaneously to both OpenAI and Gemini
 * No rate limiting - test maximum parallelism
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Generate 100 simple questions
function generateQuestions(count) {
  const questions = [];
  const topics = ['Tesla', 'Apple', 'Google', 'Microsoft', 'Amazon', 'Samsung', 'BMW', 'Mercedes', 'Toyota', 'Nike'];
  const questionTypes = [
    'What are the strengths of',
    'What are the weaknesses of',
    'How does the market perceive',
    'What is the reputation of',
    'What are customers saying about',
    'How competitive is',
    'What are the main products of',
    'Who are the competitors of',
    'What innovations has',
    'What is the market share of'
  ];

  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length];
    const qType = questionTypes[i % questionTypes.length];
    questions.push(`${qType} ${topic}? Respond with a brief JSON object with keys: summary, points (array of 3 items).`);
  }
  return questions;
}

// Call Gemini without rate limiting
async function callGeminiNoLimit(prompt, questionNum) {
  const start = Date.now();
  try {
    const response = await axios.post(GEMINI_ENDPOINT, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500
      }
    }, {
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const elapsed = Date.now() - start;
    return { success: true, questionNum, elapsed, provider: 'Gemini' };
  } catch (error) {
    const elapsed = Date.now() - start;
    return {
      success: false,
      questionNum,
      elapsed,
      provider: 'Gemini',
      error: error.response?.status || error.message
    };
  }
}

// Call OpenAI without rate limiting
async function callOpenAINoLimit(prompt, questionNum) {
  const start = Date.now();
  try {
    const response = await axios.post(OPENAI_ENDPOINT, {
      model: 'gpt-4o-2024-11-20',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Respond with JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const elapsed = Date.now() - start;
    return { success: true, questionNum, elapsed, provider: 'OpenAI' };
  } catch (error) {
    const elapsed = Date.now() - start;
    return {
      success: false,
      questionNum,
      elapsed,
      provider: 'OpenAI',
      error: error.response?.status || error.message
    };
  }
}

async function runTest() {
  console.log('🚀 Starting parallel API test - 100 questions x 2 LLMs = 200 total requests');
  console.log('=' .repeat(70));

  if (!GEMINI_API_KEY || !OPENAI_API_KEY) {
    console.error('❌ Missing API keys');
    process.exit(1);
  }

  const questions = generateQuestions(100);
  console.log(`\n📝 Generated ${questions.length} questions`);

  // Create all promises - 100 for Gemini, 100 for OpenAI
  console.log('\n🔥 Firing ALL 200 requests simultaneously...\n');
  const startTime = Date.now();

  const geminiPromises = questions.map((q, i) => callGeminiNoLimit(q, i + 1));
  const openaiPromises = questions.map((q, i) => callOpenAINoLimit(q, i + 1));

  // Wait for all to complete
  const [geminiResults, openaiResults] = await Promise.all([
    Promise.all(geminiPromises),
    Promise.all(openaiPromises)
  ]);

  const totalTime = Date.now() - startTime;

  // Analyze results
  console.log('\n' + '=' .repeat(70));
  console.log('📊 RESULTS');
  console.log('=' .repeat(70));

  // Gemini stats
  const geminiSuccess = geminiResults.filter(r => r.success).length;
  const geminiFailed = geminiResults.filter(r => !r.success);
  const geminiAvgTime = geminiResults.filter(r => r.success).reduce((a, b) => a + b.elapsed, 0) / geminiSuccess || 0;

  console.log('\n🔷 GEMINI:');
  console.log(`   Success: ${geminiSuccess}/100`);
  console.log(`   Failed: ${geminiFailed.length}/100`);
  console.log(`   Avg response time: ${Math.round(geminiAvgTime)}ms`);

  if (geminiFailed.length > 0) {
    const errorCounts = {};
    geminiFailed.forEach(f => {
      const err = String(f.error);
      errorCounts[err] = (errorCounts[err] || 0) + 1;
    });
    console.log('   Errors:');
    Object.entries(errorCounts).forEach(([err, count]) => {
      console.log(`      ${err}: ${count}`);
    });
  }

  // OpenAI stats
  const openaiSuccess = openaiResults.filter(r => r.success).length;
  const openaiFailed = openaiResults.filter(r => !r.success);
  const openaiAvgTime = openaiResults.filter(r => r.success).reduce((a, b) => a + b.elapsed, 0) / openaiSuccess || 0;

  console.log('\n🔶 OPENAI:');
  console.log(`   Success: ${openaiSuccess}/100`);
  console.log(`   Failed: ${openaiFailed.length}/100`);
  console.log(`   Avg response time: ${Math.round(openaiAvgTime)}ms`);

  if (openaiFailed.length > 0) {
    const errorCounts = {};
    openaiFailed.forEach(f => {
      const err = String(f.error);
      errorCounts[err] = (errorCounts[err] || 0) + 1;
    });
    console.log('   Errors:');
    Object.entries(errorCounts).forEach(([err, count]) => {
      console.log(`      ${err}: ${count}`);
    });
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`⏱️  TOTAL TIME: ${(totalTime / 1000).toFixed(2)} seconds`);
  console.log(`📈 Throughput: ${Math.round(200 / (totalTime / 1000))} requests/second`);
  console.log('=' .repeat(70));
}

runTest().catch(console.error);
