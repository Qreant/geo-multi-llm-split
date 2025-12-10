import PropTypes from 'prop-types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * CategoryRankingTable Component
 * Displays category performance rankings with visibility, SOV, and trend indicators
 */
export default function CategoryRankingTable({ categoryMetrics = [], entity = '' }) {
  if (!categoryMetrics || categoryMetrics.length === 0) {
    return (
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#212121] mb-1">Category Performance</h3>
        <p className="text-sm text-[#757575]">No category data available</p>
      </div>
    );
  }

  // Sort by SOV descending
  const sortedCategories = [...categoryMetrics].sort((a, b) => (b.sov || 0) - (a.sov || 0));

  const getTrendIcon = (trend) => {
    if (trend === undefined || trend === null || trend === 0) {
      return <Minus className="w-4 h-4 text-[#9E9E9E]" />;
    }
    if (trend > 0) {
      return (
        <div className="flex items-center gap-1 text-[#4CAF50]">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-medium">{trend}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-[#EF5350]">
        <TrendingDown className="w-4 h-4" />
        <span className="text-xs font-medium">{Math.abs(trend)}</span>
      </div>
    );
  };

  // Format percentage with 1 decimal
  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(0)}%`;
  };

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-[#212121] mb-1">Category Performance</h3>
        <p className="text-sm text-[#757575]">
          Rankings by Share of Voice for {entity}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E0E0E0]">
              <th className="text-left py-3 px-2 text-xs font-medium text-[#757575] uppercase tracking-wider w-12">
                #
              </th>
              <th className="text-left py-3 px-2 text-xs font-medium text-[#757575] uppercase tracking-wider">
                Category
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">
                Visibility
              </th>
              <th className="text-center py-3 px-4 text-xs font-medium text-[#757575] uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCategories.map((cat, idx) => (
              <tr
                key={`${cat.categoryId}-${cat.marketCode}`}
                className="border-b border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors"
              >
                <td className="py-4 px-2">
                  <span className="text-sm font-medium text-[#9E9E9E]">{idx + 1}</span>
                </td>
                <td className="py-4 px-2">
                  <div className="text-sm font-medium text-[#212121]">
                    {cat.marketLabel || cat.categoryName}
                  </div>
                  {cat.marketCode && cat.marketCode !== 'default' && !cat.marketLabel?.includes('(') && (
                    <div className="text-xs text-[#9E9E9E]">{cat.marketCode}</div>
                  )}
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-sm font-semibold text-[#212121]">
                    {formatPercent(cat.visibility)}
                  </span>
                </td>
                <td className="py-4 px-4 text-center">
                  {getTrendIcon(cat.trend)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

CategoryRankingTable.propTypes = {
  categoryMetrics: PropTypes.arrayOf(
    PropTypes.shape({
      categoryId: PropTypes.string,
      categoryName: PropTypes.string,
      marketCode: PropTypes.string,
      marketLabel: PropTypes.string,
      visibility: PropTypes.number,
      sov: PropTypes.number,
      avgPosition: PropTypes.number,
      mentions: PropTypes.number,
      winRate: PropTypes.number,
      trend: PropTypes.number
    })
  ),
  entity: PropTypes.string
};
