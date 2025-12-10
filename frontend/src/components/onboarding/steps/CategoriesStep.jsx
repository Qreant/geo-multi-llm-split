import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Edit2, Plus, AlertTriangle, ArrowLeft, ArrowRight, X, Sparkles } from 'lucide-react';
import { api } from '../../../lib/api';

export default function CategoriesStep({ entity, markets, categoryFamilies, onComplete, onBack }) {
  const [categories, setCategories] = useState(categoryFamilies);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [editingTranslation, setEditingTranslation] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const primaryMarket = markets.find(m => m.isPrimary) || markets[0];

  const toggleCategory = (categoryId) => {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === categoryId ? { ...cat, isSelected: !cat.isSelected } : cat
      )
    );
  };

  const updateTranslation = (categoryId, marketCode, newName) => {
    setCategories(prev =>
      prev.map(cat => {
        if (cat.id !== categoryId) return cat;
        return {
          ...cat,
          translations: {
            ...cat.translations,
            [marketCode]: {
              ...cat.translations[marketCode],
              name: newName
            }
          }
        };
      })
    );
    setEditingTranslation(null);
  };

  const addCustomCategory = async () => {
    if (!newCategoryName.trim()) return;

    setIsTranslating(true);

    try {
      // Create a new category with translations
      const newId = `cat_custom_${Date.now()}`;

      // If we have multiple markets, translate the category name
      let translations = {
        [primaryMarket.code]: {
          name: newCategoryName.trim(),
          detected: false,
          confidence: null
        }
      };

      // Translate to other markets
      const otherMarkets = markets.filter(m => m.code !== primaryMarket.code);
      if (otherMarkets.length > 0) {
        const response = await api.post('/api/analysis/translate-categories', {
          categories: [newCategoryName.trim()],
          sourceLanguage: primaryMarket.language,
          targetLanguage: otherMarkets.map(m => m.language)
        });

        // Add translations for each market
        otherMarkets.forEach((market, idx) => {
          const translatedName = response.data.translations?.[0]?.translated || newCategoryName.trim();
          translations[market.code] = {
            name: translatedName,
            detected: false,
            confidence: null
          };
        });
      }

      const newCategory = {
        id: newId,
        canonical_name: newCategoryName.trim().toLowerCase().replace(/\s+/g, '_'),
        translations,
        detected_in_markets: [],
        match_confidence: 1.0,
        source: 'manual',
        isSelected: true
      };

      setCategories(prev => [...prev, newCategory]);
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch (error) {
      console.error('Failed to translate category:', error);
      // Still add the category with just the primary market translation
      const newCategory = {
        id: `cat_custom_${Date.now()}`,
        canonical_name: newCategoryName.trim().toLowerCase().replace(/\s+/g, '_'),
        translations: markets.reduce((acc, market) => {
          acc[market.code] = {
            name: newCategoryName.trim(),
            detected: false,
            confidence: null
          };
          return acc;
        }, {}),
        detected_in_markets: [],
        match_confidence: 1.0,
        source: 'manual',
        isSelected: true
      };

      setCategories(prev => [...prev, newCategory]);
      setNewCategoryName('');
      setShowAddCategory(false);
    } finally {
      setIsTranslating(false);
    }
  };

  const removeCategory = (categoryId) => {
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
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

  const selectedCount = categories.filter(c => c.isSelected).length;
  const isValid = selectedCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-base">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-[#212121]">
            We detected these categories for {entity}
          </h3>
          <span className="text-sm text-[#757575]">
            {selectedCount} of {categories.length} selected
          </span>
        </div>
        <p className="text-sm text-[#757575]">
          Select the categories you want to analyze. Click to expand and edit translations.
        </p>
      </div>

      {/* Category List */}
      <div className="space-y-3">
        {categories.map(category => {
          const isExpanded = expandedCategory === category.id;
          const primaryTranslation = category.translations[primaryMarket.code];

          return (
            <div
              key={category.id}
              className={`
                card-base !p-0 overflow-hidden transition-all duration-200
                ${category.isSelected ? 'ring-2 ring-[#10B981]' : ''}
              `}
            >
              {/* Category Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className={`
                      w-6 h-6 rounded border-2 flex items-center justify-center transition-colors
                      ${category.isSelected
                        ? 'bg-[#10B981] border-[#10B981] text-white'
                        : 'border-[#E0E0E0] hover:border-[#10B981]'
                      }
                    `}
                  >
                    {category.isSelected && <Check className="w-4 h-4" />}
                  </button>

                  {/* Category Name */}
                  <div>
                    <span className="font-medium text-[#212121]">
                      {primaryTranslation?.name || category.canonical_name}
                    </span>
                    {category.source === 'manual' && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-[#E3F2FD] text-[#2196F3] rounded-full">
                        Custom
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Detection Warnings */}
                  {markets.some(m => !category.translations[m.code]?.detected) && category.source !== 'manual' && (
                    <span className="flex items-center gap-1 text-xs text-[#F57C00]">
                      <AlertTriangle className="w-3 h-3" />
                      Partial
                    </span>
                  )}

                  {/* Expand Button */}
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : category.id)}
                    className="p-2 text-[#757575] hover:bg-[#F4F6F8] rounded transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>

                  {/* Remove Button (only for custom categories) */}
                  {category.source === 'manual' && (
                    <button
                      onClick={() => removeCategory(category.id)}
                      className="p-2 text-[#757575] hover:text-[#EF5350] hover:bg-red-50 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Translations */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[#E0E0E0] bg-[#F4F6F8]">
                  <div className="pt-4 space-y-2">
                    {markets.map(market => {
                      const translation = category.translations[market.code];
                      const isEditing = editingTranslation === `${category.id}-${market.code}`;

                      return (
                        <div
                          key={market.code}
                          className="flex items-center justify-between p-2 bg-white rounded border border-[#E0E0E0]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getMarketFlag(market.code)}</span>
                            <span className="text-sm text-[#757575]">{market.language}</span>
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                defaultValue={translation?.name || ''}
                                autoFocus
                                className="px-2 py-1 text-sm border border-[#10B981] rounded focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateTranslation(category.id, market.code, e.target.value);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingTranslation(null);
                                  }
                                }}
                                onBlur={(e) => updateTranslation(category.id, market.code, e.target.value)}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#212121]">
                                {translation?.name || '—'}
                              </span>

                              {!translation?.detected && category.source !== 'manual' && (
                                <span className="px-1.5 py-0.5 text-xs bg-[#FFF3E0] text-[#F57C00] rounded">
                                  Translated
                                </span>
                              )}

                              <button
                                onClick={() => setEditingTranslation(`${category.id}-${market.code}`)}
                                className="p-1 text-[#757575] hover:text-[#10B981] hover:bg-[#E8F5E9] rounded transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Custom Category */}
        {showAddCategory ? (
          <div className="card-base">
            <h4 className="font-medium text-[#212121] mb-3">Add a custom category</h4>
            <p className="text-sm text-[#757575] mb-3">
              Enter the category name in {primaryMarket.language}. We'll translate it to other markets.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={`e.g., running shoes, cloud storage...`}
                className="flex-1 px-3 py-2 border border-[#E0E0E0] rounded focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newCategoryName.trim()) {
                    addCustomCategory();
                  }
                }}
              />
              <button
                onClick={addCustomCategory}
                disabled={!newCategoryName.trim() || isTranslating}
                className="px-4 py-2 bg-[#10B981] text-white font-medium rounded hover:bg-[#059669] disabled:bg-[#E0E0E0] disabled:text-[#9E9E9E] transition-colors flex items-center gap-2"
              >
                {isTranslating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Translating...
                  </>
                ) : (
                  'Add'
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddCategory(false);
                  setNewCategoryName('');
                }}
                className="px-4 py-2 text-[#757575] hover:bg-[#F4F6F8] rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCategory(true)}
            className="w-full p-4 border border-dashed border-[#E0E0E0] rounded-lg text-[#757575] hover:border-[#10B981] hover:text-[#10B981] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add custom category
          </button>
        )}
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
          onClick={() => onComplete(categories)}
          disabled={!isValid}
          className="px-6 py-3 bg-[#10B981] text-white font-medium rounded-lg hover:bg-[#059669] disabled:bg-[#E0E0E0] disabled:text-[#9E9E9E] disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          Define Competitors
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
