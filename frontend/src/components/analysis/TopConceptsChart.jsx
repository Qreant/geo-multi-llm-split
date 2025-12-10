import { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

/**
 * TopConceptsChart Component
 * Displays sentiment-categorized topics in a three-column layout with horizontal bars
 * Each topic is expandable to show quotes and sources
 */
export default function TopConceptsChart({ sentimentTopics, className = '' }) {
  // Track which topics are expanded (key: "sentiment-index")
  const [expandedTopics, setExpandedTopics] = useState({});

  if (!sentimentTopics) {
    return null;
  }

  // Normalize: support both neutral_topics and mixed_topics for backwards compatibility
  const {
    positive_topics = [],
    neutral_topics = [],
    mixed_topics = [],
    negative_topics = []
  } = sentimentTopics;

  // Use neutral_topics if available, fall back to mixed_topics for legacy data
  const neutralTopics = neutral_topics.length > 0 ? neutral_topics : mixed_topics;

  // Find max frequency for scaling bars
  const allTopics = [...positive_topics, ...neutralTopics, ...negative_topics];
  const maxFrequency = Math.max(...allTopics.map(t => t.frequency), 1);

  /**
   * Toggle expanded state for a topic
   */
  const toggleTopic = (key) => {
    setExpandedTopics(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  /**
   * Extract domain name from URL for display
   */
  const extractDomainName = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  /**
   * Render a single expandable topic bar
   */
  const TopicBar = ({ topic, index, sentiment, barColor, borderColor, bgColor }) => {
    const key = `${sentiment}-${index}`;
    const isExpanded = expandedTopics[key];
    const widthPercent = (topic.frequency / maxFrequency) * 100;

    // Get quotes
    const quotes = topic.quotes?.slice(0, 2).map(q =>
      typeof q === 'string' ? q : q.text
    ).filter(Boolean) || [];

    // Check if there's content to show
    const hasDetails = quotes.length > 0 || (topic.sources && topic.sources.length > 0);

    return (
      <div className={`mb-3 rounded-lg border ${borderColor} overflow-hidden`}>
        {/* Clickable Header with Bar */}
        <button
          onClick={() => hasDetails && toggleTopic(key)}
          className={`w-full p-3 ${bgColor} ${hasDetails ? 'hover:opacity-90 cursor-pointer' : 'cursor-default'} transition-opacity`}
          disabled={!hasDetails}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 flex-1">
              {hasDetails && (
                <span className="text-[#757575]">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>
              )}
              <span className="text-sm text-[#212121] font-medium">{topic.topic}</span>
            </div>
            <span className="text-xs text-[#757575] font-medium">
              {Math.round(topic.frequency * 100)}%
            </span>
          </div>
          <div className="h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${barColor}`}
              style={{ width: `${widthPercent}%` }}
            />
          </div>
        </button>

        {/* Collapsible Details */}
        {isExpanded && hasDetails && (
          <div className="px-3 py-3 bg-white border-t border-[#E0E0E0] space-y-3">
            {/* Quotes */}
            {quotes.length > 0 && (
              <div className="space-y-2">
                {quotes.map((quote, qIdx) => (
                  <div
                    key={qIdx}
                    className={`border-l-[3px] ${borderColor} pl-3 py-1`}
                  >
                    <p className="text-xs text-[#616161] italic leading-relaxed">
                      "{quote.length > 120 ? quote.substring(0, 120) + '...' : quote}"
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Sources */}
            {topic.sources && topic.sources.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] font-medium text-[#9E9E9E] uppercase tracking-wide mb-1.5">
                  Sources
                </p>
                <div className="space-y-1">
                  {topic.sources.slice(0, 3).map((source, sIdx) => {
                    const url = typeof source === 'string' ? source : source.url;
                    const domain = typeof source === 'object' && source.domain
                      ? source.domain
                      : extractDomainName(url);

                    return (
                      <a
                        key={sIdx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-[#1976D2] hover:text-[#1565C0] hover:underline transition-colors"
                      >
                        <span>{domain}</span>
                        <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  TopicBar.propTypes = {
    topic: PropTypes.object.isRequired,
    index: PropTypes.number.isRequired,
    sentiment: PropTypes.string.isRequired,
    barColor: PropTypes.string.isRequired,
    borderColor: PropTypes.string.isRequired,
    bgColor: PropTypes.string.isRequired
  };

  /**
   * Render a column of topics
   */
  const TopicColumn = ({ title, topics, sentiment, barColor, borderColor, bgColor, dotColor }) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${dotColor}`} />
        <h4 className="text-sm font-medium text-[#757575] uppercase tracking-wide">
          {title}
        </h4>
        <span className="text-xs text-[#BDBDBD]">({topics.length})</span>
      </div>
      <div>
        {topics.length > 0 ? (
          topics.slice(0, 5).map((topic, index) => (
            <TopicBar
              key={index}
              topic={topic}
              index={index}
              sentiment={sentiment}
              barColor={barColor}
              borderColor={borderColor}
              bgColor={bgColor}
            />
          ))
        ) : (
          <p className="text-xs text-[#9E9E9E] italic py-4 text-center">
            No {title.toLowerCase()} topics
          </p>
        )}
      </div>
    </div>
  );

  TopicColumn.propTypes = {
    title: PropTypes.string.isRequired,
    topics: PropTypes.array.isRequired,
    sentiment: PropTypes.string.isRequired,
    barColor: PropTypes.string.isRequired,
    borderColor: PropTypes.string.isRequired,
    bgColor: PropTypes.string.isRequired,
    dotColor: PropTypes.string.isRequired
  };

  return (
    <div className={`bg-white border border-[#E0E0E0] rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-[#212121] mb-1">
          Top Concepts Associated with Your Brand
        </h3>
        <p className="text-sm text-[#757575]">
          Click on concepts to expand quotes and sources
        </p>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Positive Column */}
        <TopicColumn
          title="Positive"
          topics={positive_topics}
          sentiment="positive"
          barColor="bg-[#4CAF50]"
          borderColor="border-[#4CAF50]"
          bgColor="bg-[#E8F5E9]"
          dotColor="bg-[#4CAF50]"
        />

        {/* Mixed/Neutral Column */}
        <TopicColumn
          title="Mixed"
          topics={neutralTopics}
          sentiment="mixed"
          barColor="bg-[#FF9800]"
          borderColor="border-[#FF9800]"
          bgColor="bg-[#FFF3E0]"
          dotColor="bg-[#FF9800]"
        />

        {/* Negative Column */}
        <TopicColumn
          title="Negative"
          topics={negative_topics}
          sentiment="negative"
          barColor="bg-[#EF5350]"
          borderColor="border-[#EF5350]"
          bgColor="bg-[#FFEBEE]"
          dotColor="bg-[#EF5350]"
        />
      </div>
    </div>
  );
}

TopConceptsChart.propTypes = {
  sentimentTopics: PropTypes.shape({
    positive_topics: PropTypes.arrayOf(
      PropTypes.shape({
        topic: PropTypes.string.isRequired,
        frequency: PropTypes.number.isRequired,
        sentiment_score: PropTypes.number,
        quotes: PropTypes.array,
        sources: PropTypes.array
      })
    ),
    neutral_topics: PropTypes.arrayOf(
      PropTypes.shape({
        topic: PropTypes.string.isRequired,
        frequency: PropTypes.number.isRequired,
        sentiment_score: PropTypes.number,
        quotes: PropTypes.array,
        sources: PropTypes.array
      })
    ),
    mixed_topics: PropTypes.arrayOf(
      PropTypes.shape({
        topic: PropTypes.string.isRequired,
        frequency: PropTypes.number.isRequired,
        sentiment_score: PropTypes.number,
        quotes: PropTypes.array,
        sources: PropTypes.array
      })
    ),
    negative_topics: PropTypes.arrayOf(
      PropTypes.shape({
        topic: PropTypes.string.isRequired,
        frequency: PropTypes.number.isRequired,
        sentiment_score: PropTypes.number,
        quotes: PropTypes.array,
        sources: PropTypes.array
      })
    )
  }),
  className: PropTypes.string
};
