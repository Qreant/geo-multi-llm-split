import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Edit2, RotateCcw, ArrowLeft, ArrowRight, Loader, FileText } from 'lucide-react';

const DEFAULT_QUESTION_TEMPLATES = {
  reputation: [
    'Is {{entity}} good?',
    'Is {{entity}} worth it?',
    'Should I buy {{entity}}?',
    'Is {{entity}} reliable?',
    'Is {{entity}} a good value?',
    'Is {{entity}} popular right now?',
    'Does {{entity}} have good reviews?',
    'Reviews about {{entity}}?',
    '{{entity}} pros and cons?',
    'What do people say about {{entity}}?'
  ],
  visibility: [
    'Best {{category}}?',
    'Top {{category}} brands?',
    'Top {{category}} models?',
    'Which {{category}} should I choose?',
    'What should I look for in {{category}}?',
    'Most affordable {{category}}?',
    'Most durable {{category}}?',
    'Best {{category}} for beginners?',
    'Best {{category}} for experts?',
    'Recommend {{category}}.'
  ],
  competitive: [
    '{{entities}} — which is better{{suffix}}?',
    'Compare {{entitiesComma}}{{suffix}}.',
    '{{entitiesOr}}{{suffix}}?',
    '{{entities}}{{suffix}}',
    'Which is better: {{entitiesComma}}{{suffix}}?',
    '{{entities}} — which should I buy{{suffix}}?',
    'What\'s the difference between {{entitiesComma}}{{suffix}}?',
    'Which is better value: {{entitiesComma}}{{suffix}}?',
    'Which is more reliable: {{entitiesComma}}{{suffix}}?',
    'Should I get: {{entitiesOr}}{{suffix}}?'
  ]
};

