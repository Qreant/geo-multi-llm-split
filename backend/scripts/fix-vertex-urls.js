#!/usr/bin/env node
/**
 * Migration script to fix existing Vertex URLs in the database
 * Extracts domain from title and updates URL/domain fields
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../database/reports.db');
const db = new Database(dbPath);

/**
 * Extract domain from page title
 */
function extractDomainFromTitle(title) {
  if (!title || typeof title !== 'string') return null;

  const separators = [' | ', ' - ', ' — ', ' – ', ' : '];

  for (const sep of separators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      const lastPart = parts[parts.length - 1].trim();

      if (lastPart.includes('.') && lastPart.length < 50) {
        const domain = lastPart.toLowerCase().replace(/\s+/g, '');
        return { url: `https://${domain}`, domain };
      } else if (lastPart.length > 0 && lastPart.length < 30) {
        const domainGuess = lastPart.toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .replace(/\s+/g, '');
        if (domainGuess.length >= 3) {
          return { url: `https://${domainGuess}.com`, domain: `${domainGuess}.com` };
        }
      }
    }
  }

  const domainPattern = /([a-z0-9][-a-z0-9]*\.(?:com|org|net|io|co|gov|edu|fr|de|uk|ca|au|jp)[a-z]*)/i;
  const match = title.match(domainPattern);
  if (match) {
    return { url: `https://${match[1].toLowerCase()}`, domain: match[1].toLowerCase() };
  }

  return null;
}

console.log('🔧 Fixing Vertex URLs in database...\n');

// Get all sources with Vertex URLs
const vertexSources = db.prepare(`
  SELECT id, url, title, domain
  FROM sources
  WHERE url LIKE '%vertexaisearch%'
`).all();

console.log(`Found ${vertexSources.length} sources with Vertex URLs\n`);

const updateStmt = db.prepare(`
  UPDATE sources
  SET url = ?, domain = ?
  WHERE id = ?
`);

let fixed = 0;
let unfixable = 0;
const unfixableList = [];

db.transaction(() => {
  for (const source of vertexSources) {
    const extracted = extractDomainFromTitle(source.title);

    if (extracted) {
      updateStmt.run(extracted.url, extracted.domain, source.id);
      fixed++;
      console.log(`✅ Fixed: "${source.title?.substring(0, 50)}..." -> ${extracted.domain}`);
    } else {
      unfixable++;
      unfixableList.push({
        id: source.id,
        title: source.title
      });
      console.log(`⚠️  Cannot fix: "${source.title?.substring(0, 50) || 'No title'}"`);
    }
  }
})();

console.log('\n' + '='.repeat(60));
console.log(`\n✅ Fixed: ${fixed} sources`);
console.log(`⚠️  Unfixable: ${unfixable} sources`);

if (unfixableList.length > 0) {
  console.log('\nUnfixable sources (no domain could be extracted from title):');
  unfixableList.forEach(s => {
    console.log(`  - ID ${s.id}: "${s.title || 'No title'}"`);
  });
}

// Verify results
const remaining = db.prepare(`
  SELECT COUNT(*) as count
  FROM sources
  WHERE url LIKE '%vertexaisearch%'
`).get();

console.log(`\n📊 Remaining Vertex URLs in database: ${remaining.count}`);

db.close();
console.log('\n✅ Done!');
