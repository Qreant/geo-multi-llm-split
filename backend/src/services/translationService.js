/**
 * Translation Service
 * Translates questions to target language using Gemini API
 */

import { callGemini, callGeminiForJSON } from './llmService.js';

const TRANSLATION_MODEL = 'gemini-2.5-flash-lite';

/**
 * Translate question templates to a target language
 * Uses Gemini 2.5 Flash Lite for fast, natural translations
 * @param {string[]} templates - Array of question templates with {{entity}} placeholders
 * @param {string} targetLanguage - Target language (e.g., "French", "German")
 * @param {string} entity - The entity name to use in examples
 * @param {string} apiKey - Gemini API key
 * @returns {string[]} Translated templates
 */
export async function translateTemplates(templates, targetLanguage, entity, apiKey) {
  if (!targetLanguage || targetLanguage === 'English') {
    return templates;
  }

  console.log(`\n🌐 Translating ${templates.length} templates to ${targetLanguage}...`);

  const prompt = `You are a native ${targetLanguage} speaker helping localize search queries.

Translate these English questions to natural, conversational ${targetLanguage}.

CRITICAL RULES:
1. Make each question sound NATURAL - like how a real ${targetLanguage} speaker would actually type into a search engine
2. Keep brand names and proper nouns in their original form (Nike, Adidas, Puma, etc.)
3. Adapt idioms and expressions to ${targetLanguage} equivalents - don't translate word-for-word
4. Use correct grammar, gender agreement, and natural sentence structures
5. Fix any awkward phrasing from the English originals
6. Return ONLY a JSON array of translated strings, nothing else

EXAMPLES of natural translations (English → French):
- "Is Puma good?" → "Est-ce que Puma c'est bien ?"
- "Best running shoes?" → "Quelles sont les meilleures chaussures de running ?"
- "Nike vs Adidas — which is better for sneakers?" → "Nike ou Adidas — lequel est meilleur pour les baskets ?"

INPUT QUESTIONS:
${JSON.stringify(templates, null, 2)}

Return ONLY a JSON array of translated strings in the same order:`;

  try {
    const response = await callGemini(prompt, apiKey, { model: TRANSLATION_MODEL });

    // Extract JSON array from response
    let responseText = response.trim();

    // Remove markdown code blocks if present
    responseText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const translated = JSON.parse(responseText);

    if (!Array.isArray(translated) || translated.length !== templates.length) {
      console.error('❌ Invalid translation response - array length mismatch');
      return templates;
    }

    console.log(`✅ Successfully translated ${templates.length} templates to ${targetLanguage}`);
    return translated;

  } catch (error) {
    console.error('❌ Template translation error:', error.message);
    return templates;
  }
}

/**
 * Translate an array of questions to target language
 * @param {Object} questions - Questions object with reputation, visibility, competitive arrays
 * @param {string} targetLanguage - Target language (e.g., "Spanish", "French")
 * @param {string} apiKey - Gemini API key
 * @returns {Object} Translated questions object
 */
export async function translateQuestions(questions, targetLanguage, apiKey) {
  // Skip translation for English or if no language specified
  if (!targetLanguage || targetLanguage === 'English') {
    return questions;
  }

  console.log(`\n🌐 Translating questions to ${targetLanguage}...`);

  // Flatten all questions for batch translation
  const allQuestions = [];
  const questionMap = new Map(); // Track original position

  Object.entries(questions).forEach(([type, questionList]) => {
    questionList.forEach((q, index) => {
      allQuestions.push({
        id: q.id,
        text: q.question,
        type,
        index
      });
    });
  });

  // Build translation prompt
  const prompt = `<INSTRUCTIONS>
You are a native ${targetLanguage} speaker helping localize search queries for market research.

Your task: Transform these English questions into natural ${targetLanguage} questions that a real user would type into an AI search engine like ChatGPT or Google.

CRITICAL RULES:
1. PRESERVE THE CORE INTENT of each question (reputation, comparison, recommendation, etc.)
2. Make each question sound NATURAL and CONVERSATIONAL in ${targetLanguage} - like how a native speaker would actually ask
3. EVERY question MUST be UNIQUE - vary the phrasing, sentence structure, and word choice
4. Keep brand names, company names, and proper nouns in their ORIGINAL form (do not translate "Nike", "Adidas", etc.)
5. Adapt idioms and expressions to ${targetLanguage} equivalents - do NOT translate word-for-word
6. Use natural ${targetLanguage} question patterns and colloquialisms
7. Return ONLY valid JSON with no markdown or explanations

EXAMPLES of good natural translations (English → French):
- "Is Nike good for sneakers?" → "Est-ce que Nike est une bonne marque de baskets ?"
- "Is Nike worth it for sneakers?" → "Nike vaut-il le coup pour des sneakers ?"
- "Should I buy Nike for sneakers?" → "Je devrais acheter des Nike ou pas ?"
- "Nike pros and cons for sneakers?" → "Quels sont les avantages et inconvénients de Nike ?"

BAD translations to avoid:
- Word-for-word translations that sound robotic
- Questions that all start the same way
- Unnatural phrasing that no native speaker would use
</INSTRUCTIONS>

<INPUT>
${JSON.stringify(allQuestions.map(q => ({ id: q.id, text: q.text })), null, 2)}
</INPUT>

<OUTPUT_FORMAT>
{
  "translations": [
    { "id": "question_id", "original": "original text", "translated": "translated text in natural ${targetLanguage}" }
  ]
}
</OUTPUT_FORMAT>`;

  try {
    const response = await callGeminiForJSON(prompt, apiKey);

    // callGeminiForJSON returns { text, groundedSources }
    let responseText = response.text || response;

    // Strip markdown code blocks if present
    if (typeof responseText === 'string') {
      responseText = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    }

    const parsed = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;

    if (!parsed.translations || !Array.isArray(parsed.translations)) {
      console.error('❌ Invalid translation response structure:', typeof parsed, Object.keys(parsed || {}));
      return questions;
    }

    // Create lookup map for translations
    const translationMap = new Map();
    parsed.translations.forEach(t => {
      translationMap.set(t.id, t.translated);
    });

    // Apply translations to original structure
    const translatedQuestions = {};
    Object.entries(questions).forEach(([type, questionList]) => {
      translatedQuestions[type] = questionList.map(q => ({
        ...q,
        question: translationMap.get(q.id) || q.question,
        originalQuestion: q.question // Keep original for reference
      }));
    });

    console.log(`✅ Successfully translated ${allQuestions.length} questions to ${targetLanguage}`);
    return translatedQuestions;

  } catch (error) {
    console.error('❌ Translation error:', error.message);
    // Return original questions if translation fails
    return questions;
  }
}
