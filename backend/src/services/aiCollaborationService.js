/**
 * AI Collaboration Service
 * Generates tailored collaboration recommendations using Gemini
 * Extracts high-authority domains and suggests pitch angles
 */

import { callGeminiForJSON } from './llmService.js';

/**
 * Generate AI-powered collaboration recommendations for an opportunity
 * @param {Object} opportunity - The PR insight opportunity
 * @param {Object} context - Additional context (entity, competitors, sources)
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} - Collaboration recommendations
 */
export async function generateCollaborationRecommendations(opportunity, context, apiKey) {
  const { entity, allSources = [] } = context;

  // Extract high-authority sources (Journalism, Academic, Government/NGO)
  const highAuthoritySources = extractHighAuthoritySources(allSources);

  // Build prompt for Gemini
  const prompt = buildCollaborationPrompt(opportunity, entity, highAuthoritySources);

  try {
    console.log(`   🤖 Generating AI collaboration recommendations for: ${opportunity.title}`);

    const response = await callGeminiForJSON(prompt, apiKey);
    const recommendations = parseCollaborationResponse(response.text);

    console.log(`   ✅ Generated ${recommendations.collaborations?.length || 0} collaboration suggestions`);

    return recommendations;
  } catch (error) {
    console.error(`   ❌ Failed to generate collaboration recommendations: ${error.message}`);
    return {
      collaborations: [],
      pitch_strategy: null,
      error: error.message
    };
  }
}

/**
 * Batch generate collaboration recommendations for multiple opportunities
 * @param {Array} opportunities - Array of PR insight opportunities
 * @param {Object} context - Additional context
 * @param {string} apiKey - Gemini API key
 * @param {number} limit - Maximum number of opportunities to process (default: 5)
 * @returns {Promise<Map>} - Map of opportunity ID to recommendations
 */
