const axios = require('axios');

const API_URL = 'http://localhost:3001/api';

async function runTest() {
  console.log('🧪 Starting Multi-Market End-to-End Test\n');
  console.log('='.repeat(50));

  const testConfig = {
    entity: 'Nike',
    markets: [
      { country: 'United States', language: 'English', code: 'en-US', isPrimary: true },
      { country: 'France', language: 'French', code: 'fr-FR', isPrimary: false }
    ],
    categoryFamilies: [
      {
        id: 'running_shoes',
        canonical_name: 'Running Shoes',
        isSelected: true,
        translations: {
          'en-US': { name: 'Running Shoes' },
          'fr-FR': { name: 'Chaussures de course' }
        }
      },
      {
        id: 'sportswear',
        canonical_name: 'Sportswear',
        isSelected: true,
        translations: {
          'en-US': { name: 'Sportswear' },
          'fr-FR': { name: 'Vêtements de sport' }
        }
      }
    ],
    competitors: {
      'running_shoes': {
        'en-US': ['Adidas', 'New Balance', 'ASICS'],
        'fr-FR': ['Adidas', 'New Balance', 'ASICS']
      },
      'sportswear': {
        'en-US': ['Adidas', 'Under Armour', 'Puma'],
        'fr-FR': ['Adidas', 'Puma', 'Decathlon']
      }
    },
    reputationQuestions: {
      'en-US': [
        { id: 'REP_US_1', question: 'Is Nike good?' },
        { id: 'REP_US_2', question: 'Is Nike worth the price?' }
      ],
      'fr-FR': [
        { id: 'REP_FR_1', question: "Est-ce que Nike c'est bien ?" },
        { id: 'REP_FR_2', question: 'Nike vaut-il son prix ?' }
      ]
    },
    categoryQuestions: {
      'en-US': {
        'running_shoes': {
          visibility: [
            { id: 'VIS_US_RS_1', question: 'Best running shoes?' },
            { id: 'VIS_US_RS_2', question: 'Top running shoe brands?' }
          ],
          competitive: [
            { id: 'COMP_US_RS_1', question: 'Nike vs Adidas for running shoes?' }
          ]
        },
        'sportswear': {
          visibility: [
            { id: 'VIS_US_SW_1', question: 'Best sportswear brands?' }
          ],
          competitive: [
            { id: 'COMP_US_SW_1', question: 'Nike vs Under Armour for sportswear?' }
          ]
        }
      },
      'fr-FR': {
        'running_shoes': {
          visibility: [
            { id: 'VIS_FR_RS_1', question: 'Meilleures chaussures de course ?' },
            { id: 'VIS_FR_RS_2', question: 'Meilleures marques de running ?' }
          ],
          competitive: [
            { id: 'COMP_FR_RS_1', question: 'Nike ou Adidas pour le running ?' }
          ]
        },
        'sportswear': {
          visibility: [
            { id: 'VIS_FR_SW_1', question: 'Meilleures marques de vêtements de sport ?' }
          ],
          competitive: [
            { id: 'COMP_FR_SW_1', question: 'Nike ou Adidas pour les vêtements de sport ?' }
          ]
        }
      }
    }
  };

  console.log('\n📋 Test Configuration:');
  console.log('   Entity: ' + testConfig.entity);
  console.log('   Markets: ' + testConfig.markets.map(m => m.code).join(', '));
  console.log('   Categories: ' + testConfig.categoryFamilies.map(c => c.canonical_name).join(', '));

  // Count questions
  let totalQuestions = 0;
  testConfig.markets.forEach(m => {
    totalQuestions += (testConfig.reputationQuestions[m.code] || []).length;
    testConfig.categoryFamilies.forEach(cat => {
      const catQ = testConfig.categoryQuestions[m.code]?.[cat.id];
      totalQuestions += (catQ?.visibility?.length || 0) + (catQ?.competitive?.length || 0);
    });
  });
  console.log('   Total Questions: ' + totalQuestions);

  const startTime = Date.now();

  try {
    // Start analysis
    console.log('\n🚀 Starting multi-market analysis...');
    const startResponse = await axios.post(API_URL + '/analysis/start-multi-market', testConfig);

    const reportId = startResponse.data.reportId;
    console.log('   Report ID: ' + reportId);
    console.log('   Status: ' + startResponse.data.status);

    // Poll for completion
    console.log('\n⏳ Waiting for analysis to complete...');
    let completed = false;
    let lastProgress = 0;

    while (!completed) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5s

      const statusResponse = await axios.get(API_URL + '/reports/' + reportId);
      const report = statusResponse.data;

      if (report.progress !== lastProgress) {
        console.log('   Progress: ' + report.progress + '%');
        lastProgress = report.progress;
      }

      if (report.status === 'completed') {
        completed = true;
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('\n✅ Analysis completed in ' + duration + 's');

        // Verify multi-market data
        console.log('\n📊 Verifying report data...');
        console.log('   isMultiMarket: ' + report.isMultiMarket);
        console.log('   Markets found: ' + (report.markets?.length || 0));
        console.log('   Category families: ' + (report.categoryFamilies?.length || 0));

        if (report.marketResults) {
          console.log('\n📈 Market Results:');
          Object.entries(report.marketResults).forEach(([marketCode, data]) => {
            console.log('\n   ' + marketCode + ':');
            console.log('     - Reputation: ' + (data.reputation ? '✓' : '✗'));
            if (data.categories) {
              Object.entries(data.categories).forEach(([catId, catData]) => {
                console.log('     - ' + catId + ':');
                console.log('       • Visibility: ' + (catData.visibility ? '✓' : '✗'));
                console.log('       • Competitive: ' + (catData.competitive ? '✓' : '✗'));
              });
            }
          });
        }

        console.log('\n🎉 TEST PASSED - Report ID: ' + reportId);
        console.log('   View at: http://localhost:5173/report/' + reportId);

      } else if (report.status === 'failed') {
        console.log('\n❌ Analysis failed: ' + report.error_message);
        break;
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
  }
}

runTest();
