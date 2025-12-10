import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import { Link2, RefreshCw, ExternalLink, Youtube, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * SourceAnalysis Component
 * Displays source type distribution (stacked bar) and top domains by source type
 * Shows which sources are feeding LLM responses
 */
export default function SourceAnalysis({ sourceAnalysis, sources = [], className = '' }) {
  const [showAllSources, setShowAllSources] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState({});

  if (!sourceAnalysis && (!sources || sources.length === 0)) {
    return null;
  }

  // Toggle domain expansion
  const toggleDomainExpansion = (domain) => {
    setExpandedDomains(prev => ({
      ...prev,
      [domain]: !prev[domain]
    }));
  };

  // Extract domain from URL helper
  const extractDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Check if source is from YouTube and extract channel info
  const getYouTubeInfo = (source) => {
    // First check if backend provided youtube_channel field
    if (source.youtube_channel) {
      return {
        isYouTube: true,
        channelName: source.youtube_channel
      };
    }

    // Legacy: check if backend already marked it as YouTube
    if (source.isYouTube) {
      return {
        isYouTube: true,
        channelName: source.youtubeChannel || source.domain?.replace('youtube.com/', '') || null
      };
    }

    // Fallback: check URL/domain for YouTube
    const url = source.url || '';
    const domain = source.domain || '';

    if (!url.includes('youtube.com') && !url.includes('youtu.be') &&
        !domain.includes('youtube.com')) {
      return { isYouTube: false, channelName: null };
    }

    // Try to extract channel name from URL
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // Handle @username format
      const handleMatch = pathname.match(/^\/@([^\/]+)/);
      if (handleMatch) {
        return { isYouTube: true, channelName: `@${handleMatch[1]}` };
      }

      // Handle /c/ChannelName format
      const customMatch = pathname.match(/^\/c\/([^\/]+)/);
      if (customMatch) {
        return { isYouTube: true, channelName: customMatch[1] };
      }

      // Handle /user/Username format
      const userMatch = pathname.match(/^\/user\/([^\/]+)/);
      if (userMatch) {
        return { isYouTube: true, channelName: userMatch[1] };
      }

      // Handle /channel/UC... format - show as "Channel"
      const channelMatch = pathname.match(/^\/channel\/([^\/]+)/);
      if (channelMatch) {
        return { isYouTube: true, channelName: null };
      }
    } catch {
      // URL parsing failed
    }

    // It's YouTube but couldn't extract channel
    return { isYouTube: true, channelName: null };
  };

  // Get citation count from source - handles array, number, or missing data
  const getCitationCount = (source) => {
    if (Array.isArray(source.cited_by)) return source.cited_by.length;
    if (typeof source.cited_by === 'number') return source.cited_by;
    if (typeof source.citations === 'number') return source.citations;
    if (typeof source.count === 'number') return source.count;
    return 1; // Default to 1 since source exists
  };

  // Color palette for source types (10 categories)
  const SOURCE_COLORS = {
    'Corporate Blogs & Content': '#4285F4', // Blue
    'Social / UGC': '#34A853', // Green
    'Journalism': '#FBBC04', // Yellow
    'Aggregators / Encyclopedic': '#EA4335', // Red
    'Government / NGO': '#9C27B0', // Purple
    'Academic / Research': '#FF9800', // Orange
    'Press Release': '#607D8B', // Blue Grey
    'Owned Media': '#2E7D32', // Dark Green - brand's own
    'Competitor Media': '#C62828', // Dark Red - competitor's
    'Paid/Advertorial': '#00BCD4', // Cyan
    'Review Sites': '#795548', // Brown
    'Other': '#9E9E9E' // Grey
  };

  // Prepare pie chart data from source_type_distribution
  const pieChartData = useMemo(() => {
    const data = [];
    if (sourceAnalysis?.source_type_distribution) {
      Object.entries(sourceAnalysis.source_type_distribution).forEach(([type, count]) => {
        if (count > 0) {
          data.push({
            name: type,
            y: count,
            color: SOURCE_COLORS[type] || SOURCE_COLORS['Other']
          });
        }
      });
    }
    // Sort by value descending
    data.sort((a, b) => b.y - a.y);
    return data;
  }, [sourceAnalysis]);

  // Check if a title is just a domain (not a real page title)
  const isDomainOnlyTitle = (title, url) => {
    if (!title) return true;
    const domain = extractDomain(url);
    // Title is domain-only if it matches the domain or looks like a domain (short, has dot, no spaces)
    if (title === domain) return true;
    if (title.includes('.') && !title.includes(' ') && title.length < 50 && !title.startsWith('http')) return true;
    return false;
  };

  // Prepare citation sources for the AI Citation Sources table - grouped by domain
  const citationSources = useMemo(() => {
    let allSources = [];

    // Helper to extract YouTube channel name from domain or URL
    const extractYouTubeChannelName = (source) => {
      // First check if backend provided it
      if (source.youtube_channel) return source.youtube_channel;

      // Try to extract from domain (e.g., "youtube.com/@ChannelName")
      const domain = source.domain || '';
      if (domain.includes('youtube.com/')) {
        const channelPart = domain.replace('youtube.com/', '');
        if (channelPart && channelPart !== 'youtube.com') {
          return channelPart;
        }
      }

      // Try to extract from URL
      const ytInfo = getYouTubeInfo(source);
      return ytInfo.channelName || null;
    };

    // Use sources array if available
    if (sources && sources.length > 0) {
      allSources = sources.map(source => ({
        url: source.url,
        // Use full URL as title if no real title provided (domain-only titles are not useful)
        title: isDomainOnlyTitle(source.title, source.url) ? source.url : source.title,
        domain: source.domain || extractDomain(source.url),
        source_type: source.source_type || 'Other',
        competitor_name: source.competitor_name || null,
        citations: getCitationCount(source),
        youtube_channel: extractYouTubeChannelName(source)
      }));
    }
    // Fall back to top_domains (only has domain info, not full URLs)
    else if (sourceAnalysis?.top_domains && sourceAnalysis.top_domains.length > 0) {
      allSources = sourceAnalysis.top_domains.map(domainInfo => {
        const url = `https://${domainInfo.domain}`;
        return {
          url: url,
          title: url, // Use full URL as title since we only have domain info
          domain: domainInfo.domain,
          source_type: domainInfo.source_type || 'Other',
          citations: domainInfo.count || 1
        };
      });
    }

    // Group sources by domain
    const domainGroups = {};
    allSources.forEach(source => {
      const domain = source.domain;
      if (!domainGroups[domain]) {
        domainGroups[domain] = {
          domain: domain,
          source_type: source.source_type,
          competitor_name: source.competitor_name || null,
          citations: 0,
          urls: [],
          youtube_channel: source.youtube_channel
        };
      }
      domainGroups[domain].citations += source.citations;
      domainGroups[domain].urls.push({
        url: source.url,
        title: source.title,
        citations: source.citations,
        youtube_channel: source.youtube_channel
      });
      // Keep youtube_channel if found
      if (source.youtube_channel && !domainGroups[domain].youtube_channel) {
        domainGroups[domain].youtube_channel = source.youtube_channel;
      }
      // Keep competitor_name if this source has it
      if (source.competitor_name && !domainGroups[domain].competitor_name) {
        domainGroups[domain].competitor_name = source.competitor_name;
      }
    });

    // Convert to array and calculate totals
    const groupedSources = Object.values(domainGroups);
    const totalCitations = groupedSources.reduce((sum, g) => sum + g.citations, 0);

    // Add usage frequency percentage and sort URLs within each group
    const result = groupedSources.map(group => ({
      ...group,
      usageFrequency: totalCitations > 0 ? (group.citations / totalCitations) * 100 : 0,
      urls: group.urls.sort((a, b) => b.citations - a.citations)
    }));

    // Sort by citations descending
    result.sort((a, b) => b.citations - a.citations);

    return result;
  }, [sources, sourceAnalysis]);

  // Calculate total sources and percentages for stacked bar
  const stackedBarData = useMemo(() => {
    const total = pieChartData.reduce((sum, item) => sum + item.y, 0);
    return pieChartData.map(item => ({
      ...item,
      percentage: total > 0 ? (item.y / total) * 100 : 0
    }));
  }, [pieChartData]);

  const totalSources = useMemo(() => {
    return pieChartData.reduce((sum, item) => sum + item.y, 0);
  }, [pieChartData]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Citation Type Breakdown - Horizontal Stacked Bar */}
      {stackedBarData.length > 0 && (
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-[#212121] mb-1">
              Citation Type Breakdown
            </h3>
            <p className="text-sm text-[#757575]">
              See how your citation sources stack up
            </p>
          </div>

          {/* Stacked Bar */}
          <div className="h-10 rounded-lg overflow-hidden flex mb-4">
            {stackedBarData.map((item, idx) => (
              <div
                key={idx}
                className="h-full transition-all duration-300 hover:opacity-80"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                  minWidth: item.percentage > 0 ? '2px' : '0'
                }}
                title={`${item.name}: ${item.y} (${item.percentage.toFixed(0)}%)`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {stackedBarData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-[#212121] font-medium">{item.name}</span>
                <span className="text-sm text-[#757575]">
                  {item.y} ({item.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Citation Sources Table */}
      {citationSources.length > 0 && (
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#757575]" />
              <h3 className="text-lg font-medium text-[#212121]">AI Citation Sources</h3>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#9E9E9E]" />
              <button
                onClick={() => setShowAllSources(!showAllSources)}
                className="px-3 py-1.5 text-sm font-medium text-[#212121] bg-white border border-[#E0E0E0] rounded hover:bg-[#F5F5F5] transition-colors"
              >
                {showAllSources ? 'Show Less' : 'Show All'}
              </button>
            </div>
          </div>
          <p className="text-sm text-[#757575] mb-6">
            See which domains AI tools reference most often for your brand and niche. Usage frequency shows each domain's share of total citations across all sources.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E0E0E0]">
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" />
                      Sources
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">Source Type</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">Usage Frequency</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">Citations</th>
                </tr>
              </thead>
              <tbody>
                {(showAllSources ? citationSources : citationSources.slice(0, 10)).map((domainGroup, idx) => {
                  // Get first letter of domain for favicon placeholder
                  const domainInitial = domainGroup.domain ? domainGroup.domain.charAt(0).toUpperCase() : 'S';
                  const isYouTube = domainGroup.domain?.includes('youtube.com') || domainGroup.domain?.includes('youtu.be') || domainGroup.youtube_channel;
                  const isExpanded = expandedDomains[domainGroup.domain];
                  const hasMultipleUrls = domainGroup.urls.length > 1;
                  const sourceTypeColor = SOURCE_COLORS[domainGroup.source_type] || SOURCE_COLORS['Other'];

                  // For YouTube, show channel name instead of domain
                  const displayName = isYouTube && domainGroup.youtube_channel
                    ? domainGroup.youtube_channel
                    : domainGroup.domain;

                  return (
                    <>
                      <tr key={idx} className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA]">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {/* Expand/collapse button if multiple URLs */}
                            {hasMultipleUrls ? (
                              <button
                                onClick={() => toggleDomainExpansion(domainGroup.domain)}
                                className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-colors"
                                style={{ backgroundColor: isYouTube ? '#FF0000' : '#F5F5F5' }}
                              >
                                {isExpanded ? (
                                  <ChevronDown className={`w-4 h-4 ${isYouTube ? 'text-white' : 'text-[#757575]'}`} />
                                ) : (
                                  <ChevronRight className={`w-4 h-4 ${isYouTube ? 'text-white' : 'text-[#757575]'}`} />
                                )}
                              </button>
                            ) : isYouTube ? (
                              <div className="w-8 h-8 rounded bg-[#FF0000] flex items-center justify-center flex-shrink-0" title="YouTube">
                                <Youtube className="w-4 h-4 text-white" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded bg-[#F5F5F5] flex items-center justify-center text-xs font-medium text-[#757575] flex-shrink-0">
                                {domainInitial}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {/* YouTube icon next to channel name when expanded */}
                                {isYouTube && hasMultipleUrls && (
                                  <Youtube className="w-4 h-4 text-[#FF0000] flex-shrink-0" />
                                )}
                                <a
                                  href={`https://${domainGroup.domain}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-[#212121] hover:text-[#1976D2] transition-colors flex items-center gap-1"
                                >
                                  <span className="truncate max-w-[300px]">{displayName}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0 text-[#9E9E9E]" />
                                </a>
                              </div>
                              <p className="text-xs text-[#9E9E9E]">
                                {domainGroup.urls.length} {domainGroup.urls.length === 1 ? 'page' : 'pages'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${sourceTypeColor}20`,
                              color: sourceTypeColor
                            }}
                            title={domainGroup.source_type === 'Competitor Media' && domainGroup.competitor_name
                              ? `Competitor: ${domainGroup.competitor_name}`
                              : domainGroup.source_type}
                          >
                            {domainGroup.source_type === 'Competitor Media' && domainGroup.competitor_name
                              ? domainGroup.competitor_name
                              : domainGroup.source_type}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-sm font-medium text-[#212121]">
                            {domainGroup.usageFrequency.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-sm font-medium text-[#212121]">
                            {domainGroup.citations}
                          </span>
                        </td>
                      </tr>
                      {/* Expanded URLs */}
                      {isExpanded && domainGroup.urls.map((urlItem, urlIdx) => {
                        // For YouTube, extract video ID or show title if meaningful
                        let displayText = urlItem.url;
                        if (isYouTube) {
                          // Check if title is meaningful (not just domain name)
                          const titleIsMeaningful = urlItem.title &&
                            urlItem.title !== urlItem.url &&
                            !urlItem.title.match(/^(youtube\.com|www\.youtube\.com)$/i);

                          if (titleIsMeaningful) {
                            displayText = urlItem.title;
                          } else {
                            // Try to extract video ID for a friendlier display
                            try {
                              const urlObj = new URL(urlItem.url);
                              const videoId = urlObj.searchParams.get('v') ||
                                urlObj.pathname.replace('/shorts/', '').replace('/', '');
                              if (videoId && videoId.length > 5) {
                                displayText = `YouTube Video (${videoId})`;
                              }
                            } catch {
                              // Keep URL as display text
                            }
                          }
                        }

                        // Get channel name - either from this URL's metadata or fall back to domain group
                        const channelName = urlItem.youtube_channel || domainGroup.youtube_channel;

                        return (
                          <tr key={`${idx}-url-${urlIdx}`} className="bg-[#FAFAFA] border-b border-[#F5F5F5]">
                            <td className="py-3 px-4 pl-16" colSpan={4}>
                              <div className="flex items-center gap-2">
                                <a
                                  href={urlItem.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[#757575] hover:text-[#1976D2] transition-colors flex items-center gap-1 flex-1"
                                  title={urlItem.url}
                                >
                                  <span className="truncate max-w-[400px]">{displayText}</span>
                                  <ExternalLink className="w-3 h-3 flex-shrink-0 text-[#9E9E9E]" />
                                </a>
                                {/* Show channel name for YouTube videos */}
                                {isYouTube && channelName && (
                                  <span className="text-xs text-[#FF0000] bg-[#FFEBEE] px-2 py-0.5 rounded flex-shrink-0">
                                    {channelName}
                                  </span>
                                )}
                                <span className="text-xs text-[#9E9E9E] flex-shrink-0">
                                  {urlItem.citations} {urlItem.citations === 1 ? 'citation' : 'citations'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!showAllSources && citationSources.length > 10 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAllSources(true)}
                className="text-sm text-[#2196F3] hover:text-[#1976D2] font-medium"
              >
                Show {citationSources.length - 10} more domains
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

SourceAnalysis.propTypes = {
  sourceAnalysis: PropTypes.shape({
    total_sources: PropTypes.number,
    source_type_distribution: PropTypes.object,
    competitor_breakdown: PropTypes.object,
    unique_domains: PropTypes.number
  }),
  sources: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      domain: PropTypes.string,
      title: PropTypes.string,
      source_type: PropTypes.string,
      competitor_name: PropTypes.string,
      cited_by: PropTypes.array,
      isYouTube: PropTypes.bool,
      youtubeChannel: PropTypes.string,
      youtube_channel: PropTypes.string
    })
  ),
  className: PropTypes.string
};
