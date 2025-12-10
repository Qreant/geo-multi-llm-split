/**
 * Test script for brand matching functionality
 * Tests two scenarios:
 * 1. Electric vehicles - should group Tesla Model 3, Model Y under Tesla
 * 2. Phones - should group iPhone 15, Galaxy S24 under Apple, Samsung
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

// Simple visibility questions for testing - format: { analysisType: [questions] }
const evQuestions = {
  visibility: [
    { id: 'VIS_TEST_1', type: 'visibility', question: 'What are the best electric vehicles in 2024?' },
    { id: 'VIS_TEST_2', type: 'visibility', question: 'Which electric car should I buy?' },
    { id: 'VIS_TEST_3', type: 'visibility', question: 'Top rated EVs for families?' }
  ]
};

const phoneQuestions = {
  visibility: [
    { id: 'VIS_TEST_1', type: 'visibility', question: 'What is the best smartphone in 2024?' },
    { id: 'VIS_TEST_2', type: 'visibility', question: 'Which phone has the best camera?' },
    { id: 'VIS_TEST_3', type: 'visibility', question: 'Top phones for business professionals?' }
  ]
};

async function runTest(name, entity, category, competitors, questions) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${name}`);
  console.log(`Entity: ${entity}, Category: ${category}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // Start analysis
    console.log('Starting analysis...');
    const startResponse = await axios.post(`${API_BASE}/analysis/start`, {
      entity,
      category,
      competitors,
      countries: [],
      languages: [],
      questions
    });

    const reportId = startResponse.data.reportId;
    console.log(`Report ID: ${reportId}`);

    // Poll for completion
    console.log('Waiting for analysis to complete...');
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    while (!completed && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await axios.get(`${API_BASE}/reports/${reportId}`);
      const status = statusResponse.data.report.status;

      if (status === 'completed') {
        completed = true;
        console.log('Analysis completed!');

        // Extract visibility data
        const report = statusResponse.data;
        const visibilityData = report.analysis?.visibility;

        if (visibilityData) {
          console.log('\n--- RAW ENTITIES RANKING ---');
          const rawRankings = visibilityData.entities_ranking || [];
          rawRankings.slice(0, 8).forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.name} - SOV: ${(e.sov * 100).toFixed(1)}%, Visibility: ${(e.visibility * 100).toFixed(1)}%`);
          });

          console.log('\n--- BRAND FAMILY RANKING ---');
          const brandFamilies = visibilityData.brand_family_ranking;
          if (brandFamilies && brandFamilies.length > 0) {
            brandFamilies.slice(0, 8).forEach((b, i) => {
              const variantCount = b.variants?.length || 1;
              console.log(`  ${i + 1}. ${b.name} (${variantCount} variants) - SOV: ${(b.sov * 100).toFixed(1)}%, Visibility: ${(b.visibility * 100).toFixed(1)}%`);
              if (b.variants && b.variants.length > 1) {
                b.variants.forEach(v => {
                  console.log(`      └─ ${v.name}: SOV ${(v.sov * 100).toFixed(1)}%`);
                });
              }
            });

            console.log('\n--- BRAND GROUPING METADATA ---');
            const metadata = visibilityData.brand_grouping_metadata;
            if (metadata) {
              console.log(`  Enabled: ${metadata.enabled}`);
              console.log(`  Confidence: ${metadata.confidence}`);
              console.log(`  Total Brands: ${metadata.total_brands}`);
              console.log(`  Total Variants: ${metadata.total_variants}`);
              console.log(`  Target Matches: ${JSON.stringify(metadata.target_matches)}`);
            }
          } else {
            console.log('  No brand family ranking available (brand grouping may have failed)');
            if (visibilityData.brand_grouping_metadata) {
              console.log(`  Reason: ${JSON.stringify(visibilityData.brand_grouping_metadata)}`);
            }
          }
        } else {
          console.log('No visibility data found in report');
        }

      } else if (status === 'failed') {
        console.log('Analysis failed!');
        completed = true;
      } else {
        process.stdout.write('.');
        attempts++;
      }
    }

    if (!completed) {
      console.log('\nTest timed out');
    }

    return reportId;
  } catch (error) {
    console.error('Test error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

async function main() {
  console.log('🚗 BRAND MATCHING TEST SUITE 📱\n');

  // Test 1: Electric Vehicles
  await runTest(
    'Electric Vehicles',
    'Tesla',
    'electric vehicle',
    ['BYD', 'Rivian', 'Hyundai'],
    evQuestions
  );

  // Test 2: Phones
  await runTest(
    'Smartphones',
    'Apple',
    'smartphone',
    ['Samsung', 'Google', 'OnePlus'],
    phoneQuestions
  );

  console.log('\n\n✅ All tests completed!');
}

main();
