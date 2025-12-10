import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

console.log('🔑 API Keys loaded:');
console.log(`   Gemini: ${GEMINI_API_KEY.substring(0, 20)}...`);
console.log(`   OpenAI: ${OPENAI_API_KEY.substring(0, 20)}...`);

async function testGemini() {
  console.log('\n📡 Testing Gemini API...');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

  try {
    const response = await axios.post(url, {
      contents: [{
        parts: [{ text: 'What is 2+2? Reply with just the number.' }]
      }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 100
      }
    }, {
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.candidates) {
      console.log('✅ Gemini Success!');
      console.log('   Response:', response.data.candidates[0].content.parts[0].text);
      return true;
    }
  } catch (error) {
    console.log('❌ Gemini Error:');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   Message:', error.message);
    }
    return false;
  }
}

async function testGPT5() {
  console.log('\n📡 Testing GPT-5 API...');
  const url = 'https://api.openai.com/v1/responses';

  try {
    const response = await axios.post(url, {
      model: 'gpt-5-mini',
      tools: [{ type: 'web_search' }],
      input: 'What is 2+2? Reply with just the number.'
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Extract text from GPT-5 response format
    if (response.data.output && Array.isArray(response.data.output)) {
      const messageOutput = response.data.output.find(o => o.type === 'message');
      if (messageOutput && messageOutput.content && messageOutput.content[0]) {
        const text = messageOutput.content[0].text;
        console.log('✅ GPT-5 Success!');
        console.log('   Response:', text);
        return true;
      }
    }

    console.log('⚠️  Unexpected response structure');
    return false;
  } catch (error) {
    console.log('❌ GPT-5 Error:');
    console.log('   Error type:', error.constructor.name);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('   No response received (timeout or network error)');
    } else {
      console.log('   Message:', error.message);
    }
    return false;
  }
}

(async () => {
  const geminiWorks = await testGemini();
  const gpt5Works = await testGPT5();

  console.log('\n📊 Test Results:');
  console.log(`   Gemini: ${geminiWorks ? '✅ Working' : '❌ Failed'}`);
  console.log(`   GPT-5: ${gpt5Works ? '✅ Working' : '❌ Failed'}`);
})();
