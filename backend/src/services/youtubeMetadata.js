/**
 * YouTube Metadata Service
 * Fetches video titles and channel names using YouTube's oEmbed API
 * No API key required
 */

/**
 * Extract video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string|null} - Video ID or null
 */
function extractVideoId(url) {
  try {
    const urlObj = new URL(url);

    // Handle standard watch URLs: youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return videoId;

      // Handle shorts: youtube.com/shorts/VIDEO_ID
      if (urlObj.pathname.startsWith('/shorts/')) {
        return urlObj.pathname.replace('/shorts/', '');
      }

      // Handle embed: youtube.com/embed/VIDEO_ID
      if (urlObj.pathname.startsWith('/embed/')) {
        return urlObj.pathname.replace('/embed/', '');
      }
    }

    // Handle short URLs: youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch YouTube video metadata using oEmbed API
 * @param {string} videoUrl - YouTube video URL
 * @returns {Promise<{title: string, channel: string}|null>}
 */
async function fetchYouTubeMetadata(videoUrl) {
  try {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) return null;

    // Construct canonical URL for oEmbed
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;

    const response = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 5000
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      title: data.title || null,
      channel: data.author_name || null,
      videoId: videoId
    };
  } catch (error) {
    console.log(`[YouTubeMetadata] Failed to fetch metadata for ${videoUrl}: ${error.message}`);
    return null;
  }
}

/**
 * Batch fetch YouTube metadata for multiple URLs
 * @param {string[]} urls - Array of YouTube URLs
 * @param {number} concurrency - Max concurrent requests (default: 5)
 * @returns {Promise<Map<string, {title: string, channel: string}>>}
 */
async function fetchYouTubeMetadataBatch(urls, concurrency = 5) {
  const results = new Map();

  // Filter to only YouTube URLs
  const youtubeUrls = urls.filter(url =>
    url && (url.includes('youtube.com') || url.includes('youtu.be'))
  );

  if (youtubeUrls.length === 0) {
    return results;
  }

  console.log(`[YouTubeMetadata] Fetching metadata for ${youtubeUrls.length} YouTube URLs...`);

  // Process in batches for concurrency control
  for (let i = 0; i < youtubeUrls.length; i += concurrency) {
    const batch = youtubeUrls.slice(i, i + concurrency);
    const promises = batch.map(async (url) => {
      const metadata = await fetchYouTubeMetadata(url);
      if (metadata) {
        results.set(url, metadata);
      }
      return { url, metadata };
    });

    await Promise.all(promises);
  }

  console.log(`[YouTubeMetadata] Successfully fetched ${results.size}/${youtubeUrls.length} video metadata`);

  return results;
}

/**
 * Enrich sources array with YouTube metadata
 * @param {Array} sources - Array of source objects with url field
 * @returns {Promise<Array>} - Sources with youtube_title and youtube_channel added
 */
async function enrichSourcesWithYouTubeMetadata(sources) {
  if (!sources || sources.length === 0) return sources;

  // Get all YouTube URLs
  const youtubeUrls = sources
    .filter(s => s.url && (s.url.includes('youtube.com') || s.url.includes('youtu.be')))
    .map(s => s.url);

  if (youtubeUrls.length === 0) {
    return sources;
  }

  // Fetch metadata in batch
  const metadataMap = await fetchYouTubeMetadataBatch(youtubeUrls);

  // Enrich sources
  return sources.map(source => {
    if (!source.url) return source;

    const metadata = metadataMap.get(source.url);
    if (metadata) {
      return {
        ...source,
        title: metadata.title || source.title,
        youtube_channel: metadata.channel,
        youtube_video_id: metadata.videoId
      };
    }

    return source;
  });
}

export {
  extractVideoId,
  fetchYouTubeMetadata,
  fetchYouTubeMetadataBatch,
  enrichSourcesWithYouTubeMetadata
};
