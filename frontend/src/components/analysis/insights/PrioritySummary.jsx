import PropTypes from 'prop-types';
import { AlertCircle, Target, Zap, Clock } from 'lucide-react';

/**
 * PrioritySummary Component
 * Displays 4 priority cards for filtering opportunities
 */
export default function PrioritySummary({ summary, activeFilter, onFilterChange }) {
  const {
    critical = 0,
    strategic = 0,
    quick_wins = 0,
    low_priority = 0
  } = summary || {};

  const total = critical + strategic + quick_wins + low_priority;

  const cards = [
    {
      key: 'Critical',
      label: 'Critical',
      count: critical,
      icon: AlertCircle,
      description: 'High Impact, Low Effort',
      timeline: '1-3 months',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      activeBorderColor: 'border-red-500',
      textColor: 'text-red-700',
      iconColor: 'text-red-500',
      ringColor: 'ring-red-500'
    },
    {
      key: 'Strategic',
      label: 'Strategic',
      count: strategic,
      icon: Target,
      description: 'High Impact, High Effort',
      timeline: '6-12 months',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      activeBorderColor: 'border-orange-500',
      textColor: 'text-orange-700',
      iconColor: 'text-orange-500',
      ringColor: 'ring-orange-500'
    },
    {
      key: 'Quick Wins',
      label: 'Quick Wins',
      count: quick_wins,
      icon: Zap,
      description: 'Low Impact, Low Effort',
      timeline: '1-2 months',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      activeBorderColor: 'border-yellow-500',
      textColor: 'text-yellow-700',
      iconColor: 'text-yellow-600',
      ringColor: 'ring-yellow-500'
    },
    {
      key: 'Low Priority',
      label: 'Low Priority',
      count: low_priority,
      icon: Clock,
      description: 'Low Impact, High Effort',
      timeline: '12+ months',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      activeBorderColor: 'border-gray-500',
      textColor: 'text-gray-700',
      iconColor: 'text-gray-500',
      ringColor: 'ring-gray-500'
    }
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-[#212121]">
          Priority Overview
        </h3>
        {activeFilter && (
          <button
            onClick={() => onFilterChange(null)}
            className="text-sm text-[#1976D2] hover:text-[#1565C0] hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          const isActive = activeFilter === card.key;
          const isClickable = card.count > 0;

          return (
            <button
              key={card.key}
              onClick={() => isClickable && onFilterChange(isActive ? null : card.key)}
              disabled={!isClickable}
              className={`
                relative p-4 rounded-lg border-2 text-left transition-all
                ${card.bgColor} ${isActive ? card.activeBorderColor : card.borderColor}
                ${isClickable ? 'cursor-pointer hover:shadow-md' : 'cursor-default opacity-60'}
                ${isActive ? `ring-2 ${card.ringColor} ring-opacity-50` : ''}
              `}
            >
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <span className={`text-2xl font-bold ${card.textColor}`}>
                  {card.count}
                </span>
              </div>

              <div className="mt-3">
                <h4 className={`font-medium ${card.textColor}`}>
                  {card.label}
                </h4>
                <p className="text-xs text-[#757575] mt-1">
                  {card.description}
                </p>
                <p className="text-xs text-[#9E9E9E] mt-0.5">
                  {card.timeline}
                </p>
              </div>

              {isActive && (
                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${card.iconColor.replace('text-', 'bg-')}`} />
              )}
            </button>
          );
        })}
      </div>

      {total === 0 && (
        <div className="text-center py-8 text-[#757575]">
          No opportunities generated yet. Run an analysis to see recommendations.
        </div>
      )}
    </div>
  );
}

PrioritySummary.propTypes = {
  summary: PropTypes.shape({
    critical: PropTypes.number,
    strategic: PropTypes.number,
    quick_wins: PropTypes.number,
    low_priority: PropTypes.number
  }),
  activeFilter: PropTypes.string,
  onFilterChange: PropTypes.func.isRequired
};
