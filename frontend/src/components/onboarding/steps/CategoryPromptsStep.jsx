import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { ChevronDown, ChevronUp, Edit2, RotateCcw, ArrowLeft, ArrowRight, Loader, Target } from 'lucide-react';

// English visibility templates (will be translated by LLM for other languages)
const ENGLISH_VISIBILITY_TEMPLATES = [
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
];

// English competitive templates (will be translated by LLM for other languages)
const ENGLISH_COMPETITIVE_TEMPLATES = [
  '{{entities}} — which is better{{suffix}}?',
  'Compare {{entitiesComma}}{{suffix}}.',
  '{{entitiesOr}}{{suffix}}?',
  '{{entities}}{{suffix}}',
  'Which is better: {{entitiesComma}}{{suffix}}?',
  '{{entities}} — which should I buy{{suffix}}?',
  "What's the difference between {{entitiesComma}}{{suffix}}?",
  'Which is better value: {{entitiesComma}}{{suffix}}?',
  'Which is more reliable: {{entitiesComma}}{{suffix}}?',
  'Should I get: {{entitiesOr}}{{suffix}}?'
];

export default function CategoryPromptsStep({ entity, markets, categoryFamilies, competitors, categoryQuestions: initialQuestions, onComplete, onBack }) {
  const [categoryQuestions, setCategoryQuestions] = useState(initialQuestions || {});
  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.code);
  const [selectedCategory, setSelectedCategory] = useState(categoryFamilies[0]?.id);
  const [expandedVisibility, setExpandedVisibility] = useState(true);
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
    if (Object.keys(categoryQuestions).length === 0) {
      generateQuestions();
    } else {
      setLoading(false);
    }
  }, []);

  const generateQuestions = async () => {
    setLoading(true);
    const generated = {};

    // First, build all English questions for each market/category
    const englishQuestions = {};
    const primaryMarket = markets.find(m => m.isPrimary) || markets[0];

    for (const category of categoryFamilies) {
      const categoryName = category.translations[primaryMarket.code]?.name || category.canonical_name;
      const categoryCompetitors = competitors[category.id]?.[primaryMarket.code] || [];

      const allEntities = [entity, ...categoryCompetitors];
      const entitiesVs = allEntities.join(' vs ');
      const entitiesComma = allEntities.join(', ');
      const entitiesOr = allEntities.join(' or ');
      const suffix = categoryName ? ` for ${categoryName}` : '';

      englishQuestions[category.id] = {
        visibility: ENGLISH_VISIBILITY_TEMPLATES.map(t => t.replace(/\{\{category\}\}/g, categoryName)),
        competitive: ENGLISH_COMPETITIVE_TEMPLATES.map(t =>
          t.replace(/\{\{entities\}\}/g, entitiesVs)
           .replace(/\{\{entitiesComma\}\}/g, entitiesComma)
           .replace(/\{\{entitiesOr\}\}/g, entitiesOr)
           .replace(/\{\{suffix\}\}/g, suffix)
        )
      };
    }

    // Get unique languages
    const languagesNeeded = [...new Set(markets.map(m => m.language))];

    // For each market, translate or use English
    for (const market of markets) {
      generated[market.code] = {};

      for (const category of categoryFamilies) {
        const categoryName = category.translations[market.code]?.name || category.canonical_name;
        const categoryCompetitors = competitors[category.id]?.[market.code] || [];

        // Build English questions for this specific market/category (for translation)
        const allEntities = [entity, ...categoryCompetitors];
        const entitiesVs = allEntities.join(' vs ');
        const entitiesComma = allEntities.join(', ');
        const entitiesOr = allEntities.join(' or ');
        const suffix = categoryName ? ` for ${categoryName}` : '';

        const visEnglish = ENGLISH_VISIBILITY_TEMPLATES.map(t => t.replace(/\{\{category\}\}/g, categoryName));
        const compEnglish = ENGLISH_COMPETITIVE_TEMPLATES.map(t =>
          t.replace(/\{\{entities\}\}/g, entitiesVs)
           .replace(/\{\{entitiesComma\}\}/g, entitiesComma)
           .replace(/\{\{entitiesOr\}\}/g, entitiesOr)
           .replace(/\{\{suffix\}\}/g, suffix)
        );

        if (market.language === 'English') {
          generated[market.code][category.id] = {
            visibility: visEnglish.map((q, idx) => ({ id: `VIS_Q${idx + 1}`, type: 'visibility', question: q, editable: true })),
            competitive: compEnglish.map((q, idx) => ({ id: `COMP_Q${idx + 1}`, type: 'competitive', question: q, editable: true }))
          };
        } else {
          try {
            // Translate complete questions
            const [visResponse, compResponse] = await Promise.all([
              api.post('/api/analysis/translate-templates', { templates: visEnglish, targetLanguage: market.language, entity }),
              api.post('/api/analysis/translate-templates', { templates: compEnglish, targetLanguage: market.language, entity })
            ]);

            generated[market.code][category.id] = {
              visibility: visResponse.data.translations.map((q, idx) => ({ id: `VIS_Q${idx + 1}`, type: 'visibility', question: q, editable: true })),
              competitive: compResponse.data.translations.map((q, idx) => ({ id: `COMP_Q${idx + 1}`, type: 'competitive', question: q, editable: true }))
            };
          } catch (error) {
            console.error(`Failed to translate for ${market.code}/${category.id}:`, error);
            // Fallback to English
            generated[market.code][category.id] = {
              visibility: visEnglish.map((q, idx) => ({ id: `VIS_Q${idx + 1}`, type: 'visibility', question: q, editable: true })),
              competitive: compEnglish.map((q, idx) => ({ id: `COMP_Q${idx + 1}`, type: 'competitive', question: q, editable: true }))
            };
          }
        }
      }
    }

    setCategoryQuestions(generated);
    setLoading(false);
  };

  const updateQuestion = (type, index, newText) => {
    setCategoryQuestions(prev => ({
      ...prev,
      [selectedMarket]: {
        ...prev[selectedMarket],
        [selectedCategory]: {
          ...prev[selectedMarket]?.[selectedCategory],
          [type]: prev[selectedMarket]?.[selectedCategory]?.[type]?.map((q, i) =>
            i === index ? { ...q, question: newText } : q
          )
        }
      }
    }));
    setEditingQuestion(null);
  };

  const currentMarket = markets.find(m => m.code === selectedMarket) || markets[0];
  const currentCategory = categoryFamilies.find(c => c.id === selectedCategory) || categoryFamilies[0];
  const currentQuestions = categoryQuestions[selectedMarket]?.[selectedCategory] || {};

  // Helper to render question list
  const renderQuestionList = (questionList, type) => (
    <div className="space-y-2">
      {(questionList || []).map((q, index) => {
        const isEditing = editingQuestion === `${type}-${selectedMarket}-${selectedCategory}-${index}`;
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
                  if (e.key === 'Enter') updateQuestion(type, index, e.target.value);
                  if (e.key === 'Escape') setEditingQuestion(null);
                }}
                onBlur={(e) => updateQuestion(type, index, e.target.value)}
              />
            ) : (
              <>
                <span className="flex-1 text-sm text-[#212121]">{q.question}</span>
                <button
                  onClick={() => setEditingQuestion(`${type}-${selectedMarket}-${selectedCategory}-${index}`)}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-base">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFF3E0] rounded-full flex items-center justify-center">
              <Target className="w-5 h-5 text-[#E65100]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#212121]">Category Prompts</h3>
              <p className="text-sm text-[#757575]">
                Visibility & competitive questions · Per market × category
              </p>
            </div>
          </div>
          <button
            onClick={generateQuestions}
            className="px-3 py-2 text-[#757575] hover:bg-[#F4F6F8] rounded font-medium text-sm transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Market + Category Selectors */}
      <div className="card-base">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[#757575] mb-3">Market</label>
            <div className="flex flex-wrap gap-2">
              {markets.map(market => (
                <button
                  key={market.code}
                  onClick={() => setSelectedMarket(market.code)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedMarket === market.code
                      ? 'bg-[#10B981] text-white'
                      : 'bg-[#F4F6F8] text-[#757575] hover:bg-[#E0E0E0]'
                  }`}
                >
                  <span>{getMarketFlag(market.code)}</span>
                  {market.country}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#757575] mb-3">Category</label>
            <div className="flex flex-wrap gap-2">
              {categoryFamilies.map(category => {
                const categoryName = category.translations[selectedMarket]?.name || category.canonical_name;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-[#10B981] text-white'
                        : 'bg-[#F4F6F8] text-[#757575] hover:bg-[#E0E0E0]'
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

      {/* Current Context */}
      <div className="bg-[#F4F6F8] rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
        <span className="text-[#757575]">Editing:</span>
        <span className="font-medium text-[#212121]">
          {getMarketFlag(selectedMarket)} {currentMarket?.country}
        </span>
        <span className="text-[#757575]">→</span>
        <span className="font-medium text-[#212121]">
          {currentCategory?.translations[selectedMarket]?.name || currentCategory?.canonical_name}
        </span>
      </div>

      {/* Visibility Questions */}
      <div className="card-base !p-0 overflow-hidden">
        <button
          onClick={() => setExpandedVisibility(!expandedVisibility)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F4F6F8] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">👁️</span>
            <div className="text-left">
              <span className="font-medium text-[#212121]">Visibility Analysis</span>
              <p className="text-xs text-[#757575]">Category ranking questions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#757575]">{currentQuestions.visibility?.length || 0} questions</span>
            {expandedVisibility ? <ChevronUp className="w-5 h-5 text-[#757575]" /> : <ChevronDown className="w-5 h-5 text-[#757575]" />}
          </div>
        </button>
        {expandedVisibility && (
          <div className="border-t border-[#E0E0E0] bg-[#F4F6F8] p-4">
            {renderQuestionList(currentQuestions.visibility, 'visibility')}
          </div>
        )}
      </div>

      {/* Competitive Questions */}
      <div className="card-base !p-0 overflow-hidden">
        <button
          onClick={() => setExpandedCompetitive(!expandedCompetitive)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F4F6F8] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">⚔️</span>
            <div className="text-left">
              <span className="font-medium text-[#212121]">Competitive Analysis</span>
              <p className="text-xs text-[#757575]">Head-to-head comparison questions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#757575]">{currentQuestions.competitive?.length || 0} questions</span>
            {expandedCompetitive ? <ChevronUp className="w-5 h-5 text-[#757575]" /> : <ChevronDown className="w-5 h-5 text-[#757575]" />}
          </div>
        </button>
        {expandedCompetitive && (
          <div className="border-t border-[#E0E0E0] bg-[#F4F6F8] p-4">
            {renderQuestionList(currentQuestions.competitive, 'competitive')}
          </div>
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
          onClick={() => onComplete(categoryQuestions)}
          className="px-6 py-3 bg-[#10B981] text-white font-medium rounded-lg hover:bg-[#059669] transition-colors flex items-center gap-2"
        >
          Review & Launch
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
