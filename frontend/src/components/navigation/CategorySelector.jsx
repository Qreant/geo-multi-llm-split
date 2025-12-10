import PropTypes from 'prop-types';

/**
 * CategorySelector Component
 * Button group for selecting between multiple categories
 * Only displayed when there are multiple categories
 */
const CategorySelector = ({ categories, selected, onChange }) => {
  if (!categories || categories.length <= 1) {
    return null;
  }

  return (
    <div className="mb-4">
      <p className="text-xs text-[#757575] mb-2 uppercase tracking-wide">Select Category</p>
      <div className="flex flex-wrap gap-2">
        {categories.map((category, index) => (
          <button
            key={index}
            onClick={() => onChange(index)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selected === index
                ? 'bg-[#10B981] text-white shadow-sm'
                : 'bg-white text-[#757575] border border-[#E0E0E0] hover:border-[#10B981] hover:text-[#10B981]'
            }`}
          >
            {category.name || `Category ${index + 1}`}
          </button>
        ))}
      </div>
    </div>
  );
};

CategorySelector.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      visibility: PropTypes.object,
      competitive: PropTypes.object
    })
  ).isRequired,
  selected: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired
};

export default CategorySelector;
