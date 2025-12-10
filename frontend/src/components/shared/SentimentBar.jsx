import PropTypes from 'prop-types';

/**
 * SentimentBar Component
 * Displays a sentiment topic with a horizontal progress bar and sentiment badge
 * Used in Reputation analysis to show topic frequency and sentiment
 */
const SentimentBar = ({ concept, sentiment, frequency, className = '' }) => {
  // Sentiment color mapping (Social Analytics design system)
  const getSentimentStyles = () => {
    const sentimentLower = sentiment.toLowerCase();

    if (sentimentLower === 'positive' || sentimentLower === 'very positive') {
      return {
        badgeClass: 'sentiment-badge-positive',
        barClass: 'bg-[#4CAF50]'
      };
    } else if (sentimentLower === 'negative' || sentimentLower === 'very negative') {
      return {
        badgeClass: 'sentiment-badge-negative',
        barClass: 'bg-[#EF5350]'
      };
    } else {
      return {
        badgeClass: 'sentiment-badge-neutral',
        barClass: 'bg-[#9E9E9E]'
      };
    }
  };

  const { badgeClass, barClass } = getSentimentStyles();

  // Calculate width percentage (frequency is 0-1, convert to 0-100)
  const widthPercentage = Math.min(Math.max(frequency * 100, 0), 100);

  return (
    <div className={`bg-[#F4F6F8] rounded-lg p-4 ${className}`}>
      {/* Header with concept and sentiment badge */}
      <div className="flex justify-between items-center mb-2 gap-3">
        <span className="text-sm font-medium text-[#212121] flex-1 min-w-0">
          {concept}
        </span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${badgeClass}`}>
          {sentiment}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${barClass}`}
          style={{ width: `${widthPercentage}%` }}
          role="progressbar"
          aria-valuenow={widthPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Frequency percentage */}
      <div className="mt-1 text-xs text-[#757575] text-right">
        {widthPercentage.toFixed(1)}%
      </div>
    </div>
  );
};

SentimentBar.propTypes = {
  concept: PropTypes.string.isRequired,
  sentiment: PropTypes.string.isRequired,
  frequency: PropTypes.number.isRequired,
  className: PropTypes.string
};

export default SentimentBar;
