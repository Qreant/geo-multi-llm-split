import { useMemo } from 'react';
import TopConceptsChart from './TopConceptsChart';
import SourceAnalysis from './SourceAnalysis';

/**
 * Format category name: replace underscores with spaces and capitalize each word
 */
const formatCategoryName = (name) => {
  if (!name) return '';
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * ReputationAnalysis Component
 * Displays categories associated with the entity, showing presence, SOV, and competitors
 * Report-level analysis (not category-specific)
 */
export default function ReputationAnalysis({ data, entity, categoriesAssociated = null, selectedLLMs = ['gemini', 'openai'] }) {
  // Filter topics based on selected LLMs
  // Topics have cited_by array at topic level (e.g., ["Gemini", "OpenAI"])
  const filteredSentimentTopics = useMemo(() => {
    if (!data?.sentiment_topics) return null;

    // Map LLM IDs to cited_by format
    const llmToCitedBy = {
      'gemini': 'Gemini',
      'openai': 'OpenAI'
    };

    const filterTopics = (topics) => {
      return topics
        .filter(topic => {
          // If no cited_by info, keep the topic
          if (!topic.cited_by || topic.cited_by.length === 0) return true;

          // Check if any selected LLM is in cited_by
          return selectedLLMs.some(llmId => {
            const citedByName = llmToCitedBy[llmId];
            return topic.cited_by.some(cb =>
              cb.toLowerCase() === citedByName?.toLowerCase() ||
              cb.toLowerCase() === llmId.toLowerCase()
            );
          });
        })
        .sort((a, b) => b.frequency - a.frequency);
    };

    return {
      positive_topics: filterTopics(data.sentiment_topics.positive_topics || []),
      negative_topics: filterTopics(data.sentiment_topics.negative_topics || []),
      neutral_topics: filterTopics(data.sentiment_topics.neutral_topics || []),
      mixed_topics: filterTopics(data.sentiment_topics.mixed_topics || [])
    };
  }, [data?.sentiment_topics, selectedLLMs]);

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#757575]">No reputation data available</p>
      </div>
    );
  }

  // Use categories from category detection analysis
  const categories = (categoriesAssociated?.categories || []).map(cat => {
    // Get top competitors names
    const topCompetitors = (cat.top_competitors || [])
      .slice(0, 3)
      .map(comp => comp.name);

    // Format visibility percentage
    const appearancePercent = cat.category_visibility !== undefined
      ? `${(cat.category_visibility * 100).toFixed(0)}%`
      : 'N/A';

    // Format SOV percentage
    const sovPercent = cat.category_sov !== undefined
      ? `${(cat.category_sov * 100).toFixed(1)}%`
      : 'N/A';

    return {
      name: cat.name,
      appearance: appearancePercent,
      sov: sovPercent,
      avgPosition: cat.average_position?.toFixed(1) || 'N/A',
      mentions: cat.mentions || 0,
      comment: cat.comment || '',
      competitors: topCompetitors
    };
  });

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xl font-medium text-[#212121] mb-2">Reputation Analysis</h2>
        <p className="text-sm text-[#757575]">
          How is {entity} discussed by LLMs and which domains influence the conversation
        </p>
      </div>

      {/* Categories Table */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-medium text-[#212121] mb-1">
            Categories Associated with {entity}
          </h3>
          <p className="text-sm text-[#757575]">
            Category presence and top competitors
          </p>
        </div>

        {categories.length > 0 ? (
          <div className="bg-white border border-[#E0E0E0] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[#F5F5F5] border-b border-[#E0E0E0]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] uppercase tracking-wide">
                    Category
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-[#757575] uppercase tracking-wide w-28">
                    Appearances
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#757575] uppercase tracking-wide">
                    Top Competitors
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {categories.map((category, index) => (
                  <tr key={index} className="hover:bg-[#F9FAFB] transition-colors">
                    {/* Category Name */}
                    <td className="px-4 py-4">
                      <div>
                        <span className="text-sm font-medium text-[#212121]">
                          {formatCategoryName(category.name)}
                        </span>
                        {category.comment && (
                          <p className="text-xs text-[#757575] mt-1 line-clamp-2">
                            {category.comment}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Appearances */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-[#E8F5E9] text-[#388E3C]">
                        {category.appearance}
                      </span>
                    </td>

                    {/* Top Competitors */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {category.competitors?.map((competitor, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]"
                          >
                            {competitor}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white border border-[#E0E0E0] rounded-lg p-8 text-center">
            <p className="text-sm text-[#757575]">No category association data available</p>
          </div>
        )}
      </div>

      {/* Top Concepts Chart */}
      {filteredSentimentTopics && (
        <TopConceptsChart sentimentTopics={filteredSentimentTopics} className="mb-8" />
      )}

      {/* Source Analysis - Pie Chart and Domain List */}
      {(data.source_analysis || data.full_sources_list) && (
        <SourceAnalysis
          sourceAnalysis={data.source_analysis}
          sources={data.full_sources_list}
          className="mb-8"
        />
      )}

      {/* Legacy Sections (keep if data exists) */}
      {data.strengths && data.strengths.length > 0 && (
        <div className="mt-8">
          <h4 className="text-base font-medium text-[#212121] mb-4">Key Strengths</h4>
          <div className="grid grid-cols-1 gap-3">
            {data.strengths.map((item, index) => (
              <div key={index} className="bg-[#E8F5E9] border border-[#4CAF50] rounded-lg p-4">
                <div className="font-medium text-[#212121] mb-2">{item.strength}</div>
                {item.description && (
                  <p className="text-sm text-[#757575] mb-2">{item.description}</p>
                )}
                {item.evidence && (
                  <p className="text-xs text-[#9E9E9E] italic">"{item.evidence}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.weaknesses && data.weaknesses.length > 0 && (
        <div className="mt-8">
          <h4 className="text-base font-medium text-[#212121] mb-4">Key Weaknesses</h4>
          <div className="grid grid-cols-1 gap-3">
            {data.weaknesses.map((item, index) => (
              <div key={index} className="bg-[#FFEBEE] border border-[#EF5350] rounded-lg p-4">
                <div className="font-medium text-[#212121] mb-2">{item.weakness}</div>
                {item.description && (
                  <p className="text-sm text-[#757575] mb-2">{item.description}</p>
                )}
                {item.evidence && (
                  <p className="text-xs text-[#9E9E9E] italic">"{item.evidence}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
