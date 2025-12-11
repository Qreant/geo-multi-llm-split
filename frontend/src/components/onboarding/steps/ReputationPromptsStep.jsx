import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { ChevronDown, ChevronUp, Edit2, RotateCcw, ArrowLeft, ArrowRight, Loader, MessageSquare, Plus, X } from 'lucide-react';

// English templates (will be translated by LLM for other languages)
const ENGLISH_TEMPLATES = [
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
];

export default function ReputationPromptsStep({ entity, markets, reputationQuestions: initialQuestions, onComplete, onBack }) {
  const [reputationQuestions, setReputationQuestions] = useState(initialQuestions || {});
  const [selectedMarket, setSelectedMarket] = useState(markets[0]?.code);
  const [expanded, setExpanded] = useState(true);
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
    if (Object.keys(reputationQuestions).length === 0) {
      generateQuestions();
    } else {
      setLoading(false);
    }
  }, []);

  const generateQuestions = async () => {
    setLoading(true);
    const generated = {};

    // First, generate English questions with entity substituted
    const englishQuestions = ENGLISH_TEMPLATES.map(t => t.replace(/\{\{entity\}\}/g, entity));

    // Get unique languages
    const languagesNeeded = [...new Set(markets.map(m => m.language))];
    const translationCache = {};

    // Translate complete questions for each unique language
    for (const language of languagesNeeded) {
      if (language === 'English') {
        translationCache['English'] = englishQuestions;
      } else {
        try {
          const response = await api.post('/api/analysis/translate-templates', {
            templates: englishQuestions,
            targetLanguage: language,
            entity
          });
          translationCache[language] = response.data.translations;
        } catch (error) {
          console.error(`Failed to translate to ${language}:`, error);
          translationCache[language] = englishQuestions; // Fallback to English
        }
      }
    }

    // Build questions for each market using cached translations
    for (const market of markets) {
      const questions = translationCache[market.language] || englishQuestions;
      generated[market.code] = questions.map((question, idx) => ({
        id: `REP_Q${idx + 1}`,
        type: 'reputation',
        question,
        editable: true
      }));
    }

    setReputationQuestions(generated);
    setLoading(false);
  };

  const updateQuestion = (marketCode, index, newText) => {
    setReputationQuestions(prev => ({
      ...prev,
      [marketCode]: prev[marketCode]?.map((q, i) =>
        i === index ? { ...q, question: newText } : q
      )
    }));
    setEditingQuestion(null);
  };

  const addQuestion = (marketCode) => {
    const existingQuestions = reputationQuestions[marketCode] || [];
    const newId = `REP_Q${existingQuestions.length + 1}_${Date.now()}`;
    const newQuestion = {
      id: newId,
      type: 'reputation',
      question: '',
      editable: true,
      isCustom: true
    };
    setReputationQuestions(prev => ({
      ...prev,
      [marketCode]: [...(prev[marketCode] || []), newQuestion]
    }));
    // Auto-focus the new question for editing
    setEditingQuestion(`${marketCode}-${existingQuestions.length}`);
  };

  const removeQuestion = (marketCode, index) => {
    setReputationQuestions(prev => ({
      ...prev,
      [marketCode]: prev[marketCode].filter((_, i) => i !== index)
    }));
  };

  const currentMarket = markets.find(m => m.code === selectedMarket) || markets[0];
  const currentQuestions = reputationQuestions[selectedMarket] || [];

  // Check if all markets have valid questions (no empty questions)
  const hasEmptyQuestions = Object.values(reputationQuestions).some(marketQuestions =>
    marketQuestions?.some(q => !q.question?.trim())
  );
  const canProceed = !hasEmptyQuestions && Object.keys(reputationQuestions).length > 0;

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
            <div className="w-10 h-10 bg-[#E3F2FD] rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-[#2196F3]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#212121]">Reputation Prompts</h3>
              <p className="text-sm text-[#757575]">
                Questions about brand perception · Same for all categories
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

      {/* Market Selector */}
      <div className="card-base">
        <label className="block text-sm font-medium text-[#757575] mb-3">Select market to edit</label>
        <div className="flex flex-wrap gap-2">
          {markets.map(market => (
            <button
              key={market.code}
              onClick={() => setSelectedMarket(market.code)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                selectedMarket === market.code
                  ? 'bg-[#10B981] text-white'
                  : 'bg-[#F4F6F8] text-[#757575] hover:bg-[#E0E0E0]'
              }`}
            >
              <span>{getMarketFlag(market.code)}</span>
              {market.country}
              <span className="text-xs opacity-75">({market.language})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Questions */}
      <div className="card-base !p-0 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-[#F4F6F8] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div className="text-left">
              <span className="font-medium text-[#212121]">
                {getMarketFlag(selectedMarket)} {currentMarket?.country} Questions
              </span>
              <p className="text-xs text-[#757575]">{currentMarket?.language}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#757575]">{currentQuestions.length} questions</span>
            {expanded ? <ChevronUp className="w-5 h-5 text-[#757575]" /> : <ChevronDown className="w-5 h-5 text-[#757575]" />}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-[#E0E0E0] bg-[#F4F6F8] p-4 space-y-2">
            {currentQuestions.map((q, index) => {
              const isEditing = editingQuestion === `${selectedMarket}-${index}`;
              const canDelete = currentQuestions.length > 1;
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
                      placeholder="Enter your question..."
                      className="flex-1 px-3 py-2 text-sm border border-[#10B981] rounded focus:outline-none focus:ring-1 focus:ring-[#10B981]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateQuestion(selectedMarket, index, e.target.value);
                        if (e.key === 'Escape') setEditingQuestion(null);
                      }}
                      onBlur={(e) => updateQuestion(selectedMarket, index, e.target.value)}
                    />
                  ) : (
                    <>
                      <span className={`flex-1 text-sm ${q.question ? 'text-[#212121]' : 'text-[#9E9E9E] italic'}`}>
                        {q.question || 'Click edit to add question...'}
                      </span>
                      <button
                        onClick={() => setEditingQuestion(`${selectedMarket}-${index}`)}
                        className="p-1 text-[#757575] hover:text-[#10B981] hover:bg-[#E8F5E9] rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeQuestion(selectedMarket, index)}
                        disabled={!canDelete}
                        className={`p-1 rounded transition-colors ${
                          canDelete
                            ? 'text-[#757575] hover:text-red-500 hover:bg-red-50'
                            : 'text-[#E0E0E0] cursor-not-allowed'
                        }`}
                        title={canDelete ? 'Remove question' : 'At least one question is required'}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Add Question Button */}
            <button
              onClick={() => addQuestion(selectedMarket)}
              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[#E0E0E0] rounded hover:border-[#10B981] hover:bg-[#E8F5E9] text-[#757575] hover:text-[#10B981] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Question</span>
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-[#E3F2FD] border border-[#2196F3]/20 rounded-lg p-4">
        <p className="text-sm text-[#1565C0]">
          <strong>Tip:</strong> Reputation questions are about your brand "{entity}" and apply to all categories.
          Each market has questions in its local language.
        </p>
      </div>

      {/* Validation Warning */}
      {hasEmptyQuestions && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700">
            <strong>Warning:</strong> Some questions are empty. Please fill in all questions before continuing.
          </p>
        </div>
      )}

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
          onClick={() => onComplete(reputationQuestions)}
          disabled={!canProceed}
          className={`px-6 py-3 font-medium rounded-lg transition-colors flex items-center gap-2 ${
            canProceed
              ? 'bg-[#10B981] text-white hover:bg-[#059669]'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={!canProceed ? 'Please fill in all questions' : ''}
        >
          Category Prompts
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
