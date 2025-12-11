import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { Link2 } from 'lucide-react';
import SourcesTable, { SOURCE_COLORS } from './SourcesTable';

/**
 * AggregatedSourceAnalysis Component
 * Displays citation type breakdown and top domains aggregated across all categories
 */
export default function AggregatedSourceAnalysis({ sourceAnalysis }) {
  if (!sourceAnalysis) {
    return null;
  }

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

  // Transform topDomains to match SourcesTable expected format
  const transformedSources = useMemo(() => {
    const topDomains = sourceAnalysis?.topDomains || [];
    return topDomains.map(domain => ({
      domain: domain.domain,
      source_type: domain.sourceType,
      sourceType: domain.sourceType,
      citations: domain.citations,
      isYouTube: domain.isYouTube,
      youtube_channel: domain.youtubeChannel,
      // Map videos/pages to urls array for SourcesTable
      urls: domain.isYouTube && domain.videos
        ? domain.videos.map(v => ({ url: v.url, title: v.title, citations: 1 }))
        : domain.pages
          ? domain.pages.map(p => ({ url: p.url, title: p.title, citations: 1 }))
          : []
    }));
  }, [sourceAnalysis]);

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-[#757575]" />
          <div>
            <h3 className="text-lg font-medium text-[#212121]">AI Citation Sources</h3>
            <p className="text-sm text-[#757575]">
              {sourceAnalysis.totalSources || 0} sources across all categories
            </p>
          </div>
        </div>
      </div>

      {/* Citation Type Breakdown - Horizontal Stacked Bar */}
      {stackedBarData.length > 0 && (
        <div className="mb-6">
          {/* Stacked Bar */}
          <div className="h-8 rounded-lg overflow-hidden flex mb-3">
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
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {stackedBarData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-[#212121] font-medium">{item.name}</span>
                <span className="text-xs text-[#757575]">
                  {item.count} ({item.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Citation Domains Table */}
      {transformedSources.length > 0 && (
        <div className="border-t border-[#E0E0E0] pt-5">
          <SourcesTable
            sources={transformedSources}
            showUsageFrequency={false}
            initialLimit={10}
          />
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
        youtubeChannel: PropTypes.string,
        videos: PropTypes.arrayOf(
          PropTypes.shape({
            url: PropTypes.string,
            title: PropTypes.string,
            videoId: PropTypes.string
          })
        ),
        pages: PropTypes.arrayOf(
          PropTypes.shape({
            url: PropTypes.string,
            title: PropTypes.string
          })
        )
      })
    )
  })
};
