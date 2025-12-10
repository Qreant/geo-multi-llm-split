import { Eye, Swords } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * CategorySubTabs Component
 * Horizontal sub-tabs for Visibility and Competitive within Category tab
 */
const CategorySubTabs = ({ activeSubTab, onSubTabChange }) => {
  const subTabs = [
    {
      id: 'visibility',
      label: 'Visibility',
      icon: Eye
    },
    {
      id: 'competitive',
      label: 'Competitive',
      icon: Swords
    }
  ];

  return (
    <div className="border-b border-[#E0E0E0]">
      <nav className="flex">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSubTabChange(tab.id)}
            className={`category-subtab flex items-center ${
              activeSubTab === tab.id ? 'category-subtab-active' : ''
            }`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

CategorySubTabs.propTypes = {
  activeSubTab: PropTypes.oneOf(['visibility', 'competitive']).isRequired,
  onSubTabChange: PropTypes.func.isRequired
};

export default CategorySubTabs;
