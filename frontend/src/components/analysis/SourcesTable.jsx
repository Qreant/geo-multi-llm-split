import PropTypes from 'prop-types';
import React, { useState } from 'react';
import { Link2, ExternalLink, Youtube, ChevronDown, ChevronRight, Play } from 'lucide-react';

/**
 * Generate icon URL from domain using Google's favicon service
 */
function generateDomainIconUrl(domain) {
  if (!domain) return null;

  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();

  return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;
}

// Color palette for source types
const SOURCE_COLORS = {
  'Corporate Blogs & Content': '#4285F4',
  'Social / UGC': '#34A853',
  'Journalism': '#FBBC04',
  'Aggregators / Encyclopedic': '#EA4335',
  'Government / NGO': '#9C27B0',
  'Academic / Research': '#FF9800',
  'Press Release': '#607D8B',
  'Owned Media': '#2E7D32',
  'Competitor Media': '#C62828',
  'Paid/Advertorial': '#00BCD4',
  'Review Sites': '#795548',
  'Other': '#9E9E9E'
};

/**
 * Check if URL is valid (not unresolved or vertex)
 */
const isValidUrl = (url) => {
  if (!url) return false;
  if (url.startsWith('unresolved://')) return false;
  if (url.includes('vertexaisearch.cloud.google.com')) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * SourcesTable Component
 * Shared table component for displaying citation sources
 * Used by both SourceAnalysis and AggregatedSourceAnalysis
 */
export default function SourcesTable({
  sources = [],
  showUsageFrequency = false,
  initialLimit = 10
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState({});

  if (!sources || sources.length === 0) {
    return null;
  }

  const toggleDomainExpansion = (domain) => {
    setExpandedDomains(prev => ({
      ...prev,
      [domain]: !prev[domain]
    }));
  };

  const displayedSources = showAll ? sources : sources.slice(0, initialLimit);

  return (
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
            <th className="text-center py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">
              Source Type
            </th>
            {showUsageFrequency && (
              <th className="text-center py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">
                Usage Frequency
              </th>
            )}
            <th className="text-center py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">
              Citations
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedSources.map((item, idx) => {
            const domain = item.domain || '';
            const domainInitial = domain ? domain.charAt(0).toUpperCase() : 'S';
            const isYouTube = domain.includes('youtube.com') || domain.includes('youtu.be') || item.isYouTube || item.youtube_channel;
            const isExpanded = expandedDomains[domain];

            // Determine if expandable - check for urls array, pages array, or videos array
            const urls = item.urls || item.pages || item.videos || [];
            const hasMultipleItems = urls.length > 1;
            const isExpandable = hasMultipleItems || (item.videos && item.videos.length > 0);

            const sourceType = item.source_type || item.sourceType || 'Other';
            const sourceTypeColor = SOURCE_COLORS[sourceType] || SOURCE_COLORS['Other'];
            const citations = item.citations || item.count || 0;
            const usageFrequency = item.usageFrequency || 0;

            // Display name for YouTube channels
            const displayName = isYouTube && item.youtube_channel
              ? item.youtube_channel
              : domain;

            // For competitor media, show competitor name
            const displaySourceType = sourceType === 'Competitor Media' && item.competitor_name
              ? item.competitor_name
              : sourceType;

            return (
              <React.Fragment key={idx}>
                <tr
                  className={`border-b border-[#F5F5F5] hover:bg-[#FAFAFA] ${isExpandable ? 'cursor-pointer' : ''}`}
                  onClick={isExpandable ? () => toggleDomainExpansion(domain) : undefined}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      {/* Domain icon - always show first */}
                      {isYouTube ? (
                        <div className="w-8 h-8 rounded bg-[#FF0000] flex items-center justify-center flex-shrink-0" title="YouTube">
                          <Youtube className="w-4 h-4 text-white" />
                        </div>
                      ) : (
                        <>
                          <img
                            src={item.icon_url || item.logo_url || generateDomainIconUrl(domain)}
                            alt=""
                            className="w-8 h-8 rounded object-contain bg-[#F5F5F5] flex-shrink-0"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextElementSibling) {
                                e.target.nextElementSibling.style.display = 'flex';
                              }
                            }}
                          />
                          <div
                            className="w-8 h-8 rounded bg-[#F5F5F5] items-center justify-center text-xs font-medium text-[#757575] flex-shrink-0"
                            style={{ display: 'none' }}
                          >
                            {domainInitial}
                          </div>
                        </>
                      )}

                      {/* Expand/collapse button - fixed width container for alignment */}
                      <div className="w-5 flex-shrink-0">
                        {isExpandable && (
                          <button
                            className="w-5 h-5 rounded flex items-center justify-center hover:bg-[#E0E0E0] transition-colors"
                            onClick={(e) => { e.stopPropagation(); toggleDomainExpansion(domain); }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#757575]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#757575]" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Domain name and page count */}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isYouTube && hasMultipleItems && (
                            <Youtube className="w-4 h-4 text-[#FF0000] flex-shrink-0" />
                          )}
                          <a
                            href={`https://${domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[#212121] hover:text-[#1976D2] transition-colors flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate max-w-[300px]">{displayName}</span>
                            <ExternalLink className="w-3 h-3 flex-shrink-0 text-[#9E9E9E]" />
                          </a>
                        </div>
                        {urls.length > 0 && (
                          <p className="text-xs text-[#9E9E9E]">
                            {urls.length} {isYouTube ? (urls.length === 1 ? 'video' : 'videos') : (urls.length === 1 ? 'page' : 'pages')}
                          </p>
                        )}
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
                      title={sourceType === 'Competitor Media' && item.competitor_name
                        ? `Competitor: ${item.competitor_name}`
                        : sourceType}
                    >
                      {displaySourceType}
                    </span>
                  </td>

                  {showUsageFrequency && (
                    <td className="py-4 px-4 text-center">
                      <span className="text-sm font-medium text-[#212121]">
                        {usageFrequency.toFixed(1)}%
                      </span>
                    </td>
                  )}

                  <td className="py-4 px-4 text-center">
                    <span className="text-sm font-medium text-[#212121]">
                      {citations}
                    </span>
                  </td>
                </tr>

                {/* Expanded URLs/Videos list */}
                {isExpanded && urls.length > 0 && (
                  <tr className="bg-[#FAFAFA]">
                    <td colSpan={showUsageFrequency ? 4 : 3} className="px-4 py-2">
                      <div className="ml-16 space-y-2">
                        {urls.map((urlItem, urlIdx) => {
                          const url = urlItem.url || urlItem;
                          const title = urlItem.title || url;
                          const itemCitations = urlItem.citations || urlItem.count || 1;
                          const channelName = urlItem.youtube_channel || item.youtube_channel;

                          // For YouTube, try to make display text friendlier
                          let displayText = title;
                          if (isYouTube && title === url) {
                            try {
                              const urlObj = new URL(url);
                              const videoId = urlObj.searchParams.get('v') ||
                                urlObj.pathname.replace('/shorts/', '').replace('/', '');
                              if (videoId && videoId.length > 5) {
                                displayText = `YouTube Video (${videoId})`;
                              }
                            } catch {
                              // Keep URL as display text
                            }
                          }

                          return (
                            <div
                              key={urlIdx}
                              className="flex items-center gap-2 py-1.5 px-3 bg-white rounded border border-[#E0E0E0] hover:border-[#BDBDBD] transition-colors"
                            >
                              {isYouTube ? (
                                <Play className="w-3 h-3 text-red-500 flex-shrink-0" />
                              ) : (
                                <Link2 className="w-3 h-3 text-[#757575] flex-shrink-0" />
                              )}

                              {isValidUrl(url) ? (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-[#757575] hover:text-[#1976D2] transition-colors flex-1 truncate"
                                  onClick={(e) => e.stopPropagation()}
                                  title={url}
                                >
                                  {displayText}
                                </a>
                              ) : (
                                <span className="text-sm text-[#757575] flex-1 truncate" title={title}>
                                  {displayText}
                                </span>
                              )}

                              {isValidUrl(url) && (
                                <ExternalLink className="w-3 h-3 text-[#9E9E9E] flex-shrink-0" />
                              )}

                              {/* Show channel name for YouTube videos */}
                              {isYouTube && channelName && (
                                <span className="text-xs text-[#FF0000] bg-red-50 px-2 py-0.5 rounded flex-shrink-0">
                                  {channelName}
                                </span>
                              )}

                              <span className="text-xs text-[#9E9E9E] flex-shrink-0">
                                {itemCitations} {itemCitations === 1 ? 'citation' : 'citations'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {!showAll && sources.length > initialLimit && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-[#2196F3] hover:text-[#1976D2] font-medium"
          >
            Show {sources.length - initialLimit} more domains
          </button>
        </div>
      )}

      {showAll && sources.length > initialLimit && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(false)}
            className="text-sm text-[#2196F3] hover:text-[#1976D2] font-medium"
          >
            Show less
          </button>
        </div>
      )}
    </div>
  );
}

SourcesTable.propTypes = {
  sources: PropTypes.arrayOf(
    PropTypes.shape({
      domain: PropTypes.string,
      source_type: PropTypes.string,
      sourceType: PropTypes.string,
      citations: PropTypes.number,
      count: PropTypes.number,
      usageFrequency: PropTypes.number,
      competitor_name: PropTypes.string,
      youtube_channel: PropTypes.string,
      isYouTube: PropTypes.bool,
      icon_url: PropTypes.string,
      logo_url: PropTypes.string,
      urls: PropTypes.array,
      pages: PropTypes.array,
      videos: PropTypes.array
    })
  ),
  showUsageFrequency: PropTypes.bool,
  initialLimit: PropTypes.number
};

// Export color palette for use by parent components
export { SOURCE_COLORS, generateDomainIconUrl };
