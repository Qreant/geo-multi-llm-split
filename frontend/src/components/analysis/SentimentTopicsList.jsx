import { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

/**
 * SentimentTopicsList Component
 * Displays sentiment topics in a 3-column layout (Positive | Mixed | Negative)
 * Each topic has collapsible details showing quotes and sources
 */
export default function SentimentTopicsList({ sentimentTopics, className = '' }) {
  // Track which topics are expanded (key: "sentiment-index")
  const [expandedTopics, setExpandedTopics] = useState({});

  if (!sentimentTopics) {
    return null;
  }

  // Normalize: support both neutral_topics and mixed_topics for backwards compatibility
  const {
    positive_topics = [],
    negative_topics = [],
    neutral_topics = [],
    mixed_topics = []
  } = sentimentTopics;

  // Use neutral_topics if available, fall back to mixed_topics for legacy data
  const mixedTopics = neutral_topics.length > 0 ? neutral_topics : mixed_topics;

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
   * Render a single collapsible topic card
   */
  const TopicCard = ({ topic, sentiment, index }) => {
    const key = `${sentiment}-${index}`;
    const isExpanded = expandedTopics[key];

    // Get quotes
    const quotes = topic.quotes?.slice(0, 2).map(q =>
      typeof q === 'string' ? q : q.text
    ).filter(Boolean) || [];

    // Check if there's content to show
    const hasDetails = quotes.length > 0 || (topic.sources && topic.sources.length > 0);

    // Color scheme based on sentiment
    const colors = {
      positive: {
        bg: 'bg-[#E8F5E9]',
        bgHover: 'hover:bg-[#C8E6C9]',
        border: 'border-[#4CAF50]',
        text: 'text-[#2E7D32]',
        icon: 'text-[#4CAF50]'
      },
      mixed: {
        bg: 'bg-[#FFF3E0]',
        bgHover: 'hover:bg-[#FFE0B2]',
        border: 'border-[#FF9800]',
        text: 'text-[#E65100]',
        icon: 'text-[#FF9800]'
      },
      negative: {
        bg: 'bg-[#FFEBEE]',
        bgHover: 'hover:bg-[#FFCDD2]',
        border: 'border-[#EF5350]',
        text: 'text-[#C62828]',
        icon: 'text-[#EF5350]'
      }
    };

    const colorScheme = colors[sentiment] || colors.mixed;

    return (
      <div className={`rounded-lg border ${colorScheme.border} overflow-hidden`}>
        {/* Topic Header - Always visible */}
        <button
          onClick={() => hasDetails && toggleTopic(key)}
          className={`w-full px-3 py-2.5 ${colorScheme.bg} ${hasDetails ? colorScheme.bgHover + ' cursor-pointer' : 'cursor-default'} transition-colors`}
          disabled={!hasDetails}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 text-left">
              <span className="text-sm font-medium text-[#212121]">
                {topic.topic}
              </span>
              {topic.frequency && (
                <span className={`ml-2 text-xs ${colorScheme.text}`}>
                  ({Math.round(topic.frequency * 100)}%)
                </span>
              )}
            </div>
            {hasDetails && (
              <div className={colorScheme.icon}>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </div>
            )}
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
                    className={`border-l-3 ${colorScheme.border} pl-3 py-1`}
                    style={{ borderLeftWidth: '3px' }}
                  >
                    <p className="text-xs text-[#616161] italic leading-relaxed">
                      "{quote.length > 100 ? quote.substring(0, 100) + '...' : quote}"
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

  TopicCard.propTypes = {
    topic: PropTypes.shape({
      topic: PropTypes.string.isRequired,
      frequency: PropTypes.number,
      quotes: PropTypes.array,
      sources: PropTypes.array
    }).isRequired,
    sentiment: PropTypes.string.isRequired,
    index: PropTypes.number.isRequired
  };

  // Find the maximum number of topics in any column
  const maxTopics = Math.max(
    positive_topics.length,
    mixedTopics.length,
    negative_topics.length
  );

  // Check if we have any topics at all
  const hasAnyTopics = positive_topics.length > 0 || mixedTopics.length > 0 || negative_topics.length > 0;

  return (
    <div className={`bg-white border border-[#E0E0E0] rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-[#212121] mb-1">
          Sentiment Analysis by Topic
        </h3>
        <p className="text-sm text-[#757575]">
          Click on topics to expand quotes and sources
        </p>
      </div>

      {hasAnyTopics ? (
        <>
          {/* Column Headers */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-[#E8F5E9] rounded-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-[#4CAF50]" />
              <span className="text-sm font-medium text-[#2E7D32]">Positive</span>
              <span className="text-xs text-[#4CAF50]">({positive_topics.length})</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#FFF3E0] rounded-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF9800]" />
              <span className="text-sm font-medium text-[#E65100]">Mixed</span>
              <span className="text-xs text-[#FF9800]">({mixedTopics.length})</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-[#FFEBEE] rounded-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-[#EF5350]" />
              <span className="text-sm font-medium text-[#C62828]">Negative</span>
              <span className="text-xs text-[#EF5350]">({negative_topics.length})</span>
            </div>
          </div>

          {/* 3-Column Grid of Topics */}
          <div className="grid grid-cols-3 gap-4">
            {/* Positive Column */}
            <div className="space-y-3">
              {positive_topics.map((topic, idx) => (
                <TopicCard
                  key={idx}
                  topic={topic}
                  sentiment="positive"
                  index={idx}
                />
              ))}
              {positive_topics.length === 0 && (
                <div className="text-center py-6 text-sm text-[#BDBDBD] italic">
                  No positive topics
                </div>
              )}
            </div>

            {/* Mixed Column */}
            <div className="space-y-3">
              {mixedTopics.map((topic, idx) => (
                <TopicCard
                  key={idx}
                  topic={topic}
                  sentiment="mixed"
                  index={idx}
                />
              ))}
              {mixedTopics.length === 0 && (
                <div className="text-center py-6 text-sm text-[#BDBDBD] italic">
                  No mixed topics
                </div>
              )}
            </div>

            {/* Negative Column */}
            <div className="space-y-3">
              {negative_topics.map((topic, idx) => (
                <TopicCard
                  key={idx}
                  topic={topic}
                  sentiment="negative"
                  index={idx}
                />
              ))}
              {negative_topics.length === 0 && (
                <div className="text-center py-6 text-sm text-[#BDBDBD] italic">
                  No negative topics
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-[#9E9E9E] italic">
            No sentiment topics available
          </p>
        </div>
      )}
    </div>
  );
}

SentimentTopicsList.propTypes = {
  sentimentTopics: PropTypes.shape({
    positive_topics: PropTypes.arrayOf(
      PropTypes.shape({
        topic: PropTypes.string.isRequired,
        frequency: PropTypes.number,
        sentiment_score: PropTypes.number,
        quotes: PropTypes.array,
        sources: PropTypes.array
      })
    ),
    negative_topics: PropTypes.arrayOf(
      PropTypes.shape({
        topic: PropTypes.string.isRequired,
        frequency: PropTypes.number,
        sentiment_score: PropTypes.number,
        quotes: PropTypes.array,
        sources: PropTypes.array
      })
    ),
    neutral_topics: PropTypes.arrayOf(
      PropTypes.shape({
        topic: PropTypes.string.isRequired,
        frequency: PropTypes.number,
        sentiment_score: PropTypes.number,
        quotes: PropTypes.array,
        sources: PropTypes.array
      })
    ),
    mixed_topics: PropTypes.arrayOf(
      PropTypes.shape({
        topic: PropTypes.string.isRequired,
        frequency: PropTypes.number,
        sentiment_score: PropTypes.number,
        quotes: PropTypes.array,
        sources: PropTypes.array
      })
    )
  }),
  className: PropTypes.string
};
