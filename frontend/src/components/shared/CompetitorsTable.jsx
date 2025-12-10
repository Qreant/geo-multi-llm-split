import { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * CompetitorsTable Component
 * Sortable table displaying competitor performance metrics
 * Used in Competitive analysis to show rankings and comparative data
 */
const CompetitorsTable = ({ competitors, entity, className = '' }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });

  if (!competitors || competitors.length === 0) {
    return (
      <div className="card-base p-8 text-center">
        <p className="text-[#757575]">No competitor data available</p>
      </div>
    );
  }

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedCompetitors = [...competitors].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === bValue) return 0;

    const comparison = aValue < bValue ? -1 : 1;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ChevronUp className="w-4 h-4 text-[#BDBDBD]" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-4 h-4 text-[#10B981]" />
      : <ChevronDown className="w-4 h-4 text-[#10B981]" />;
  };

  const formatPercentage = (value) => {
    if (typeof value !== 'number') return value;
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatNumber = (value) => {
    if (typeof value !== 'number') return value;
    return value.toFixed(1);
  };

  return (
    <div className={`card-base overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E0E0E0]">
              <th
                onClick={() => handleSort('rank')}
                className="px-4 py-3 text-left text-sm font-medium text-[#757575] cursor-pointer hover:text-[#212121] transition-colors"
              >
                <div className="flex items-center gap-1">
                  Rank
                  <SortIcon columnKey="rank" />
                </div>
              </th>
              <th
                onClick={() => handleSort('name')}
                className="px-4 py-3 text-left text-sm font-medium text-[#757575] cursor-pointer hover:text-[#212121] transition-colors"
              >
                <div className="flex items-center gap-1">
                  Brand
                  <SortIcon columnKey="name" />
                </div>
              </th>
              <th
                onClick={() => handleSort('sov')}
                className="px-4 py-3 text-right text-sm font-medium text-[#757575] cursor-pointer hover:text-[#212121] transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  SOV %
                  <SortIcon columnKey="sov" />
                </div>
              </th>
              <th
                onClick={() => handleSort('visibility')}
                className="px-4 py-3 text-right text-sm font-medium text-[#757575] cursor-pointer hover:text-[#212121] transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  Visibility %
                  <SortIcon columnKey="visibility" />
                </div>
              </th>
              <th
                onClick={() => handleSort('avgPosition')}
                className="px-4 py-3 text-right text-sm font-medium text-[#757575] cursor-pointer hover:text-[#212121] transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  Avg Position
                  <SortIcon columnKey="avgPosition" />
                </div>
              </th>
              <th
                onClick={() => handleSort('mentions')}
                className="px-4 py-3 text-right text-sm font-medium text-[#757575] cursor-pointer hover:text-[#212121] transition-colors"
              >
                <div className="flex items-center justify-end gap-1">
                  Mentions
                  <SortIcon columnKey="mentions" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCompetitors.map((competitor, index) => {
              const isEntity = competitor.name === entity;
              return (
                <tr
                  key={index}
                  className={`border-b border-[#F4F6F8] hover:bg-[#F0FDF4] transition-colors ${
                    isEntity ? 'bg-[#FFF3E0]' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-[#212121] font-medium">
                    {competitor.rank || index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#212121] font-medium">
                    {competitor.name}
                    {isEntity && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-[#EF5350] text-white">
                        You
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#212121] text-right">
                    {formatPercentage(competitor.sov)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#212121] text-right">
                    {formatPercentage(competitor.visibility)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#212121] text-right">
                    {formatNumber(competitor.avgPosition)}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#212121] text-right">
                    {competitor.mentions || 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

CompetitorsTable.propTypes = {
  competitors: PropTypes.arrayOf(
    PropTypes.shape({
      rank: PropTypes.number,
      name: PropTypes.string.isRequired,
      sov: PropTypes.number,
      visibility: PropTypes.number,
      avgPosition: PropTypes.number,
      mentions: PropTypes.number
    })
  ).isRequired,
  entity: PropTypes.string.isRequired,
  className: PropTypes.string
};

export default CompetitorsTable;