export default function PromptsStep({ entity, markets, categoryFamilies, competitors, questions: initialQuestions, onComplete, onBack }) {
  // Separate structures:
  // - reputationQuestions: { [marketCode]: [...questions] } - per market only
  // - categoryQuestions: { [marketCode]: { [categoryId]: { visibility, competitive } } } - per market × category
  const [reputationQuestions, setReputationQuestions] = useState({});
  const [categoryQuestions, setCategoryQuestions] = useState({});

  const [selectedReputationMarket, setSelectedReputationMarket] = useState(markets[0]?.code);
  const [selectedCategoryMarket, setSelectedCategoryMarket] = useState(markets[0]?.code);
  const [selectedCategory, setSelectedCategory] = useState(categoryFamilies[0]?.id);

  const [expandedReputation, setExpandedReputation] = useState(true);
  const [expandedVisibility, setExpandedVisibility] = useState(false);
  const [expandedCompetitive, setExpandedCompetitive] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [loading, setLoading] = useState(true);

  const getMarketFlag = (marketCode) => {
    const flags = {
      'en-US': '🇺🇸', 'en-UK': '🇬🇧', 'en-GB': '🇬🇧', 'en-CA': '🇨🇦', 'en-AU': '🇦🇺',
      'fr-FR': '🇫🇷', 'de-DE': '🇩🇪', 'es-ES': '🇪🇸', 'it-IT': '🇮🇹',
      'ja-JA': '🇯🇵', 'ja-JP': '🇯🇵', 'ko-KO': '🇰🇷', 'ko-KR': '🇰🇷',
      'zh-CH': '🇨🇳', 'zh-CN': '🇨🇳', 'pt-BR': '🇧🇷', 'es-MX': '🇲🇽'
    };
    return flags[marketCode] || '🌍';
  };

  // Generate questions on mount
  useEffect(() => {
    generateAllQuestions();
  }, []);

  const generateAllQuestions = () => {
    setLoading(true);

    // Generate reputation questions (per market only)
    const repQuestions = {};
    for (const market of markets) {
      repQuestions[market.code] = DEFAULT_QUESTION_TEMPLATES.reputation.map((q, idx) => ({
        id: `REP_Q${idx + 1}`,
        type: 'reputation',
        question: q.replace(/\{\{entity\}\}/g, entity),
        editable: true
      }));
    }
    setReputationQuestions(repQuestions);

    // Generate category questions (per market × category)
    const catQuestions = {};
    for (const market of markets) {
      catQuestions[market.code] = {};

      for (const category of categoryFamilies) {
        const categoryName = category.translations[market.code]?.name || category.canonical_name;
        const categoryCompetitors = competitors[category.id]?.[market.code] || [];

        const allEntities = [entity, ...categoryCompetitors];
        const entitiesVs = allEntities.join(' vs ');
        const entitiesComma = allEntities.join(', ');
        const entitiesOr = allEntities.join(' or ');
        const suffix = categoryName ? ` for ${categoryName}` : '';

        catQuestions[market.code][category.id] = {
          visibility: DEFAULT_QUESTION_TEMPLATES.visibility.map((q, idx) => ({
            id: `VIS_Q${idx + 1}`,
            type: 'visibility',
            question: q.replace(/\{\{category\}\}/g, categoryName),
            editable: true
          })),
          competitive: DEFAULT_QUESTION_TEMPLATES.competitive.map((q, idx) => ({
            id: `COMP_Q${idx + 1}`,
            type: 'competitive',
            question: q
              .replace(/\{\{entities\}\}/g, entitiesVs)
              .replace(/\{\{entitiesComma\}\}/g, entitiesComma)
              .replace(/\{\{entitiesOr\}\}/g, entitiesOr)
              .replace(/\{\{suffix\}\}/g, suffix),
            editable: true
          }))
        };
      }
    }
    setCategoryQuestions(catQuestions);
    setLoading(false);
  };

  const updateReputationQuestion = (marketCode, index, newText) => {
    setReputationQuestions(prev => ({
      ...prev,
      [marketCode]: prev[marketCode]?.map((q, i) =>
        i === index ? { ...q, question: newText } : q
      )
    }));
    setEditingQuestion(null);
  };

  const updateCategoryQuestion = (type, index, newText) => {
    setCategoryQuestions(prev => ({
      ...prev,
      [selectedCategoryMarket]: {
        ...prev[selectedCategoryMarket],
        [selectedCategory]: {
          ...prev[selectedCategoryMarket]?.[selectedCategory],
          [type]: prev[selectedCategoryMarket]?.[selectedCategory]?.[type]?.map((q, i) =>
            i === index ? { ...q, question: newText } : q
          )
        }
      }
    }));
    setEditingQuestion(null);
  };

  const resetToDefaults = () => {
    generateAllQuestions();
  };

  const getTotalQuestions = () => {
    let total = 0;
    // Reputation: per market
    total += markets.length * DEFAULT_QUESTION_TEMPLATES.reputation.length;
    // Visibility + Competitive: per market × category
    total += markets.length * categoryFamilies.length * DEFAULT_QUESTION_TEMPLATES.visibility.length;
    total += markets.length * categoryFamilies.length * DEFAULT_QUESTION_TEMPLATES.competitive.length;
    return total;
  };

  // Build allQuestions for onComplete (backwards compatible structure)
  const buildAllQuestions = () => {
    const result = {};
    for (const market of markets) {
      result[market.code] = {};
      for (const category of categoryFamilies) {
        result[market.code][category.id] = {
          reputation: reputationQuestions[market.code] || [],
          visibility: categoryQuestions[market.code]?.[category.id]?.visibility || [],
          competitive: categoryQuestions[market.code]?.[category.id]?.competitive || []
        };
      }
    }
    return result;
  };

  const currentCategoryMarket = markets.find(m => m.code === selectedCategoryMarket) || markets[0];
  const currentCategory = categoryFamilies.find(c => c.id === selectedCategory) || categoryFamilies[0];

  if (loading) {
    return (
      <div className="card-base">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader className="w-8 h-8 text-[#10B981] animate-spin mb-4" />
          <p className="text-[#757575]">Generating questions...</p>
        </div>
      </div>
    );
  }

  // Helper to render question list
  const renderQuestionList = (questionList, type, onUpdate) => (
    <div className="space-y-2">
      {questionList.map((q, index) => {
        const isEditing = editingQuestion === `${type}-${index}`;
        return (
          <div
            key={q.id}
            className="flex items-start gap-3 p-3 bg-white rounded border border-[#E0E0E0]"
          >
            <span className="text-xs text-[#9E9E9E] font-mono w-16 pt-1">{q.id}</span>
            {isEditing ? (
              <input
                type="text"
                defaultValue={q.question}
                autoFocus
                className="flex-1 px-3 py-2 text-sm border border-[#10B981] rounded focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onUpdate(index, e.target.value);
                  if (e.key === 'Escape') setEditingQuestion(null);
                }}
                onBlur={(e) => onUpdate(index, e.target.value)}
              />
            ) : (
              <>
                <span className="flex-1 text-sm text-[#212121]">{q.question}</span>
                <button
                  onClick={() => setEditingQuestion(`${type}-${index}`)}
                  className="p-1 text-[#757575] hover:text-[#10B981] hover:bg-[#E8F5E9] rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-base">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#4CAF50]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#212121]">Review & customize prompts</h3>
              <p className="text-sm text-[#757575]">{getTotalQuestions()} total questions</p>
            </div>
          </div>
          <button
            onClick={resetToDefaults}
            className="px-3 py-2 text-[#757575] hover:bg-[#F4F6F8] rounded font-medium text-sm transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* REPUTATION SECTION - Per Market Only */}
      <div className="card-base !p-0 overflow-hidden">
        <button
          onClick={() => setExpandedReputation(!expandedReputation)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F4F6F8] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div className="text-left">
              <span className="font-medium text-[#212121]">Reputation Analysis</span>
              <p className="text-xs text-[#757575]">Brand perception questions · Same for all categories</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 bg-[#E3F2FD] text-[#1565C0] text-xs rounded-full">
              {markets.length} market{markets.length > 1 ? 's' : ''} × {DEFAULT_QUESTION_TEMPLATES.reputation.length} questions
            </span>
            {expandedReputation ? <ChevronUp className="w-5 h-5 text-[#757575]" /> : <ChevronDown className="w-5 h-5 text-[#757575]" />}
          </div>
        </button>

        {expandedReputation && (
          <div className="border-t border-[#E0E0E0] bg-[#F4F6F8] p-4">
            {/* Market Selector for Reputation */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-[#757575] mb-2">Select market to edit</label>
              <div className="flex flex-wrap gap-2">
                {markets.map(market => (
                  <button
                    key={market.code}
                    onClick={() => setSelectedReputationMarket(market.code)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      selectedReputationMarket === market.code
                        ? 'bg-[#10B981] text-white'
                        : 'bg-white text-[#757575] border border-[#E0E0E0] hover:bg-[#F4F6F8]'
                    }`}
                  >
                    <span>{getMarketFlag(market.code)}</span>
                    {market.country}
                  </button>
                ))}
              </div>
            </div>
            {renderQuestionList(
              reputationQuestions[selectedReputationMarket] || [],
              `rep-${selectedReputationMarket}`,
              (index, newText) => updateReputationQuestion(selectedReputationMarket, index, newText)
            )}
          </div>
        )}
      </div>

      {/* VISIBILITY & COMPETITIVE SECTION - Per Market × Category */}
      <div className="card-base !p-0 overflow-hidden">
        <div className="p-4 border-b border-[#E0E0E0]">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">🎯</span>
            <div>
              <span className="font-medium text-[#212121]">Category Analysis</span>
              <p className="text-xs text-[#757575]">Visibility & competitive questions · Per category</p>
            </div>
            <span className="ml-auto px-2 py-1 bg-[#FFF3E0] text-[#E65100] text-xs rounded-full">
              {markets.length} × {categoryFamilies.length} combinations
            </span>
          </div>

          {/* Market + Category Selectors */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#757575] mb-2">Market</label>
              <div className="flex flex-wrap gap-2">
                {markets.map(market => (
                  <button
                    key={market.code}
                    onClick={() => setSelectedCategoryMarket(market.code)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      selectedCategoryMarket === market.code
                        ? 'bg-[#10B981] text-white'
                        : 'bg-white text-[#757575] border border-[#E0E0E0] hover:bg-[#F4F6F8]'
                    }`}
                  >
                    <span>{getMarketFlag(market.code)}</span>
                    {market.country}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#757575] mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {categoryFamilies.map(category => {
                  const categoryName = category.translations[selectedCategoryMarket]?.name || category.canonical_name;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-[#10B981] text-white'
                          : 'bg-white text-[#757575] border border-[#E0E0E0] hover:bg-[#F4F6F8]'
                      }`}
                    >
                      {categoryName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Visibility Questions */}
        <div className="border-b border-[#E0E0E0]">
          <button
            onClick={() => setExpandedVisibility(!expandedVisibility)}
            className="w-full flex items-center justify-between p-4 hover:bg-[#F4F6F8] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">👁️</span>
              <span className="font-medium text-[#212121]">Visibility Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#757575]">
                {categoryQuestions[selectedCategoryMarket]?.[selectedCategory]?.visibility?.length || 0} questions
              </span>
              {expandedVisibility ? <ChevronUp className="w-5 h-5 text-[#757575]" /> : <ChevronDown className="w-5 h-5 text-[#757575]" />}
            </div>
          </button>
          {expandedVisibility && (
            <div className="bg-[#F4F6F8] p-4">
              {renderQuestionList(
                categoryQuestions[selectedCategoryMarket]?.[selectedCategory]?.visibility || [],
                `vis-${selectedCategoryMarket}-${selectedCategory}`,
                (index, newText) => updateCategoryQuestion('visibility', index, newText)
              )}
            </div>
          )}
        </div>

        {/* Competitive Questions */}
        <div>
          <button
            onClick={() => setExpandedCompetitive(!expandedCompetitive)}
            className="w-full flex items-center justify-between p-4 hover:bg-[#F4F6F8] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">⚔️</span>
              <span className="font-medium text-[#212121]">Competitive Analysis</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#757575]">
                {categoryQuestions[selectedCategoryMarket]?.[selectedCategory]?.competitive?.length || 0} questions
              </span>
              {expandedCompetitive ? <ChevronUp className="w-5 h-5 text-[#757575]" /> : <ChevronDown className="w-5 h-5 text-[#757575]" />}
            </div>
          </button>
          {expandedCompetitive && (
            <div className="bg-[#F4F6F8] p-4">
              {renderQuestionList(
                categoryQuestions[selectedCategoryMarket]?.[selectedCategory]?.competitive || [],
                `comp-${selectedCategoryMarket}-${selectedCategory}`,
                (index, newText) => updateCategoryQuestion('competitive', index, newText)
              )}
            </div>
          )}
        </div>
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
          onClick={() => onComplete(buildAllQuestions())}
          className="px-6 py-3 bg-[#10B981] text-white font-medium rounded-lg hover:bg-[#059669] transition-colors flex items-center gap-2"
        >
          Review & Launch
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
