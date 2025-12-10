import PropTypes from 'prop-types';
import { useState } from 'react';

/**
 * ImpactEffortMatrix Component
 * Interactive 2x2 grid with clickable dots representing opportunities
 */
export default function ImpactEffortMatrix({ opportunities, onOpportunityClick, selectedId }) {
  const [hoveredId, setHoveredId] = useState(null);

  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
        <h3 className="text-lg font-medium text-[#212121] mb-4">
          Impact-Effort Matrix
        </h3>
        <div className="text-center py-12 text-[#757575]">
          No opportunities to display
        </div>
      </div>
    );
  }

  // Get color for priority tier
  const getColor = (tier) => {
    switch (tier) {
      case 'Critical': return { bg: '#EF5350', hover: '#D32F2F' };
      case 'Strategic': return { bg: '#FF9800', hover: '#F57C00' };
      case 'Quick Wins': return { bg: '#FDD835', hover: '#F9A825' };
      case 'Low Priority': return { bg: '#9E9E9E', hover: '#757575' };
      default: return { bg: '#9E9E9E', hover: '#757575' };
    }
  };

  // Calculate position on the matrix (scaled to 0-100%)
  const getPosition = (opp) => {
    const impactScore = opp.scores?.impact_score || 0;
    const effortScore = opp.scores?.effort_score || 0;

    // X axis: effort (left = low effort, right = high effort)
    // Y axis: impact (bottom = low impact, top = high impact)
    const x = Math.min(Math.max(effortScore * 100, 5), 95);
    const y = Math.min(Math.max((1 - impactScore) * 100, 5), 95); // Inverted for top = high

    return { x, y };
  };

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
      <h3 className="text-lg font-medium text-[#212121] mb-1">
        Impact-Effort Matrix
      </h3>
      <p className="text-sm text-[#757575] mb-4">
        Click on dots to view opportunity details
      </p>

      {/* Matrix Container */}
      <div className="relative">
        {/* Quadrant labels */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none z-0">
          {/* Top-Left: Critical (High Impact, Low Effort) */}
          <div className="bg-red-50 border-r border-b border-gray-200 flex items-center justify-center">
            <span className="text-red-300 text-xs font-medium uppercase tracking-wider">
              Critical
            </span>
          </div>
          {/* Top-Right: Strategic (High Impact, High Effort) */}
          <div className="bg-orange-50 border-b border-gray-200 flex items-center justify-center">
            <span className="text-orange-300 text-xs font-medium uppercase tracking-wider">
              Strategic
            </span>
          </div>
          {/* Bottom-Left: Quick Wins (Low Impact, Low Effort) */}
          <div className="bg-yellow-50 border-r border-gray-200 flex items-center justify-center">
            <span className="text-yellow-400 text-xs font-medium uppercase tracking-wider">
              Quick Wins
            </span>
          </div>
          {/* Bottom-Right: Low Priority (Low Impact, High Effort) */}
          <div className="bg-gray-50 flex items-center justify-center">
            <span className="text-gray-300 text-xs font-medium uppercase tracking-wider">
              Low Priority
            </span>
          </div>
        </div>

        {/* Plot area */}
        <div className="relative h-80 z-10">
          {opportunities.map(opp => {
            const pos = getPosition(opp);
            const color = getColor(opp.priority?.tier);
            const isSelected = selectedId === opp.id;
            const isHovered = hoveredId === opp.id;

            return (
              <button
                key={opp.id}
                onClick={() => onOpportunityClick(opp.id)}
                onMouseEnter={() => setHoveredId(opp.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  zIndex: isSelected || isHovered ? 20 : 10
                }}
              >
                <div
                  className={`
                    rounded-full transition-all duration-200
                    ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
                  `}
                  style={{
                    width: isSelected || isHovered ? '16px' : '12px',
                    height: isSelected || isHovered ? '16px' : '12px',
                    backgroundColor: isHovered ? color.hover : color.bg,
                    boxShadow: isSelected || isHovered ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.15)'
                  }}
                />

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg pointer-events-none">
                    <div className="font-medium truncate">{opp.title}</div>
                    <div className="text-gray-300 mt-1">
                      Impact: {Math.round((opp.scores?.impact_score || 0) * 100)}% |
                      Effort: {Math.round((opp.scores?.effort_score || 0) * 100)}%
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Axis labels */}
        <div className="flex justify-between mt-2 text-xs text-[#757575]">
          <span>Low Effort</span>
          <span className="font-medium">EFFORT</span>
          <span>High Effort</span>
        </div>

        {/* Y-axis label */}
        <div className="absolute left-0 top-1/2 transform -translate-x-8 -rotate-90 text-xs text-[#757575] whitespace-nowrap">
          <span>Low Impact</span>
          <span className="mx-4 font-medium">IMPACT</span>
          <span>High Impact</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-100">
        {['Critical', 'Strategic', 'Quick Wins', 'Low Priority'].map(tier => {
          const color = getColor(tier);
          const count = opportunities.filter(o => o.priority?.tier === tier).length;

          return (
            <div key={tier} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color.bg }}
              />
              <span className="text-xs text-[#757575]">
                {tier} ({count})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

ImpactEffortMatrix.propTypes = {
  opportunities: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      scores: PropTypes.shape({
        impact_score: PropTypes.number,
        effort_score: PropTypes.number
      }),
      priority: PropTypes.shape({
        tier: PropTypes.string
      })
    })
  ),
  onOpportunityClick: PropTypes.func.isRequired,
  selectedId: PropTypes.string
};
