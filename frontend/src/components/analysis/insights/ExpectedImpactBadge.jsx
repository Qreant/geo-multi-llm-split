import PropTypes from 'prop-types';
import { TrendingUp, Eye, Award, Heart } from 'lucide-react';

/**
 * ExpectedImpactBadge Component
 * Displays expected impact metrics as colorful badges
 */
export default function ExpectedImpactBadge({ impact, size = 'md' }) {
  if (!impact) return null;

  const {
    visibility_increase,
    authority_boost,
    sentiment_improvement
  } = impact;

  const formatPercent = (value) => {
    if (!value && value !== 0) return null;
    const rounded = Math.round(value * 100) / 100;
    return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
  };

  const badges = [
    {
      key: 'visibility',
      label: 'Visibility',
      value: formatPercent(visibility_increase),
      icon: Eye,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-500'
    },
    {
      key: 'authority',
      label: 'Authority',
      value: formatPercent(authority_boost),
      icon: Award,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-500'
    },
    {
      key: 'sentiment',
      label: 'Sentiment',
      value: formatPercent(sentiment_improvement),
      icon: Heart,
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      iconColor: 'text-green-500'
    }
  ].filter(b => b.value !== null);

  if (badges.length === 0) return null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map(({ key, label, value, icon: Icon, bgColor, textColor, iconColor }) => (
        <div
          key={key}
          className={`flex items-center gap-1.5 rounded-full ${bgColor} ${sizeClasses[size]}`}
        >
          <Icon className={`${iconSizes[size]} ${iconColor}`} />
          <span className={`font-medium ${textColor}`}>
            {label}: {value}
          </span>
        </div>
      ))}
    </div>
  );
}

ExpectedImpactBadge.propTypes = {
  impact: PropTypes.shape({
    visibility_increase: PropTypes.number,
    authority_boost: PropTypes.number,
    sentiment_improvement: PropTypes.number
  }),
  size: PropTypes.oneOf(['sm', 'md', 'lg'])
};