export async function batchGenerateCollaborations(opportunities, context, apiKey, limit = 5) {
  const results = new Map();

  // Filter to Critical and Strategic opportunities, limit count
  const topOpportunities = opportunities
    .filter(opp => opp.priority?.tier === 'Critical' || opp.priority?.tier === 'Strategic')
    .slice(0, limit);

  console.log(`📊 Generating AI collaboration recommendations for ${topOpportunities.length} top opportunities...`);

  for (const opportunity of topOpportunities) {
    const recommendations = await generateCollaborationRecommendations(opportunity, context, apiKey);
    results.set(opportunity.id, recommendations);

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Extract high-authority sources from all sources
 */
function extractHighAuthoritySources(sources) {
  const highAuthorityTypes = ['Journalism', 'Academic/Research', 'Government/NGO'];

  return sources
    .filter(source => highAuthorityTypes.includes(source.source_type))
    .map(source => ({
      url: source.url,
      domain: source.domain,
      title: source.title,
      source_type: source.source_type
    }))
    .slice(0, 20); // Limit to prevent token overflow
}

/**
 * Build the collaboration recommendation prompt
 */
function buildCollaborationPrompt(opportunity, entity, highAuthoritySources) {
  const sourcesList = highAuthoritySources.length > 0
    ? highAuthoritySources.map(s => `- ${s.domain} (${s.source_type}): ${s.title || 'No title'}`).join('\n')
    : 'No high-authority sources identified';

  return `<INSTRUCTIONS>
You are a JSON-only assistant specializing in PR strategy and media relations.
Return ONLY valid JSON with no markdown, explanations, or additional text.
</INSTRUCTIONS>

TASK: Generate actionable collaboration recommendations to improve "${entity}"'s positioning based on this improvement opportunity.

OPPORTUNITY DETAILS:
- Title: ${opportunity.title}
- Description: ${opportunity.description || 'No description'}
- Type: ${opportunity.opportunity_type}
- Theme: ${opportunity.theme_category}
- Current State: ${JSON.stringify(opportunity.current_state || {})}
- Impact Score: ${opportunity.scores?.impact_score || 'N/A'} (${opportunity.scores?.impact_label || ''})
- Effort Score: ${opportunity.scores?.effort_score || 'N/A'} (${opportunity.scores?.effort_label || ''})
- Priority: ${opportunity.priority?.tier || 'N/A'}
- Recommended Actions: ${JSON.stringify(opportunity.recommended_actions || [])}

HIGH-AUTHORITY SOURCES IN THIS SPACE:
${sourcesList}

GENERATE JSON with this exact structure:
{
  "collaborations": [
    {
      "target_type": "Journalist|Academic|Industry Analyst|Influencer|Partner",
      "target_description": "Brief description of ideal collaboration target",
      "domains_to_target": ["example.com", "outlet.com"],
      "pitch_angle": "Specific angle for approaching this target",
      "talking_points": ["Key point 1", "Key point 2"],
      "expected_outcome": "What this collaboration could achieve",
      "approach_strategy": "How to initiate contact"
    }
  ],
  "pitch_strategy": {
    "primary_narrative": "Main story/narrative to push",
    "key_differentiators": ["What makes ${entity} unique point 1", "point 2"],
    "proof_points": ["Data/evidence to cite"],
    "timing_recommendations": "Best timing for outreach"
  },
  "content_ideas": [
    {
      "type": "Guest Article|Research Report|Case Study|Interview|Webinar",
      "title_suggestion": "Potential title",
      "target_publications": ["publication1", "publication2"],
      "key_takeaways": ["Takeaway 1", "Takeaway 2"]
    }
  ]
}

REQUIREMENTS:
1. Generate 3-5 collaboration suggestions tailored to the opportunity type
2. Focus on high-authority targets that can influence AI search visibility
3. Provide specific, actionable pitch angles (not generic advice)
4. Reference the high-authority sources when suggesting target domains
5. Keep descriptions under 100 characters each
6. Return ONLY valid JSON`;
}

/**
 * Parse and validate the collaboration response
 */
function parseCollaborationResponse(responseText) {
  try {
    // Handle if response is already an object
    if (typeof responseText === 'object') {
      return validateCollaborationStructure(responseText);
    }

    // Parse JSON string
    const parsed = JSON.parse(responseText);
    return validateCollaborationStructure(parsed);
  } catch (error) {
    console.error('   ⚠️  Failed to parse collaboration response:', error.message);
    return {
      collaborations: [],
      pitch_strategy: null,
      content_ideas: [],
      parse_error: error.message
    };
  }
}

/**
 * Validate and sanitize the collaboration structure
 */
function validateCollaborationStructure(data) {
  return {
    collaborations: Array.isArray(data.collaborations)
      ? data.collaborations.slice(0, 5).map(collab => ({
          target_type: collab.target_type || 'Unknown',
          target_description: truncate(collab.target_description, 100),
          domains_to_target: Array.isArray(collab.domains_to_target)
            ? collab.domains_to_target.slice(0, 5)
            : [],
          pitch_angle: truncate(collab.pitch_angle, 200),
          talking_points: Array.isArray(collab.talking_points)
            ? collab.talking_points.slice(0, 3).map(p => truncate(p, 100))
            : [],
          expected_outcome: truncate(collab.expected_outcome, 100),
          approach_strategy: truncate(collab.approach_strategy, 150)
        }))
      : [],
    pitch_strategy: data.pitch_strategy
      ? {
          primary_narrative: truncate(data.pitch_strategy.primary_narrative, 200),
          key_differentiators: Array.isArray(data.pitch_strategy.key_differentiators)
            ? data.pitch_strategy.key_differentiators.slice(0, 3).map(d => truncate(d, 80))
            : [],
          proof_points: Array.isArray(data.pitch_strategy.proof_points)
            ? data.pitch_strategy.proof_points.slice(0, 3).map(p => truncate(p, 100))
            : [],
          timing_recommendations: truncate(data.pitch_strategy.timing_recommendations, 100)
        }
      : null,
    content_ideas: Array.isArray(data.content_ideas)
      ? data.content_ideas.slice(0, 3).map(idea => ({
          type: idea.type || 'Article',
          title_suggestion: truncate(idea.title_suggestion, 100),
          target_publications: Array.isArray(idea.target_publications)
            ? idea.target_publications.slice(0, 3)
            : [],
          key_takeaways: Array.isArray(idea.key_takeaways)
            ? idea.key_takeaways.slice(0, 3).map(t => truncate(t, 80))
            : []
        }))
      : []
  };
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format collaboration recommendations for database storage
 */
export function formatCollaborationsForStorage(recommendations) {
  return JSON.stringify(recommendations);
}

/**
 * Parse stored collaboration recommendations from database
 */
export function parseStoredCollaborations(storedJson) {
  if (!storedJson) return null;
  try {
    return JSON.parse(storedJson);
  } catch {
    return null;
  }
}
