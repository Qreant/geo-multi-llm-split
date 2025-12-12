import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ExternalLink, X } from 'lucide-react';

/**
 * TopConceptsChart Component
 * Unified List with Detail Drawer - sortable/filterable list with slide-out panel
 */
export default function TopConceptsChart({ sentimentTopics, className = '' }) {
  // Track selected topic for drawer
  const [selectedTopic, setSelectedTopic] = useState(null);
  // Sort option
  const [sortBy, setSortBy] = useState('frequency');
  // Filter by sentiment
  const [sentimentFilter, setSentimentFilter] = useState('all');

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

  // Combine all topics with sentiment labels
  const allTopics = useMemo(() => {
    const topics = [
      ...positive_topics.map(t => ({ ...t, sentiment: 'positive' })),
      ...neutralTopics.map(t => ({ ...t, sentiment: 'mixed' })),
      ...negative_topics.map(t => ({ ...t, sentiment: 'negative' }))
    ];

    // Apply filter
    let filtered = topics;
    if (sentimentFilter !== 'all') {
      filtered = topics.filter(t => t.sentiment === sentimentFilter);
    }

    // Apply sort
    return filtered.sort((a, b) => {
      if (sortBy === 'frequency') {
        return b.frequency - a.frequency;
      } else if (sortBy === 'sentiment') {
        // Sort by sentiment score if available, otherwise by sentiment type
        const scoreA = a.sentiment_score ?? (a.sentiment === 'positive' ? 1 : a.sentiment === 'negative' ? -1 : 0);
        const scoreB = b.sentiment_score ?? (b.sentiment === 'positive' ? 1 : b.sentiment === 'negative' ? -1 : 0);
        return scoreB - scoreA;
      } else {
        // A-Z sort
        return a.topic.localeCompare(b.topic);
      }
    });
  }, [positive_topics, neutralTopics, negative_topics, sortBy, sentimentFilter]);

  // Count by sentiment
  const counts = {
    positive: positive_topics.length,
    mixed: neutralTopics.length,
    negative: negative_topics.length
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
   * Get sentiment styling
   */
  const getSentimentStyle = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return {
          barColor: 'bg-emerald-500',
          textColor: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-500',
          pillBg: 'bg-emerald-100',
          pillText: 'text-emerald-700',
          headerBg: 'bg-emerald-500'
        };
      case 'negative':
        return {
          barColor: 'bg-rose-500',
          textColor: 'text-rose-600',
          bgColor: 'bg-rose-50',
          borderColor: 'border-rose-500',
          pillBg: 'bg-rose-100',
          pillText: 'text-rose-700',
          headerBg: 'bg-rose-500'
        };
      default:
        return {
          barColor: 'bg-amber-500',
          textColor: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-500',
          pillBg: 'bg-amber-100',
          pillText: 'text-amber-700',
          headerBg: 'bg-amber-500'
        };
    }
  };

  /**
   * Get quotes from topic
   */
  const getQuotes = (topic) => {
    return topic.quotes?.slice(0, 3).map(q =>
      typeof q === 'string' ? q : q.text
    ).filter(Boolean) || [];
  };

  /**
   * Render a list item
   */
  const TopicListItem = ({ topic, index }) => {
    const style = getSentimentStyle(topic.sentiment);
    const isSelected = selectedTopic?.topic === topic.topic && selectedTopic?.sentiment === topic.sentiment;
    const quotes = getQuotes(topic);
    const sourceCount = topic.sources?.length || 0;

    return (
      <button
        onClick={() => setSelectedTopic(topic)}
        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
          isSelected
            ? `${style.bgColor} ${style.borderColor}`
            : 'bg-white border-[#E0E0E0] hover:border-[#BDBDBD] hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Sentiment indicator bar */}
          <div className={`w-1.5 h-12 rounded-full ${style.barColor}`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-[#212121] truncate pr-2">{topic.topic}</span>
              <span className={`text-lg font-bold ${style.textColor}`}>
                {Math.round(topic.frequency * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#757575]">
              <span>{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</span>
              <span>{sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
              {topic.sentiment_score !== undefined && (
                <span className={style.textColor}>
                  {topic.sentiment_score > 0 ? '+' : ''}{topic.sentiment_score.toFixed(2)} sentiment
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  TopicListItem.propTypes = {
    topic: PropTypes.object.isRequired,
    index: PropTypes.number.isRequired
  };

  /**
   * Detail Drawer Component
   */
  const DetailDrawer = () => {
    if (!selectedTopic) return null;

    const style = getSentimentStyle(selectedTopic.sentiment);
    const quotes = getQuotes(selectedTopic);

    return (
      <div className="w-80 flex-shrink-0 bg-[#FAFAFA] rounded-xl border border-[#E0E0E0] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`${style.headerBg} p-4 relative`}>
          <button
            onClick={() => setSelectedTopic(null)}
            className="absolute top-3 right-3 text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <h4 className="font-semibold text-white pr-8">{selectedTopic.topic}</h4>
          <div className="flex items-center gap-3 mt-1.5 text-white/90 text-sm">
            <span>{Math.round(selectedTopic.frequency * 100)}% frequency</span>
            {selectedTopic.sentiment_score !== undefined && (
              <>
                <span>•</span>
                <span>{selectedTopic.sentiment_score > 0 ? '+' : ''}{selectedTopic.sentiment_score.toFixed(2)} sentiment</span>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          {/* Sentiment Indicator */}
          <div>
            <div className="flex justify-between text-[10px] text-[#9E9E9E] uppercase tracking-wide mb-1.5">
              <span>Negative</span>
              <span>Positive</span>
            </div>
            <div className="h-2 bg-[#E0E0E0] rounded-full overflow-hidden relative">
              {/* Gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 opacity-30" />
              {/* Indicator position based on sentiment */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-[#212121] rounded-full"
                style={{
                  left: `${((selectedTopic.sentiment_score ?? (selectedTopic.sentiment === 'positive' ? 0.7 : selectedTopic.sentiment === 'negative' ? -0.7 : 0)) + 1) / 2 * 100}%`,
                  transform: 'translateX(-50%)'
                }}
              />
            </div>
          </div>

          {/* Quotes */}
          {quotes.length > 0 && (
            <div>
              <h5 className="text-[10px] font-semibold text-[#9E9E9E] uppercase tracking-wide mb-2">
                Quotes
              </h5>
              <div className="space-y-2">
                {quotes.map((quote, qIdx) => (
                  <div
                    key={qIdx}
                    className={`bg-white p-3 rounded-lg border-l-4 ${style.borderColor} text-sm`}
                  >
                    <p className="text-[#424242] italic leading-relaxed">
                      "{quote.length > 150 ? quote.substring(0, 150) + '...' : quote}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {selectedTopic.sources && selectedTopic.sources.length > 0 && (
            <div>
              <h5 className="text-[10px] font-semibold text-[#9E9E9E] uppercase tracking-wide mb-2">
                Sources
              </h5>
              <div className="space-y-1.5">
                {selectedTopic.sources.slice(0, 5).map((source, sIdx) => {
                  const url = typeof source === 'string' ? source : source.url;
                  const domain = typeof source === 'object' && source.domain
                    ? source.domain
                    : extractDomainName(url);
                  const sourceType = typeof source === 'object' && source.source_type
                    ? source.source_type
                    : null;

                  return (
                    <a
                      key={sIdx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 bg-white rounded-lg hover:bg-[#F5F5F5] transition-colors group"
                    >
                      <div className="w-8 h-8 bg-[#F5F5F5] rounded flex items-center justify-center text-sm">
                        {sourceType === 'Journalism' ? '📰' :
                         sourceType === 'Corporate Blogs & Content' ? '🏢' :
                         sourceType === 'Academic/Research' ? '🎓' :
                         sourceType === 'Review Sites' ? '⭐' :
                         sourceType === 'Social/UGC' ? '💬' :
                         '🔗'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#212121] truncate">{domain}</p>
                        {sourceType && (
                          <p className="text-xs text-[#9E9E9E]">{sourceType}</p>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-[#BDBDBD] group-hover:text-[#1976D2] flex-shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {quotes.length === 0 && (!selectedTopic.sources || selectedTopic.sources.length === 0) && (
            <div className="text-center py-8 text-[#9E9E9E] text-sm">
              No additional details available
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white border border-[#E0E0E0] rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-[#212121] mb-1">
          Top Concepts Associated with Your Brand
        </h3>
        <p className="text-sm text-[#757575]">
          Click on a concept to view quotes and sources
        </p>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Left: List */}
        <div className="flex-1 min-w-0">
          {/* Controls */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h4 className="text-base font-medium text-[#424242]">All Concepts</h4>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Sort dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-sm border border-[#E0E0E0] rounded-lg px-3 py-1.5 bg-white text-[#424242] focus:outline-none focus:border-[#1976D2]"
              >
                <option value="frequency">Sort: Frequency</option>
                <option value="sentiment">Sort: Sentiment</option>
                <option value="alphabetical">Sort: A-Z</option>
              </select>

              {/* Filter buttons */}
              <div className="flex gap-1">
                <button
                  onClick={() => setSentimentFilter('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    sentimentFilter === 'all'
                      ? 'bg-[#212121] text-white'
                      : 'bg-[#F5F5F5] text-[#757575] hover:bg-[#EEEEEE]'
                  }`}
                >
                  All ({counts.positive + counts.mixed + counts.negative})
                </button>
                <button
                  onClick={() => setSentimentFilter('positive')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    sentimentFilter === 'positive'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Positive ({counts.positive})
                </button>
                <button
                  onClick={() => setSentimentFilter('mixed')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    sentimentFilter === 'mixed'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Mixed ({counts.mixed})
                </button>
                <button
                  onClick={() => setSentimentFilter('negative')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    sentimentFilter === 'negative'
                      ? 'bg-rose-500 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Negative ({counts.negative})
                </button>
              </div>
            </div>
          </div>

          {/* List Items */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {allTopics.length > 0 ? (
              allTopics.map((topic, index) => (
                <TopicListItem key={`${topic.sentiment}-${index}`} topic={topic} index={index} />
              ))
            ) : (
              <div className="text-center py-12 text-[#9E9E9E]">
                No concepts found
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail Drawer */}
        {selectedTopic && <DetailDrawer />}
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
