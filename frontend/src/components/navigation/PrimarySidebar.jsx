import { useState } from 'react';
import { Globe, TrendingUp, Eye, Trophy, ChevronDown, ChevronUp, Lightbulb, LayoutDashboard } from 'lucide-react';
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
  // Shared view mode
  isSharedView = false
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
      {/* Overview Section - Show for multi-market OR multi-category */}
      {(isMultiMarket || categories.length > 1) && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[#9E9E9E] uppercase tracking-wide mb-3">
            Overview
          </h3>

          <div className="space-y-1">
            <button
              onClick={() => handleViewChange({ type: 'overview' })}
              className={`nav-item ${
                activeView.type === 'overview' ? 'nav-item-active' : ''
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>

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
  isMultiMarket: PropTypes.bool,
  isSharedView: PropTypes.bool
};

PrimarySidebar.defaultProps = {
  categories: [],
  hasReputation: false,
  countries: [],
  languages: [],
  isMultiMarket: false,
  isSharedView: false
};

export default PrimarySidebar;
