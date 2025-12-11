import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { Link2, RefreshCw } from 'lucide-react';
import SourcesTable, { SOURCE_COLORS } from './SourcesTable';

/**
 * SourceAnalysis Component
 * Displays source type distribution (stacked bar) and top domains by source type
 * Shows which sources are feeding LLM responses
 */
export default function SourceAnalysis({ sourceAnalysis, sources = [], className = '' }) {
  if (!sourceAnalysis && (!sources || sources.length === 0)) {
    return null;
  }

  // Extract domain from URL helper
  const extractDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Get citation count from source - handles array, number, or missing data
  const getCitationCount = (source) => {
    if (Array.isArray(source.cited_by)) return source.cited_by.length;
    if (typeof source.cited_by === 'number') return source.cited_by;
    if (typeof source.citations === 'number') return source.citations;
    if (typeof source.count === 'number') return source.count;
    return 1;
  };

  // Check if a title is just a domain (not a real page title)
  const isDomainOnlyTitle = (title, url) => {
    if (!title) return true;
    const domain = extractDomain(url);
    if (title === domain) return true;
    if (title.includes('.') && !title.includes(' ') && title.length < 50 && !title.startsWith('http')) return true;
    return false;
  };

  // Helper to extract YouTube channel name from domain or URL
  const extractYouTubeChannelName = (source) => {
    if (source.youtube_channel) return source.youtube_channel;

    const domain = source.domain || '';
    if (domain.includes('youtube.com/')) {
      const channelPart = domain.replace('youtube.com/', '');
      if (channelPart && channelPart !== 'youtube.com') {
        return channelPart;
      }
    }

    // Try to extract from URL
    const url = source.url || '';
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      const handleMatch = pathname.match(/^\/@([^\/]+)/);
      if (handleMatch) return `@${handleMatch[1]}`;

      const customMatch = pathname.match(/^\/c\/([^\/]+)/);
      if (customMatch) return customMatch[1];

      const userMatch = pathname.match(/^\/user\/([^\/]+)/);
      if (userMatch) return userMatch[1];
    } catch {
      // URL parsing failed
    }

    return null;
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
    data.sort((a, b) => b.y - a.y);
    return data;
  }, [sourceAnalysis]);

  // Prepare citation sources for the table - grouped by domain
  const citationSources = useMemo(() => {
    let allSources = [];

    if (sources && sources.length > 0) {
      allSources = sources.map(source => ({
        url: source.url,
        title: isDomainOnlyTitle(source.title, source.url) ? source.url : source.title,
        domain: source.domain || extractDomain(source.url),
        source_type: source.source_type || 'Other',
        competitor_name: source.competitor_name || null,
        citations: getCitationCount(source),
        youtube_channel: extractYouTubeChannelName(source)
      }));
    } else if (sourceAnalysis?.top_domains && sourceAnalysis.top_domains.length > 0) {
      allSources = sourceAnalysis.top_domains.map(domainInfo => {
        const url = `https://${domainInfo.domain}`;
        return {
          url: url,
          title: url,
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
          youtube_channel: source.youtube_channel,
          icon_url: source.icon_url || null,
          logo_url: source.logo_url || null
        };
      }
      domainGroups[domain].citations += source.citations;
      domainGroups[domain].urls.push({
        url: source.url,
        title: source.title,
        citations: source.citations,
        youtube_channel: source.youtube_channel
      });
      if (source.youtube_channel && !domainGroups[domain].youtube_channel) {
        domainGroups[domain].youtube_channel = source.youtube_channel;
      }
      if (source.competitor_name && !domainGroups[domain].competitor_name) {
        domainGroups[domain].competitor_name = source.competitor_name;
      }
    });

    const groupedSources = Object.values(domainGroups);
    const totalCitations = groupedSources.reduce((sum, g) => sum + g.citations, 0);

    const result = groupedSources.map(group => ({
      ...group,
      usageFrequency: totalCitations > 0 ? (group.citations / totalCitations) * 100 : 0,
      urls: group.urls.sort((a, b) => b.citations - a.citations)
    }));

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

  return (
    <div className={`space-y-6 ${className}`}>
      {(stackedBarData.length > 0 || citationSources.length > 0) && (
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#757575]" />
              <h3 className="text-lg font-medium text-[#212121]">AI Citation Sources</h3>
            </div>
            {citationSources.length > 0 && (
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#9E9E9E]" />
              </div>
            )}
          </div>
          <p className="text-sm text-[#757575] mb-6">
            See which domains AI tools reference most often for your brand and niche
          </p>

          {/* Citation Type Breakdown - Horizontal Stacked Bar */}
          {stackedBarData.length > 0 && (
            <div className="mb-6">
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

          {/* Sources Table */}
          {citationSources.length > 0 && (
            <SourcesTable
              sources={citationSources}
              showUsageFrequency={true}
              initialLimit={10}
            />
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
    unique_domains: PropTypes.number,
    top_domains: PropTypes.array
  }),
  sources: PropTypes.arrayOf(
    PropTypes.shape({
      url: PropTypes.string.isRequired,
      domain: PropTypes.string,
      title: PropTypes.string,
      source_type: PropTypes.string,
      competitor_name: PropTypes.string,
      cited_by: PropTypes.oneOfType([PropTypes.array, PropTypes.number]),
      citations: PropTypes.number,
      count: PropTypes.number,
      isYouTube: PropTypes.bool,
      youtubeChannel: PropTypes.string,
      youtube_channel: PropTypes.string
    })
  ),
  className: PropTypes.string
};
