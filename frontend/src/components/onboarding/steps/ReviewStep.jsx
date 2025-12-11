import React, { useState } from 'react';
import { ArrowLeft, Rocket, Clock, AlertCircle, ChevronDown, ChevronUp, Edit2, Loader } from 'lucide-react';

export default function ReviewStep({ config, onLaunch, onBack, onEditStep, error }) {
  const { entity, markets, categoryFamilies, competitors, reputationQuestions, categoryQuestions } = config;
  const [isLaunching, setIsLaunching] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const selectedCategories = categoryFamilies.filter(cf => cf.isSelected);
  const primaryMarket = markets.find(m => m.isPrimary) || markets[0];

  const getMarketFlag = (marketCode) => {
    const flags = {
      'en-US': '🇺🇸', 'en-UK': '🇬🇧', 'en-GB': '🇬🇧', 'en-CA': '🇨🇦', 'en-AU': '🇦🇺',
      'fr-FR': '🇫🇷', 'de-DE': '🇩🇪', 'es-ES': '🇪🇸', 'it-IT': '🇮🇹',
      'ja-JA': '🇯🇵', 'ja-JP': '🇯🇵', 'ko-KO': '🇰🇷', 'ko-KR': '🇰🇷',
      'zh-CH': '🇨🇳', 'zh-CN': '🇨🇳', 'pt-BR': '🇧🇷', 'es-MX': '🇲🇽'
    };
    return flags[marketCode] || '🌍';
  };

  const getCompetitorCount = (categoryId, marketCode) => {
    return competitors[categoryId]?.[marketCode]?.length || 0;
  };

  // Calculate question counts by type
  const getQuestionCounts = () => {
    let reputation = 0;
    let visibility = 0;
    let competitive = 0;

    // Count reputation questions per market
    if (reputationQuestions) {
      Object.values(reputationQuestions).forEach(questions => {
        reputation += questions?.length || 0;
      });
    }

    // Count category questions (visibility + competitive) per market/category
    if (categoryQuestions) {
      Object.values(categoryQuestions).forEach(marketQuestions => {
        Object.values(marketQuestions || {}).forEach(catQuestions => {
          visibility += catQuestions?.visibility?.length || 0;
          competitive += catQuestions?.competitive?.length || 0;
        });
      });
    }

    return { reputation, visibility, competitive, total: reputation + visibility + competitive };
  };

  const questionCounts = getQuestionCounts();

  // Calculate total questions from reputation + category questions
  const getTotalQuestions = () => questionCounts.total;

  const calculateEstimatedTime = () => {
    const totalQuestions = getTotalQuestions();
    // Approximately 2-3 seconds per question
    const seconds = totalQuestions * 2.5;
    const minutes = Math.ceil(seconds / 60);
    return minutes < 2 ? '1-2 minutes' : `${minutes}-${minutes + 1} minutes`;
  };

  const getTotalCompetitors = () => {
    let total = 0;
    selectedCategories.forEach(cat => {
      markets.forEach(market => {
        total += getCompetitorCount(cat.id, market.code);
      });
    });
    return total;
  };

  const handleLaunch = async () => {
    setIsLaunching(true);
    try {
      await onLaunch();
    } catch (err) {
      setIsLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="card-base bg-gradient-to-br from-[#E8F5E9] to-white">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#212121] mb-2">
            Ready to analyze {entity}
          </h2>
          <p className="text-[#757575]">
            Review your configuration before launching the analysis
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-white rounded-lg border border-[#E0E0E0]">
            <div className="text-3xl font-bold text-[#10B981]">{markets.length}</div>
            <div className="text-xs text-[#757575] uppercase tracking-wide mt-1">Markets</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg border border-[#E0E0E0]">
            <div className="text-3xl font-bold text-[#2196F3]">{selectedCategories.length}</div>
            <div className="text-xs text-[#757575] uppercase tracking-wide mt-1">Categories</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg border border-[#E0E0E0]">
            <div className="text-3xl font-bold text-[#F57C00]">{getTotalCompetitors()}</div>
            <div className="text-xs text-[#757575] uppercase tracking-wide mt-1">Competitors</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg border border-[#E0E0E0]">
            <div className="text-3xl font-bold text-[#9C27B0]">{getTotalQuestions()}</div>
            <div className="text-xs text-[#757575] uppercase tracking-wide mt-1">Total Questions</div>
          </div>
        </div>

        {/* Question Breakdown */}
        <div className="mt-4 pt-4 border-t border-[#E0E0E0]">
          <div className="text-sm text-[#757575] text-center">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#2196F3]"></span>
              {questionCounts.reputation} reputation
            </span>
            <span className="mx-2">+</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
              {questionCounts.visibility} visibility
            </span>
            <span className="mx-2">+</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#F57C00]"></span>
              {questionCounts.competitive} competitive
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Matrix */}
      <div className="card-base">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#212121]">Configuration Matrix</h3>
          <button
            onClick={() => onEditStep(2)}
            className="text-sm text-[#2196F3] hover:underline flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            Edit competitors
          </button>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 bg-[#F4F6F8] border border-[#E0E0E0] font-medium text-[#757575]">
                  Category
                </th>
                {markets.map(market => (
                  <th
                    key={market.code}
                    className="text-center p-3 bg-[#F4F6F8] border border-[#E0E0E0] font-medium text-[#757575] min-w-[140px]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">{getMarketFlag(market.code)}</span>
                      <span className="text-xs">{market.country}</span>
                      <span className="text-xs text-[#9E9E9E]">{market.language}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedCategories.map(category => {
                const isExpanded = expandedCategory === category.id;

                return (
                  <React.Fragment key={category.id}>
                    <tr
                      className="cursor-pointer hover:bg-[#F4F6F8] transition-colors"
                      onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                    >
                      <td className="p-3 border border-[#E0E0E0]">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#757575]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#757575]" />
                          )}
                          <span className="font-medium text-[#212121]">
                            {primaryMarket.language === 'All Languages'
                              ? category.canonical_name
                              : (category.translations[primaryMarket.code]?.name || category.canonical_name)}
                          </span>
                        </div>
                      </td>
                      {markets.map(market => {
                        const count = getCompetitorCount(category.id, market.code);
                        return (
                          <td
                            key={market.code}
                            className="p-3 border border-[#E0E0E0] text-center"
                          >
                            <span
                              className={`
                                inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium
                                ${count > 0
                                  ? 'bg-[#E8F5E9] text-[#4CAF50]'
                                  : 'bg-[#FFF3E0] text-[#F57C00]'
                                }
                              `}
                            >
                              {count} competitor{count !== 1 ? 's' : ''}
                            </span>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Expanded Row - Show competitors */}
                    {isExpanded && (
                      <tr>
                        <td className="p-0 border border-[#E0E0E0] bg-[#F4F6F8]">
                          <div className="p-3 text-xs text-[#9E9E9E]">
                            Localized category name:
                          </div>
                        </td>
                        {markets.map(market => {
                          const comps = competitors[category.id]?.[market.code] || [];
                          const categoryName = market.language === 'All Languages'
                            ? category.canonical_name
                            : (category.translations[market.code]?.name || '—');

                          return (
                            <td
                              key={market.code}
                              className="p-3 border border-[#E0E0E0] bg-[#F4F6F8]"
                            >
                              <div className="text-xs text-[#757575] mb-2">
                                "{categoryName}"
                              </div>
                              {comps.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {comps.map(comp => (
                                    <span
                                      key={comp}
                                      className="px-2 py-0.5 bg-white border border-[#E0E0E0] rounded text-xs text-[#212121]"
                                    >
                                      {comp}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-[#9E9E9E] italic">
                                  No competitors
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Time Estimate */}
      <div className="card-base bg-[#FFF8E1] border-[#FFE082]">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-[#F57C00]" />
          <div>
            <span className="font-medium text-[#212121]">Estimated time: </span>
            <span className="text-[#757575]">{calculateEstimatedTime()}</span>
          </div>
        </div>
        <p className="text-sm text-[#757575] mt-2">
          Both Gemini and OpenAI will analyze {getTotalQuestions()} questions across {markets.length} market{markets.length > 1 ? 's' : ''} in parallel.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#EF5350] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[#EF5350] font-medium">Failed to start analysis</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={isLaunching}
          className="px-4 py-2 text-[#757575] hover:bg-[#F4F6F8] rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <button
          onClick={handleLaunch}
          disabled={isLaunching}
          className="px-8 py-4 bg-[#4CAF50] text-white font-bold rounded-lg hover:bg-[#388E3C] disabled:bg-[#E0E0E0] disabled:text-[#9E9E9E] transition-colors flex items-center gap-2 text-lg"
        >
          {isLaunching ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Starting Analysis...
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" />
              Launch Analysis
            </>
          )}
        </button>
      </div>
    </div>
  );
}
