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
 */
export function parseJSON(text) {
  if (!text) {
    return null;
  }

  try {
    // Try direct parsing first
    return JSON.parse(text);
  } catch (firstError) {
    // Try sanitization (strips markdown, control chars)
    try {
      const sanitized = sanitizeJSON(text);
      return JSON.parse(sanitized);
    } catch (secondError) {
      // Try JSON repair (fixes missing commas, etc.)
      try {
        const sanitized = sanitizeJSON(text);
        const repaired = repairJSON(sanitized);
        return JSON.parse(repaired);
      } catch (thirdError) {
        // Try extracting JSON with brace counting + repair
        try {
          const extracted = extractJSONWithBraceCounting(text);
          if (extracted) {
            const sanitized = sanitizeJSON(extracted);
            const repaired = repairJSON(sanitized);
            return JSON.parse(repaired);
          }
        } catch (fourthError) {
          console.error('JSON parsing failed after all recovery attempts:', {
            firstError: firstError.message,
            secondError: secondError.message,
            thirdError: thirdError.message,
            fourthError: fourthError.message,
            textLength: text.length,
            firstChars: text.substring(0, 200),
            lastChars: text.substring(text.length - 200)
          });
        }
      }
    }
  }

  return null;
}
