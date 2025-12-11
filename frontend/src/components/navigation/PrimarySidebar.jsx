import { useState } from 'react';
import { Globe, Eye, Trophy, ChevronDown, ChevronUp, Lightbulb, LayoutDashboard } from 'lucide-react';
import PropTypes from 'prop-types';

// Color palette for category dots
const CATEGORY_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-emerald-500',
];

/**
 * PrimarySidebar Component
 * Minimal Pills design - clean, professional navigation
 */
const PrimarySidebar = ({
  activeView,
  onViewChange,
  categories,
  hasReputation,
  countries,
  languages,
  report,
  insightsCount = 0,
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

  // Format category name: replace underscores with spaces, capitalize words
  const formatCategoryName = (name) => {
    return name
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden sticky top-[130px] max-h-[calc(100vh-146px)] overflow-y-auto">
      {/* Main Navigation */}
      <div className="p-3">
        <div className="space-y-1">
          {/* Overview - Show for multi-market OR multi-category */}
          {(isMultiMarket || categories.length > 1) && (
            <button
              onClick={() => handleViewChange({ type: 'overview' })}
              className={`
                flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all
                ${activeView.type === 'overview'
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">Overview</span>
            </button>
          )}

          {/* PR Insights */}
          {(isMultiMarket || categories.length > 1) && (
            <button
              onClick={() => handleViewChange({ type: 'insights' })}
              className={`
                flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all
                ${activeView.type === 'insights'
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              <Lightbulb className="w-5 h-5" />
              <span className="font-medium">PR Insights</span>
              {insightsCount > 0 && (
                <span className={`
                  ml-auto text-xs px-2 py-0.5 rounded-full
                  ${activeView.type === 'insights'
                    ? 'bg-emerald-200 text-emerald-800'
                    : 'bg-gray-100 text-gray-600'
                  }
                `}>
                  {insightsCount}
                </span>
              )}
            </button>
          )}

          {/* Reputation Analysis */}
          {hasReputation && (
            <button
              onClick={() => handleViewChange({ type: 'reputation' })}
              className={`
                flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-left transition-all
                ${activeView.type === 'reputation'
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
                }
              `}
            >
              <Globe className="w-5 h-5" />
              <span className="font-medium">Reputation Analysis</span>
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      {categories.length > 0 && (
        <div className="mx-5 border-t border-gray-100"></div>
      )}

      {/* Categories Section */}
      {categories.length > 0 && (
        <div className="p-3">
          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Categories
          </div>

          <div className="mt-1 space-y-1">
            {categories.map((category, index) => {
              const isExpanded = expandedCategories.includes(index);
              const colorClass = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
              const isActiveCategory = activeView.type === 'category' && activeView.categoryIndex === index;

              return (
                <div key={index}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(index)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all
                      ${isActiveCategory
                        ? 'bg-gray-50'
                        : 'hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
                    <span className="font-medium text-gray-700 flex-1 text-left text-sm">
                      {formatCategoryName(category.name)}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {/* Sub-items */}
                  {isExpanded && (
                    <div className="ml-9 mt-1 space-y-0.5">
                      <button
                        onClick={() => handleViewChange({
                          type: 'category',
                          categoryIndex: index,
                          subTab: 'visibility'
                        })}
                        className={`
                          flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-all
                          ${activeView.type === 'category' &&
                            activeView.categoryIndex === index &&
                            activeView.subTab === 'visibility'
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                          }
                        `}
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
                        className={`
                          flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-all
                          ${activeView.type === 'category' &&
                            activeView.categoryIndex === index &&
                            activeView.subTab === 'competitive'
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                          }
                        `}
                      >
                        <Trophy className="w-4 h-4" />
                        <span>Competitive</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locations Section - Only for non-multi-market reports */}
      {!isMultiMarket && (countries?.length > 0 || languages?.length > 0) && (
        <>
          <div className="mx-5 border-t border-gray-100"></div>
          <div className="p-3">
            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Location
            </div>
            <div className="px-4 py-2 flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {countries && countries.length > 0
                  ? countries.join(', ')
                  : 'Global'}
                {languages && languages.length > 0 && (
                  <span className="text-gray-400"> ({languages.join(', ')})</span>
                )}
              </span>
            </div>
          </div>
        </>
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
  insightsCount: PropTypes.number,
  isMultiMarket: PropTypes.bool,
  isSharedView: PropTypes.bool
};

PrimarySidebar.defaultProps = {
  categories: [],
  hasReputation: false,
  countries: [],
  languages: [],
  insightsCount: 0,
  isMultiMarket: false,
  isSharedView: false
};

export default PrimarySidebar;
