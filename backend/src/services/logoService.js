/**
 * Logo Service - Fetches and caches domain logos from Brandfetch API
 *
 * Brandfetch CDN URL format:
 * https://cdn.brandfetch.io/{domain}/{type}/h/{height}.{format}?c={CLIENT_ID}
 */

import { getDatabase } from '../database/schema.js';

// Constants
const BRANDFETCH_CDN = 'https://cdn.brandfetch.io';
const DEFAULT_ICON_HEIGHT = 32;
const DEFAULT_LOGO_HEIGHT = 40;
const DEFAULT_FORMAT = 'png';

/**
 * Generate a Brandfetch CDN URL for a domain
 * @param {string} domain - The domain to fetch logo for
 * @param {Object} options - Configuration options
 * @param {string} options.type - 'icon' (favicon) or 'logo' (full logo)
 * @param {number} options.height - Height in pixels
 * @param {string} options.format - 'png', 'jpg', 'webp', 'svg'
 * @returns {string|null} The CDN URL or null if no API key
 */
export function generateBrandfetchUrl(domain, { type = 'icon', height = DEFAULT_ICON_HEIGHT, format = DEFAULT_FORMAT } = {}) {
  const clientId = process.env.LOGO_API_KEY;
  if (!clientId) {
    return null;
  }

  // Clean the domain - remove protocol and trailing slashes
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();

  if (!cleanDomain) {
    return null;
  }

  return `${BRANDFETCH_CDN}/${cleanDomain}/${type}/h/${height}.${format}?c=${clientId}`;
}

/**
 * Generate both icon and logo URLs for a domain
 * @param {string} domain - The domain
 * @returns {Object} Object with icon_url and logo_url
 */
export function generateLogoUrls(domain) {
  return {
    icon_url: generateBrandfetchUrl(domain, { type: 'icon', height: DEFAULT_ICON_HEIGHT }),
    logo_url: generateBrandfetchUrl(domain, { type: 'logo', height: DEFAULT_LOGO_HEIGHT })
  };
}

/**
 * Check if a logo exists by making a HEAD request
 * @param {string} url - The Brandfetch CDN URL
 * @returns {Promise<boolean>} Whether the logo exists
 */
export async function checkLogoExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
    // Brandfetch returns 200 for valid logos, redirects for missing ones
    return response.ok && response.status === 200;
  } catch (error) {
    console.warn(`Logo check failed for ${url}:`, error.message);
    return false;
  }
}

/**
 * Save a domain logo to the cache
 * @param {string} domain - The domain
 * @param {string} logoUrl - The full logo URL
 * @param {string} iconUrl - The icon/favicon URL
 * @param {string} status - 'success', 'not_found', or 'error'
 */
export function saveDomainLogo(domain, logoUrl, iconUrl, status = 'success') {
  const db = getDatabase();
  try {
    const stmt = db.prepare(`
      INSERT INTO domain_logos (domain, logo_url, icon_url, fetch_status, fetched_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(domain) DO UPDATE SET
        logo_url = excluded.logo_url,
        icon_url = excluded.icon_url,
        fetch_status = excluded.fetch_status,
        fetched_at = datetime('now')
    `);
    stmt.run(domain, logoUrl, iconUrl, status);
  } finally {
    db.close();
  }
}

/**
 * Get cached logo for a domain
 * @param {string} domain - The domain
 * @returns {Object|null} Cached logo data or null
 */
export function getCachedLogo(domain) {
  const db = getDatabase();
  try {
    const stmt = db.prepare(`
      SELECT domain, logo_url, icon_url, fetch_status, fetched_at
      FROM domain_logos
      WHERE domain = ?
    `);
    return stmt.get(domain) || null;
  } finally {
    db.close();
  }
}

/**
 * Get cached logos for multiple domains
 * @param {string[]} domains - Array of domains
 * @returns {Object} Map of domain -> logo data
 */
