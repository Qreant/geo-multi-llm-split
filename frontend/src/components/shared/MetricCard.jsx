import PropTypes from 'prop-types';

/**
 * MetricCard Component
 * Displays a single metric with icon, label, and value
 * Used in Visibility analysis for key metrics (Visibility %, SOV %, Avg Position, Total Mentions)
 */
const MetricCard = ({ icon: Icon, label, value, trend, className = '' }) => {
  const formattedValue = typeof value === 'number'
    ? value.toLocaleString('en-US', { maximumFractionDigits: 1 })
    : value;

  return (
    <div className={`card-base flex flex-col items-center text-center p-6 ${className}`}>
      {/* Icon Circle */}
      <div className="w-12 h-12 rounded-full bg-[#E3F2FD] flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-[#2196F3]" />
      </div>

      {/* Label */}
      <p className="text-sm text-[#757575] mb-1 font-medium">{label}</p>

      {/* Value */}
      <p className="text-5xl font-light text-[#212121]">{formattedValue}</p>

      {/* Trend Indicator (optional) */}
      {trend !== undefined && trend !== null && (
        <div className={`mt-2 flex items-center text-sm font-medium ${
          trend > 0 ? 'text-[#4CAF50]' : trend < 0 ? 'text-[#EF5350]' : 'text-[#757575]'
        }`}>
          {trend > 0 && (
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          {trend < 0 && (
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  );
};

MetricCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  trend: PropTypes.number,
  className: PropTypes.string
};

export default MetricCard;
