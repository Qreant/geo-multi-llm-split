import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, X, ArrowLeft, ArrowRight, Users, AlertCircle, Info } from 'lucide-react';

const MAX_COMPETITORS = 4;

export default function CompetitorsStep({ entity, markets, categoryFamilies, competitors: initialCompetitors, onComplete, onBack }) {
  // State: { [categoryId]: { [marketCode]: ['competitor1', 'competitor2'] } }
  const [competitors, setCompetitors] = useState(initialCompetitors || {});
  const [expandedCategory, setExpandedCategory] = useState(categoryFamilies[0]?.id || null);
  const [inputValues, setInputValues] = useState({});

  const primaryMarket = markets.find(m => m.isPrimary) || markets[0];

  const getCompetitors = (categoryId, marketCode) => {
    return competitors[categoryId]?.[marketCode] || [];
  };

  const setCompetitorsForMarket = (categoryId, marketCode, newCompetitors) => {
    setCompetitors(prev => ({
      ...prev,
      [categoryId]: {
        ...prev[categoryId],
        [marketCode]: newCompetitors
      }
    }));
  };

  const addCompetitor = (categoryId, marketCode, competitor) => {
    const current = getCompetitors(categoryId, marketCode);
    if (current.length >= MAX_COMPETITORS) {
      return false; // Limit reached
    }
    if (!current.includes(competitor) && competitor.trim()) {
      setCompetitorsForMarket(categoryId, marketCode, [...current, competitor.trim()]);
      return true;
    }
    return false;
  };

  const isAtLimit = (categoryId, marketCode) => {
    return getCompetitors(categoryId, marketCode).length >= MAX_COMPETITORS;
  };

  const removeCompetitor = (categoryId, marketCode, competitor) => {
    const current = getCompetitors(categoryId, marketCode);
    setCompetitorsForMarket(categoryId, marketCode, current.filter(c => c !== competitor));
  };

  const copyFromPrimary = (categoryId, marketCode) => {
    const primaryCompetitors = getCompetitors(categoryId, primaryMarket.code);
    // Only copy up to MAX_COMPETITORS
    setCompetitorsForMarket(categoryId, marketCode, primaryCompetitors.slice(0, MAX_COMPETITORS));
  };

  const handleInputKeyDown = (e, categoryId, marketCode) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const inputKey = `${categoryId}-${marketCode}`;
      const value = inputValues[inputKey]?.trim();
      if (value) {
        addCompetitor(categoryId, marketCode, value);
        setInputValues(prev => ({ ...prev, [inputKey]: '' }));
      }
    }
  };

  const getMarketFlag = (marketCode) => {
    const flags = {
      'en-US': '🇺🇸', 'en-UK': '🇬🇧', 'en-GB': '🇬🇧', 'en-CA': '🇨🇦', 'en-AU': '🇦🇺',
      'fr-FR': '🇫🇷', 'de-DE': '🇩🇪', 'es-ES': '🇪🇸', 'it-IT': '🇮🇹',
      'ja-JA': '🇯🇵', 'ja-JP': '🇯🇵', 'ko-KO': '🇰🇷', 'ko-KR': '🇰🇷',
      'zh-CH': '🇨🇳', 'zh-CN': '🇨🇳', 'pt-BR': '🇧🇷', 'es-MX': '🇲🇽'
    };
    return flags[marketCode] || '🌍';
  };

  const getTotalCompetitors = () => {
    let total = 0;
    categoryFamilies.forEach(cat => {
      markets.forEach(market => {
        total += getCompetitors(cat.id, market.code).length;
      });
    });
    return total;
  };

  const getCompletionStatus = (categoryId) => {
    const marketsWithCompetitors = markets.filter(m =>
      getCompetitors(categoryId, m.code).length > 0
    ).length;
    return `${marketsWithCompetitors}/${markets.length} markets configured`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-base">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E3F2FD] rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-[#2196F3]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#212121]">Define competitors</h3>
              <p className="text-sm text-[#757575]">
                Add competitors for each category in each market
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-[#212121]">{getTotalCompetitors()}</span>
            <p className="text-xs text-[#757575]">competitors added</p>
          </div>
        </div>
        {/* Info tooltip about limit */}
        <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-[#E3F2FD] rounded-lg">
          <Info className="w-4 h-4 text-[#2196F3] flex-shrink-0" />
          <p className="text-xs text-[#1976D2]">
            Maximum {MAX_COMPETITORS} competitors per category per market for optimal analysis quality and performance.
          </p>
        </div>
      </div>

      {/* Category Accordions */}
      <div className="space-y-3">
        {categoryFamilies.map(category => {
          const isExpanded = expandedCategory === category.id;
          const primaryTranslation = category.translations[primaryMarket.code];

          return (
            <div
              key={category.id}
              className="card-base !p-0 overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-[#F4F6F8] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">📁</span>
                  <span className="font-medium text-[#212121]">
                    {primaryMarket.language === 'All Languages'
                      ? category.canonical_name
                      : (primaryTranslation?.name || category.canonical_name)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#757575]">
                    {getCompletionStatus(category.id)}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-[#757575]" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#757575]" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-[#E0E0E0] bg-[#F4F6F8]">
                  {markets.map((market, marketIndex) => {
                    const marketCompetitors = getCompetitors(category.id, market.code);
                    const inputKey = `${category.id}-${market.code}`;
                    // For "All Languages" market, always use English/canonical name
                    const categoryName = market.language === 'All Languages'
                      ? category.canonical_name
                      : (category.translations[market.code]?.name || category.canonical_name);

                    return (
                      <div
                        key={market.code}
                        className={`p-4 ${marketIndex > 0 ? 'border-t border-[#E0E0E0]' : ''}`}
                      >
                        {/* Market Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getMarketFlag(market.code)}</span>
                            <span className="font-medium text-[#212121]">{market.country}</span>
                            <span className="text-[#757575]">·</span>
                            <span className="text-[#757575]">{market.language}</span>
                            {market.isPrimary && markets.length > 1 && (
                              <span className="px-2 py-0.5 text-xs bg-[#FFF8E1] text-[#F57C00] rounded-full">
                                Primary
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-[#9E9E9E]">
                            Category: "{categoryName}"
                          </span>
                        </div>

                        {/* Competitors Tags */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {marketCompetitors.map(competitor => (
                            <span
                              key={competitor}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-[#E0E0E0] rounded-full text-sm"
                            >
                              {competitor}
                              <button
                                onClick={() => removeCompetitor(category.id, market.code, competitor)}
                                className="ml-1 text-[#9E9E9E] hover:text-[#EF5350] transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}

                          {marketCompetitors.length === 0 && (
                            <span className="text-sm text-[#9E9E9E] italic">
                              No competitors added yet
                            </span>
                          )}
                        </div>

                        {/* Input */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                value={inputValues[inputKey] || ''}
                                onChange={(e) => setInputValues(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                onKeyDown={(e) => handleInputKeyDown(e, category.id, market.code)}
                                placeholder={isAtLimit(category.id, market.code)
                                  ? "Maximum competitors reached"
                                  : "Type competitor name and press Enter..."}
                                disabled={isAtLimit(category.id, market.code)}
                                className={`w-full px-3 py-2 bg-white border rounded text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
                                  isAtLimit(category.id, market.code)
                                    ? 'border-[#FFCDD2] bg-[#FFEBEE] text-[#9E9E9E] cursor-not-allowed'
                                    : 'border-[#E0E0E0] focus:ring-[#10B981]'
                                }`}
                              />
                            </div>

                            {!market.isPrimary && getCompetitors(category.id, primaryMarket.code).length > 0 && (
                              <button
                                onClick={() => copyFromPrimary(category.id, market.code)}
                                className="px-3 py-2 text-[#757575] border border-[#E0E0E0] rounded font-medium text-sm hover:bg-white transition-colors flex items-center gap-1"
                                title="Copy competitors from primary market"
                              >
                                <Copy className="w-4 h-4" />
                                Copy from {primaryMarket.country.split(' ')[0]}
                              </button>
                            )}
                          </div>

                          {/* Counter and error message */}
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${
                              isAtLimit(category.id, market.code) ? 'text-[#EF5350]' : 'text-[#9E9E9E]'
                            }`}>
                              {marketCompetitors.length}/{MAX_COMPETITORS} competitors
                            </span>
                            {isAtLimit(category.id, market.code) && (
                              <span className="flex items-center gap-1 text-xs text-[#EF5350]">
                                <AlertCircle className="w-3 h-3" />
                                Maximum limit reached. Remove a competitor to add a new one.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-[#757575] hover:bg-[#F4F6F8] rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <button
          onClick={() => onComplete(competitors)}
          className="px-6 py-3 bg-[#10B981] text-white font-medium rounded-lg hover:bg-[#059669] transition-colors flex items-center gap-2"
        >
          Review Prompts
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