export function getLogosForDomains(domains) {
  if (!domains || domains.length === 0) {
    return {};
  }

  const db = getDatabase();
  try {
    const placeholders = domains.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT domain, logo_url, icon_url, fetch_status
      FROM domain_logos
      WHERE domain IN (${placeholders})
    `);
    const rows = stmt.all(...domains);

    const result = {};
    rows.forEach(row => {
      result[row.domain] = {
        logo_url: row.logo_url,
        icon_url: row.icon_url,
        fetch_status: row.fetch_status
      };
    });
    return result;
  } finally {
    db.close();
  }
}

/**
 * Process a single domain - check cache, generate URLs, optionally verify
 * @param {string} domain - The domain to process
 * @param {boolean} verify - Whether to verify the logo exists (slower)
 * @returns {Promise<Object>} Logo data for this domain
 */
async function processDomain(domain, verify = false) {
  // Check cache first
  const cached = getCachedLogo(domain);
  if (cached && cached.fetch_status !== 'pending') {
    return {
      domain,
      ...cached,
      fromCache: true
    };
  }

  // Generate URLs
  const urls = generateLogoUrls(domain);

  if (!urls.icon_url) {
    // No API key configured
    return {
      domain,
      logo_url: null,
      icon_url: null,
      fetch_status: 'no_api_key',
      fromCache: false
    };
  }

  let status = 'success';

  // Optionally verify the icon exists
  if (verify) {
    const exists = await checkLogoExists(urls.icon_url);
    if (!exists) {
      status = 'not_found';
      urls.icon_url = null;
      urls.logo_url = null;
    }
  }

  // Save to cache
  saveDomainLogo(domain, urls.logo_url, urls.icon_url, status);

  return {
    domain,
    logo_url: urls.logo_url,
    icon_url: urls.icon_url,
    fetch_status: status,
    fromCache: false
  };
}

/**
 * Batch process domains - fetch/cache logos for multiple domains
 * @param {string[]} domains - Array of domains to process
 * @param {Object} options - Options
 * @param {boolean} options.verify - Whether to verify logos exist (slower but more accurate)
 * @param {number} options.concurrency - Max concurrent requests when verifying
 * @returns {Promise<Object>} Map of domain -> logo data
 */
export async function batchFetchLogos(domains, { verify = false, concurrency = 10 } = {}) {
  if (!domains || domains.length === 0) {
    return {};
  }

  // Filter out empty/invalid domains
  const validDomains = [...new Set(domains.filter(d => d && typeof d === 'string' && d.trim()))];

  if (validDomains.length === 0) {
    return {};
  }

  console.log(`🖼️ Processing logos for ${validDomains.length} domains...`);

  // Check which domains are already cached
  const cachedLogos = getLogosForDomains(validDomains);
  const cachedDomains = new Set(Object.keys(cachedLogos).filter(d => cachedLogos[d].fetch_status !== 'pending'));
  const uncachedDomains = validDomains.filter(d => !cachedDomains.has(d));

  console.log(`   📦 ${cachedDomains.size} already cached, ${uncachedDomains.length} to process`);

  // Start with cached results
  const results = { ...cachedLogos };

  if (uncachedDomains.length === 0) {
    return results;
  }

  // Process uncached domains
  if (verify) {
    // Process with verification (slower, uses HEAD requests)
    for (let i = 0; i < uncachedDomains.length; i += concurrency) {
      const batch = uncachedDomains.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(domain => processDomain(domain, true))
      );

      batchResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          const data = result.value;
          results[data.domain] = {
            logo_url: data.logo_url,
            icon_url: data.icon_url,
            fetch_status: data.fetch_status
          };
        }
      });
    }
  } else {
    // Fast path - just generate URLs and cache without verification
    // The frontend will handle 404s gracefully
    uncachedDomains.forEach(domain => {
      const urls = generateLogoUrls(domain);
      if (urls.icon_url) {
        saveDomainLogo(domain, urls.logo_url, urls.icon_url, 'success');
        results[domain] = {
          logo_url: urls.logo_url,
          icon_url: urls.icon_url,
          fetch_status: 'success'
        };
      }
    });
  }

  console.log(`   ✅ Logos processed for ${Object.keys(results).length} domains`);

  return results;
}

/**
 * Generate logo URL for a brand name (for competitors in visibility rankings)
 * Tries multiple variations to find a working logo
 * @param {string} brandName - The brand name (e.g., "Nike", "The North Face")
 * @returns {Object} Object with logo_url and icon_url
 */
export function generateBrandLogoUrls(brandName) {
  if (!brandName) {
    return { logo_url: null, icon_url: null };
  }

  // Strategy 1: Try the brand name as-is (Brandfetch might support it)
  // Strategy 2: Convert to likely domain

  // Clean and convert brand name to domain
  const cleanName = brandName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '')         // Remove spaces
    .trim();

  // Try with .com suffix
  const likelyDomain = cleanName + '.com';

  return generateLogoUrls(likelyDomain);
}

/**
 * Get logos for brand names (entity + competitors)
 * @param {string[]} brandNames - Array of brand names
 * @returns {Object} Map of brandName -> logo data
 */
export function getBrandLogos(brandNames) {
  if (!brandNames || brandNames.length === 0) {
    return {};
  }

  const results = {};
  brandNames.forEach(name => {
    if (name) {
      results[name] = generateBrandLogoUrls(name);
    }
  });

  return results;
}

export default {
  generateBrandfetchUrl,
  generateLogoUrls,
  generateBrandLogoUrls,
  getBrandLogos,
  checkLogoExists,
  saveDomainLogo,
  getCachedLogo,
  getLogosForDomains,
  batchFetchLogos
};
