/**
 * JSON Parser Utilities
 * Handles parsing of LLM responses with error recovery
 * Ported from Google Apps Script V2.17
 */

/**
 * Attempt to repair common JSON errors from LLM responses
 * Handles: missing commas, trailing commas, unescaped quotes in strings
 * @param {string} text - JSON text to repair
 * @returns {string} Repaired JSON text
 */
function repairJSON(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let repaired = text;

  // Fix missing commas between properties (common LLM error)
  // Pattern: "value"\n    "key" -> "value",\n    "key"
  repaired = repaired.replace(/"\s*\n(\s*)"/g, '",\n$1"');

  // Fix missing commas between array elements
  // Pattern: }\n    { -> },\n    {
  repaired = repaired.replace(/}\s*\n(\s*){/g, '},\n$1{');

  // Fix missing commas after closing brackets
  // Pattern: ]\n    " -> ],\n    "
  repaired = repaired.replace(/]\s*\n(\s*)"/g, '],\n$1"');

  // Fix missing commas between values in arrays
  // Pattern: "value"\n    "value" inside arrays
  repaired = repaired.replace(/"(\s*)\n(\s*)"/g, '",$1\n$2"');

  // Remove trailing commas before closing braces/brackets (also common)
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

  // Fix unescaped newlines in string values (try to escape them)
  // This is tricky - only do it if we detect an obvious pattern

  return repaired;
}

/**
 * Advanced JSON repair for complex LLM responses
 * Handles issues like unescaped quotes in string values
 */
function advancedRepairJSON(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let repaired = text;

  // Fix smart/curly quotes that break JSON (common in LLM outputs)
  repaired = repaired.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  repaired = repaired.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  // Fix em-dashes and en-dashes that might break parsing
  repaired = repaired.replace(/[\u2013\u2014]/g, '-');

  // Fix ellipsis character
  repaired = repaired.replace(/\u2026/g, '...');

  // Remove any BOM or zero-width characters
  repaired = repaired.replace(/[\uFEFF\u200B\u200C\u200D]/g, '');

  // Try to fix unescaped quotes within string values
  // This is a heuristic approach - look for patterns like: "text "quoted" more text"
  // and escape the inner quotes
  repaired = repaired.replace(
    /("(?:[^"\\]|\\.)*)"\s*([a-zA-Z])/g,
    (match, before, after) => {
      // Check if this looks like an unescaped quote in a sentence
      if (before.match(/[a-zA-Z,\s]$/) && after.match(/^[a-zA-Z]/)) {
        return before + '\\"' + after;
      }
      return match;
    }
  );

  return repaired;
}

/**
 * Sanitize control characters in JSON string
 */
export function sanitizeJSON(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Remove markdown code blocks if present - remove all backticks completely
  text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Sanitize control characters while preserving valid escape sequences
  let sanitized = '';
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (char === '\\' && i + 1 < text.length) {
      const nextChar = text[i + 1];

      // Valid escape sequences
      if (['n', 'r', 't', '"', '\\', '/', 'b', 'f'].includes(nextChar) || nextChar === 'u') {
        sanitized += char + nextChar;
        i += 2;
        // Skip u and 4 hex digits for unicode
        if (nextChar === 'u' && i + 3 < text.length) {
          sanitized += text.substring(i, i + 4);
          i += 4;
        }
        continue;
      } else {
        // Invalid escape sequence - escape the backslash
        sanitized += '\\\\';
        i += 1;
        continue;
      }
    }

    // Check for unescaped control characters
    const charCode = char.charCodeAt(0);
    if (charCode < 32 && ![9, 10, 13].includes(charCode)) {
      // Replace control characters (except tab, newline, carriage return)
      sanitized += ' ';
    } else {
      // Keep all other characters as-is (including newlines, tabs, etc.)
      sanitized += char;
    }

    i++;
  }

  return sanitized;
}

/**
 * Extract JSON from text using brace-counting algorithm
 */
function extractJSONWithBraceCounting(text) {
  const openIndex = text.indexOf('{');
  if (openIndex === -1) {
    return null;
  }

  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = openIndex; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return text.substring(openIndex, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Parse JSON from LLM response with error recovery
 * Recovery pipeline:
 * 1. Direct parse
 * 2. Sanitize (markdown, control chars)
 * 3. Basic repair (missing commas, trailing commas)
 * 4. Brace extraction + repair
 * 5. Advanced repair (smart quotes, unicode issues)
 * 6. Brace extraction + advanced repair
 */
export function parseJSON(text) {
  if (!text) {
    return null;
  }

  try {
    // Step 1: Try direct parsing first
    return JSON.parse(text);
  } catch (firstError) {
    // Step 2: Try sanitization (strips markdown, control chars)
    try {
      const sanitized = sanitizeJSON(text);
      return JSON.parse(sanitized);
    } catch (secondError) {
      // Step 3: Try basic JSON repair (fixes missing commas, etc.)
      try {
        const sanitized = sanitizeJSON(text);
        const repaired = repairJSON(sanitized);
        return JSON.parse(repaired);
      } catch (thirdError) {
        // Step 4: Try extracting JSON with brace counting + basic repair
        try {
          const extracted = extractJSONWithBraceCounting(text);
          if (extracted) {
            const sanitized = sanitizeJSON(extracted);
            const repaired = repairJSON(sanitized);
            return JSON.parse(repaired);
          }
        } catch (fourthError) {
          // Step 5: Try advanced repair (smart quotes, unicode, etc.)
          try {
            const sanitized = sanitizeJSON(text);
            const advancedRepaired = advancedRepairJSON(sanitized);
            const basicRepaired = repairJSON(advancedRepaired);
            return JSON.parse(basicRepaired);
          } catch (fifthError) {
            // Step 6: Try brace extraction + advanced repair
            try {
              const extracted = extractJSONWithBraceCounting(text);
              if (extracted) {
                const sanitized = sanitizeJSON(extracted);
                const advancedRepaired = advancedRepairJSON(sanitized);
                const basicRepaired = repairJSON(advancedRepaired);
                return JSON.parse(basicRepaired);
              }
            } catch (sixthError) {
              console.error('JSON parsing failed after all recovery attempts:', {
                firstError: firstError.message,
                secondError: secondError.message,
                thirdError: thirdError.message,
                fourthError: fourthError.message,
                fifthError: fifthError.message,
                sixthError: sixthError.message,
                textLength: text.length,
                firstChars: text.substring(0, 200)
              });
            }
          }
        }
      }
    }
  }

  return null;
}
