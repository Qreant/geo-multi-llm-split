import PropTypes from 'prop-types';

/**
 * MetricCard Component
 * Displays a single metric with circular progress ring, icon, label, and value
 * Used in Overview and Visibility analysis for key metrics
 */
const MetricCard = ({
  icon: Icon,
  label,
  subtitle,
  value,
  progress,
  color = '#2196F3',
  status,
  statusColor,
  className = ''
}) => {
  const formattedValue = typeof value === 'number'
    ? value.toLocaleString('en-US', { maximumFractionDigits: 1 })
    : value;

  // Calculate progress percentage (0-100)
  const progressPercent = progress !== undefined ? Math.min(Math.max(progress, 0), 100) : null;

  return (
    <div className={`bg-white border border-[#E0E0E0] rounded-lg p-5 ${className}`}>
      {/* Header */}
      <h3 className="text-base font-medium text-[#212121] mb-0.5">{label}</h3>
      {subtitle && <p className="text-xs text-[#757575] mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}

      <div className="flex items-center gap-4">
        {/* Circular Progress Ring */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="transform -rotate-90 w-20 h-20">
            {/* Background circle */}
            <circle
              cx="40"
              cy="40"
              r="34"
              stroke="#F5F5F5"
              strokeWidth="6"
              fill="none"
            />
            {/* Progress circle */}
            {progressPercent !== null && (
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke={color}
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - progressPercent / 100)}`}
                strokeLinecap="round"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>

        {/* Value */}
        <div>
          <div className="text-3xl font-light text-[#212121]">
            {formattedValue}
          </div>
          {status && statusColor && (
            <div className="flex items-center gap-1.5 mt-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <span className="text-xs font-medium" style={{ color: statusColor }}>
                {status}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

MetricCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  progress: PropTypes.number,
  color: PropTypes.string,
  status: PropTypes.string,
  statusColor: PropTypes.string,
  className: PropTypes.string
};

export default MetricCard;
