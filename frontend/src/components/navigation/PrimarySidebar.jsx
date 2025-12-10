import { useState } from 'react';
import { Globe, TrendingUp, Eye, Trophy, ChevronDown, ChevronUp, Lightbulb, MapPin, LayoutDashboard, Sparkles, MessageSquare } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * PrimarySidebar Component
 * Hierarchical navigation with Market Selector, Analysis Types, Category Analysis
 */
const PrimarySidebar = ({
  activeView,
  onViewChange,
  categories,
  hasReputation,
  countries,
  languages,
  report,
  // Multi-market props
  isMultiMarket,
  markets,
  selectedMarket,
  onMarketChange,
  // LLM filter props
  selectedLLMs,
  onLLMToggle
}) => {
  const [expandedCategories, setExpandedCategories] = useState(
    categories.length > 0 ? [0] : [] // Expand first category by default
  );

  const toggleCategory = (index) => {
    setExpandedCategories(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleViewChange = (view) => {
    onViewChange(view);
  };

  return (
    <div className="card-base p-4">
      {/* Market Selector Section - Only for multi-market reports */}
      {isMultiMarket && markets && markets.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide mb-3">
            Market
          </h3>

          <div className="relative">
            <select
              value={selectedMarket || ''}
              onChange={(e) => onMarketChange && onMarketChange(e.target.value)}
              className="w-full appearance-none bg-white border border-[#E0E0E0] rounded-lg px-3 py-2 pr-8 text-sm font-medium text-[#212121] cursor-pointer hover:border-[#2196F3] focus:outline-none focus:ring-2 focus:ring-[#2196F3]/20 focus:border-[#2196F3] transition-colors"
            >
              {markets.map((market) => (
                <option key={market.code} value={market.code}>
                  {market.country} ({market.language})
                  {market.isPrimary ? ' ★' : ''}
                </option>
              ))}
            </select>
            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#757575] pointer-events-none" />
          </div>

          {/* Market count badge */}
          <div className="mt-2 text-xs text-[#757575]">
            {markets.length} market{markets.length !== 1 ? 's' : ''} analyzed
          </div>
        </div>
      )}

      {/* LLM Filter Section */}
      {selectedLLMs && onLLMToggle && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide mb-3">
            Data Source
          </h3>
          <div className="space-y-2">
            {/* Gemini Toggle */}
            <button
              onClick={() => onLLMToggle('gemini')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedLLMs.includes('gemini')
                  ? 'bg-[#E8F0FE] text-[#4285F4]'
                  : 'bg-[#F5F5F5] text-[#9E9E9E] opacity-50 hover:opacity-70'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Gemini</span>
              {selectedLLMs.includes('gemini') && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#4285F4]" />
              )}
            </button>
            {/* ChatGPT Toggle */}
            <button
              onClick={() => onLLMToggle('openai')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedLLMs.includes('openai')
                  ? 'bg-[#E6F4F1] text-[#10A37F]'
                  : 'bg-[#F5F5F5] text-[#9E9E9E] opacity-50 hover:opacity-70'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>ChatGPT</span>
              {selectedLLMs.includes('openai') && (
                <span className="ml-auto w-2 h-2 rounded-full bg-[#10A37F]" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Overview Section - Show for multi-market OR multi-category */}
      {(isMultiMarket || categories.length > 1) && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide mb-3">
            Overview
          </h3>

          <button
            onClick={() => handleViewChange({ type: 'overview' })}
            className={`nav-item ${
              activeView.type === 'overview' ? 'nav-item-active' : ''
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Cross-Category Overview</span>
          </button>
        </div>
      )}

      {/* Analysis Types Section */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide mb-3">
          Analysis Types
        </h3>

        {hasReputation && (
          <button
            onClick={() => handleViewChange({ type: 'reputation' })}
            className={`nav-item ${
              activeView.type === 'reputation' ? 'nav-item-active' : ''
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Reputation Analysis</span>
          </button>
        )}
      </div>

      {/* Category Analysis Section */}
      {categories.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide mb-3">
            Category Analysis
          </h3>

          {categories.map((category, index) => (
            <div key={index} className="mb-2">
              {/* Category Header - Expandable */}
              <button
                onClick={() => toggleCategory(index)}
                className="nav-category-header"
              >
                <div className="flex items-center gap-2 flex-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">{category.name}</span>
                </div>
                {expandedCategories.includes(index) ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {/* Sub-items - Visibility & Competitive */}
              {expandedCategories.includes(index) && (
                <div className="ml-4 mt-1 space-y-1">
                  <button
                    onClick={() => handleViewChange({
                      type: 'category',
                      categoryIndex: index,
                      subTab: 'visibility'
                    })}
                    className={`nav-sub-item ${
                      activeView.type === 'category' &&
                      activeView.categoryIndex === index &&
                      activeView.subTab === 'visibility'
                        ? 'nav-sub-item-active'
                        : ''
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    <span>Visibility</span>
                  </button>

                  <button
                    onClick={() => handleViewChange({
                      type: 'category',
                      categoryIndex: index,
                      subTab: 'competitive'
                    })}
                    className={`nav-sub-item ${
                      activeView.type === 'category' &&
                      activeView.categoryIndex === index &&
                      activeView.subTab === 'competitive'
                        ? 'nav-sub-item-active'
                        : ''
                    }`}
                  >
                    <Trophy className="w-4 h-4" />
                    <span>Competitive</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* PR Insights Section */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide mb-3">
          Recommendations
        </h3>

        <button
          onClick={() => handleViewChange({ type: 'insights' })}
          className={`nav-item ${
            activeView.type === 'insights' ? 'nav-item-active' : ''
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          <span>PR Insights</span>
        </button>
      </div>

      {/* Locations Section - Only for non-multi-market reports */}
      {!isMultiMarket && (
        <div>
          <h3 className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide mb-3">
            Locations
          </h3>

          <div className="nav-info-item">
            <Globe className="w-4 h-4 text-[#757575]" />
            <span className="text-sm text-[#757575]">
              {countries && countries.length > 0
                ? countries.join(', ')
                : 'All countries'} - {languages && languages.length > 0
                ? languages.join(', ')
                : 'All languages'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

PrimarySidebar.propTypes = {
  activeView: PropTypes.shape({
    type: PropTypes.oneOf(['overview', 'reputation', 'category', 'insights']).isRequired,
    categoryIndex: PropTypes.number,
    subTab: PropTypes.oneOf(['visibility', 'competitive'])
  }).isRequired,
  onViewChange: PropTypes.func.isRequired,
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired
    })
  ),
  hasReputation: PropTypes.bool,
  countries: PropTypes.arrayOf(PropTypes.string),
  languages: PropTypes.arrayOf(PropTypes.string),
  report: PropTypes.object,
  // Multi-market props
  isMultiMarket: PropTypes.bool,
  markets: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string.isRequired,
      country: PropTypes.string.isRequired,
      language: PropTypes.string.isRequired,
      isPrimary: PropTypes.bool
    })
  ),
  selectedMarket: PropTypes.string,
  onMarketChange: PropTypes.func,
  // LLM filter props
  selectedLLMs: PropTypes.arrayOf(PropTypes.string),
  onLLMToggle: PropTypes.func
};

PrimarySidebar.defaultProps = {
  categories: [],
  hasReputation: false,
  countries: [],
  languages: [],
  isMultiMarket: false,
  markets: [],
  selectedMarket: null,
  onMarketChange: null,
  selectedLLMs: ['gemini', 'openai'],
  onLLMToggle: null
};

export default PrimarySidebar;
