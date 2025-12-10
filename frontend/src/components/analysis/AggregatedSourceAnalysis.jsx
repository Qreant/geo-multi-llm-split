import PropTypes from 'prop-types';
import React, { useMemo, useState } from 'react';
import { Link2, ExternalLink, ChevronDown, ChevronRight, Play } from 'lucide-react';

/**
 * AggregatedSourceAnalysis Component
 * Displays citation type breakdown and top domains aggregated across all categories
 */
export default function AggregatedSourceAnalysis({ sourceAnalysis }) {
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [expandedYouTube, setExpandedYouTube] = useState({});

  if (!sourceAnalysis) {
    return null;
  }

  // Toggle YouTube expansion
  const toggleYouTubeExpand = (domain) => {
    setExpandedYouTube(prev => ({
      ...prev,
      [domain]: !prev[domain]
    }));
  };

  // Color palette for source types (matches SourceAnalysis)
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

  // Prepare stacked bar data from source type distribution
  const stackedBarData = useMemo(() => {
    const data = [];
    if (sourceAnalysis?.sourceTypeDistribution) {
      const total = Object.values(sourceAnalysis.sourceTypeDistribution).reduce((sum, count) => sum + count, 0);

      Object.entries(sourceAnalysis.sourceTypeDistribution).forEach(([type, count]) => {
        if (count > 0) {
          data.push({
            name: type,
            count: count,
            percentage: total > 0 ? (count / total) * 100 : 0,
            color: SOURCE_COLORS[type] || SOURCE_COLORS['Other']
          });
        }
      });
    }
    // Sort by count descending
    data.sort((a, b) => b.count - a.count);
    return data;
  }, [sourceAnalysis]);

  const topDomains = sourceAnalysis?.topDomains || [];

  return (
    <div className="space-y-6">
      {/* Citation Type Breakdown - Horizontal Stacked Bar */}
      {stackedBarData.length > 0 && (
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-[#212121] mb-1">
              Citation Type Breakdown
            </h3>
            <p className="text-sm text-[#757575]">
              Source distribution across all categories ({sourceAnalysis.totalSources || 0} sources)
            </p>
          </div>

          {/* Stacked Bar */}
          <div className="h-10 rounded-lg overflow-hidden flex mb-4">
            {stackedBarData.map((item, idx) => (
              <div
                key={idx}
                className="h-full transition-all duration-300 hover:opacity-80 cursor-pointer"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                  minWidth: item.percentage > 0 ? '2px' : '0'
                }}
                title={`${item.name}: ${item.count} (${item.percentage.toFixed(0)}%)`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {stackedBarData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-[#212121] font-medium">{item.name}</span>
                <span className="text-sm text-[#757575]">
                  {item.count} ({item.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Citation Domains */}
      {topDomains.length > 0 && (
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#757575]" />
              <h3 className="text-lg font-medium text-[#212121]">Top Citation Sources</h3>
            </div>
            {topDomains.length > 10 && (
              <button
                onClick={() => setShowAllDomains(!showAllDomains)}
                className="px-3 py-1.5 text-sm font-medium text-[#212121] bg-white border border-[#E0E0E0] rounded hover:bg-[#F5F5F5] transition-colors"
              >
                {showAllDomains ? 'Show Less' : 'Show All'}
              </button>
            )}
          </div>
          <p className="text-sm text-[#757575] mb-6">
            Most frequently cited domains across all analyzed categories
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E0E0E0]">
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">
                    Source Type
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">
                    Citations
                  </th>
                </tr>
              </thead>
              <tbody>
                {(showAllDomains ? topDomains : topDomains.slice(0, 10)).map((domain, idx) => {
                  const sourceTypeColor = SOURCE_COLORS[domain.sourceType] || SOURCE_COLORS['Other'];
                  const domainInitial = domain.domain ? domain.domain.charAt(0).toUpperCase() : 'S';
                  const isYouTube = domain.isYouTube && domain.videos && domain.videos.length > 0;
                  const isExpanded = expandedYouTube[domain.domain];

                  return (
                    <React.Fragment key={idx}>
                      <tr className={`border-b border-[#F5F5F5] hover:bg-[#FAFAFA] ${isYouTube ? 'cursor-pointer' : ''}`}
                        onClick={isYouTube ? () => toggleYouTubeExpand(domain.domain) : undefined}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {/* YouTube expand/collapse icon */}
                            {isYouTube && (
                              <button className="p-1 hover:bg-[#E0E0E0] rounded transition-colors">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-[#757575]" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-[#757575]" />
                                )}
                              </button>
                            )}
                            <div className={`w-8 h-8 rounded ${isYouTube ? 'bg-red-100' : 'bg-[#F5F5F5]'} flex items-center justify-center text-xs font-medium ${isYouTube ? 'text-red-600' : 'text-[#757575]'} flex-shrink-0`}>
                              {isYouTube ? (
                                <Play className="w-4 h-4 fill-current" />
                              ) : (
                                domainInitial
                              )}
                            </div>
                            {isYouTube ? (
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-[#212121]">
                                  {domain.domain}
                                </span>
                                <span className="text-xs text-[#757575]">
                                  {domain.videos.length} video{domain.videos.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            ) : (
                              <a
                                href={`https://${domain.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-[#212121] hover:text-[#1976D2] transition-colors flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="truncate max-w-[250px]">{domain.domain}</span>
                                <ExternalLink className="w-3 h-3 flex-shrink-0 text-[#9E9E9E]" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: `${sourceTypeColor}20`,
                              color: sourceTypeColor
                            }}
                          >
                            {domain.sourceType}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-sm font-medium text-[#212121]">
                            {domain.citations}
                          </span>
                        </td>
                      </tr>
                      {/* YouTube videos expanded list */}
                      {isYouTube && isExpanded && (
                        <tr className="bg-[#FAFAFA]">
                          <td colSpan={3} className="px-4 py-2">
                            <div className="ml-12 space-y-2">
                              {domain.videos.map((video, vidIdx) => (
                                <div key={vidIdx} className="flex items-center gap-2 py-1.5 px-3 bg-white rounded border border-[#E0E0E0] hover:border-[#BDBDBD] transition-colors">
                                  <Play className="w-3 h-3 text-red-500 flex-shrink-0" />
                                  <a
                                    href={video.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-[#212121] hover:text-[#1976D2] transition-colors flex-1 truncate"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {video.title}
                                  </a>
                                  <ExternalLink className="w-3 h-3 text-[#9E9E9E] flex-shrink-0" />
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!showAllDomains && topDomains.length > 10 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowAllDomains(true)}
                className="text-sm text-[#2196F3] hover:text-[#1976D2] font-medium"
              >
                Show {topDomains.length - 10} more domains
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

AggregatedSourceAnalysis.propTypes = {
  sourceAnalysis: PropTypes.shape({
    totalSources: PropTypes.number,
    sourceTypeDistribution: PropTypes.object,
    topDomains: PropTypes.arrayOf(
      PropTypes.shape({
        domain: PropTypes.string,
        citations: PropTypes.number,
        sourceType: PropTypes.string,
        isYouTube: PropTypes.bool,
        videos: PropTypes.arrayOf(
          PropTypes.shape({
            url: PropTypes.string,
            title: PropTypes.string,
            videoId: PropTypes.string
          })
        )
      })
    )
  })
};
