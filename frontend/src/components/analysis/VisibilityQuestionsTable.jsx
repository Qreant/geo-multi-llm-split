import { useState, useMemo } from 'react';
import { X, Search, Filter, ChevronDown, Trophy, AlertCircle, ExternalLink } from 'lucide-react';

// Map country suffix to ISO codes for flag display
const COUNTRY_SUFFIX_TO_ISO = {
  'US': 'us', 'CA': 'ca', 'MX': 'mx', 'GB': 'gb', 'UK': 'gb', 'IE': 'ie', 'FR': 'fr',
  'DE': 'de', 'ES': 'es', 'IT': 'it', 'PT': 'pt', 'NL': 'nl', 'BE': 'be', 'AT': 'at',
  'CH': 'ch', 'LU': 'lu', 'SE': 'se', 'NO': 'no', 'DK': 'dk', 'FI': 'fi', 'IS': 'is',
  'PL': 'pl', 'CZ': 'cz', 'SK': 'sk', 'HU': 'hu', 'RO': 'ro', 'BG': 'bg', 'UA': 'ua',
  'RU': 'ru', 'GR': 'gr', 'HR': 'hr', 'SI': 'si', 'RS': 'rs', 'JP': 'jp', 'KR': 'kr',
  'CN': 'cn', 'TW': 'tw', 'HK': 'hk', 'SG': 'sg', 'AU': 'au', 'NZ': 'nz', 'TH': 'th',
  'VN': 'vn', 'ID': 'id', 'MY': 'my', 'PH': 'ph', 'IN': 'in', 'BD': 'bd', 'PK': 'pk',
  'SA': 'sa', 'AE': 'ae', 'EG': 'eg', 'IL': 'il', 'TR': 'tr', 'IR': 'ir', 'QA': 'qa',
  'BR': 'br', 'AR': 'ar', 'CL': 'cl', 'CO': 'co', 'PE': 'pe', 'ZA': 'za',
  'UN': 'us', 'GE': 'de', 'SP': 'es', 'SW': 'ch', 'NE': 'nl', 'PO': 'pt',
  'JA': 'jp', 'KO': 'kr', 'SO': 'kr', 'TA': 'tw', 'HO': 'hk', 'TU': 'tr', 'ME': 'mx', 'IR': 'ie', 'IS': 'il'
};

function getCountryCode(marketCode) {
  if (!marketCode) return null;
  const parts = marketCode.split('-');
  const countrySuffix = parts.length > 1 ? parts[1].toUpperCase() : parts[0].toUpperCase();
  return COUNTRY_SUFFIX_TO_ISO[countrySuffix] || (countrySuffix.length === 2 ? countrySuffix.toLowerCase() : null);
}

function getFlagUrl(marketCode) {
  const countryCode = getCountryCode(marketCode);
  return countryCode ? `https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg` : null;
}

function getLLMLogoUrl(llm) {
  const clientId = import.meta.env.VITE_LOGO_API_KEY;
  if (!clientId) return null;
  const domain = llm === 'gemini' ? 'google.com' : 'openai.com';
  return `https://cdn.brandfetch.io/${domain}?c=${clientId}`;
}

// LLM display names for tooltips
const LLM_DISPLAY_NAMES = {
  gemini: 'Gemini',
  openai: 'ChatGPT',
  claude: 'Claude',
  perplexity: 'Perplexity'
};

/**
 * VisibilityQuestionsTable - Filterable data table with side panel for visibility questions
 * Shows questions where brand is ranked #1 or not ranked #1 across markets
 */
export default function VisibilityQuestionsTable({
  rankedFirst = [],
  notRankedFirst = [],
  entity,
  selectedLLMs = ['gemini', 'openai'],
  perMarketData = null,
  markets = null
}) {
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'won', 'lost'
  const [marketFilter, setMarketFilter] = useState('all');
  const [llmFilter, setLlmFilter] = useState('all'); // 'all', 'gemini', 'openai', 'both', 'split'
  const [showFilters, setShowFilters] = useState(false);

  // Build unified question list with market context
  const unifiedQuestions = useMemo(() => {
    const questions = [];
    const hasMultiMarket = perMarketData && perMarketData.length > 1;

    if (hasMultiMarket) {
      // Multi-market: Create entries for each market
      perMarketData.forEach(marketItem => {
        const marketCode = marketItem.marketCode;
        const marketCountry = marketItem.marketCountry;
        const marketData = marketItem.data;

        const allMarketQuestions = [
          ...(marketData?.ranked_first_questions || []),
          ...(marketData?.not_ranked_first_questions || [])
        ];

        allMarketQuestions.forEach((q, idx) => {
          const geminiData = q.llm_responses?.gemini;
          const openaiData = q.llm_responses?.openai;

          // Skip if no data for selected LLMs
          if (!geminiData && !openaiData) return;

          const geminiRank1 = geminiData?.target_rank === 1;
          const openaiRank1 = openaiData?.target_rank === 1;

          // Determine status based on selected LLMs
          let status = 'lost';
          let llmAgreement = 'none';

          if (selectedLLMs.includes('gemini') && selectedLLMs.includes('openai')) {
            if (geminiRank1 && openaiRank1) {
              status = 'won';
              llmAgreement = 'both';
            } else if (!geminiRank1 && !openaiRank1) {
              status = 'lost';
              llmAgreement = 'both';
            } else {
              status = geminiRank1 || openaiRank1 ? 'split-won' : 'split-lost';
              llmAgreement = 'split';
            }
          } else if (selectedLLMs.includes('gemini')) {
            status = geminiRank1 ? 'won' : 'lost';
            llmAgreement = 'gemini';
          } else if (selectedLLMs.includes('openai')) {
            status = openaiRank1 ? 'won' : 'lost';
            llmAgreement = 'openai';
          }

          // Build LLM ranks object for all available LLMs
          const llmRanks = {};
          if (geminiData?.target_rank) llmRanks.gemini = geminiData.target_rank;
          if (openaiData?.target_rank) llmRanks.openai = openaiData.target_rank;

          // Calculate average rank
          const rankValues = Object.values(llmRanks);
          const avgRank = rankValues.length > 0
            ? Math.round((rankValues.reduce((a, b) => a + b, 0) / rankValues.length) * 10) / 10
            : null;

          questions.push({
            id: `${marketCode}-${idx}`,
            question: q.question,
            marketCode,
            marketCountry,
            status,
            llmAgreement,
            targetRank: geminiData?.target_rank || openaiData?.target_rank || null,
            llmRanks,
            avgRank,
            topBrand: geminiData?.top_brand || openaiData?.top_brand || 'Unknown',
            geminiData,
            openaiData,
            fullRanking: geminiData?.full_ranking || openaiData?.full_ranking || [],
            sources: [...(geminiData?.sources || []), ...(openaiData?.sources || [])]
          });
        });
      });
    } else {
      // Single market: Use combined data
      const allQuestions = [...rankedFirst, ...notRankedFirst];

      allQuestions.forEach((q, idx) => {
        const geminiData = q.llm_responses?.gemini;
        const openaiData = q.llm_responses?.openai;

        if (!geminiData && !openaiData) return;

        const geminiRank1 = geminiData?.target_rank === 1;
        const openaiRank1 = openaiData?.target_rank === 1;

        let status = 'lost';
        let llmAgreement = 'none';

        if (selectedLLMs.includes('gemini') && selectedLLMs.includes('openai')) {
          if (geminiRank1 && openaiRank1) {
            status = 'won';
            llmAgreement = 'both';
          } else if (!geminiRank1 && !openaiRank1) {
            status = 'lost';
            llmAgreement = 'both';
          } else {
            status = geminiRank1 || openaiRank1 ? 'split-won' : 'split-lost';
            llmAgreement = 'split';
          }
        } else if (selectedLLMs.includes('gemini')) {
          status = geminiRank1 ? 'won' : 'lost';
          llmAgreement = 'gemini';
        } else if (selectedLLMs.includes('openai')) {
          status = openaiRank1 ? 'won' : 'lost';
          llmAgreement = 'openai';
        }

        // Build LLM ranks object for all available LLMs
        const llmRanks = {};
        if (geminiData?.target_rank) llmRanks.gemini = geminiData.target_rank;
        if (openaiData?.target_rank) llmRanks.openai = openaiData.target_rank;

        // Calculate average rank
        const rankValues = Object.values(llmRanks);
        const avgRank = rankValues.length > 0
          ? Math.round((rankValues.reduce((a, b) => a + b, 0) / rankValues.length) * 10) / 10
          : null;

        questions.push({
          id: `single-${idx}`,
          question: q.question,
          marketCode: null,
          marketCountry: 'All Markets',
          status,
          llmAgreement,
          targetRank: geminiData?.target_rank || openaiData?.target_rank || null,
          llmRanks,
          avgRank,
          topBrand: geminiData?.top_brand || openaiData?.top_brand || 'Unknown',
          geminiData,
          openaiData,
          fullRanking: geminiData?.full_ranking || openaiData?.full_ranking || [],
          sources: [...(geminiData?.sources || []), ...(openaiData?.sources || [])]
        });
      });
    }

    return questions;
  }, [rankedFirst, notRankedFirst, perMarketData, selectedLLMs]);

  // Get unique markets for filter dropdown
  const availableMarkets = useMemo(() => {
    const marketSet = new Set();
    unifiedQuestions.forEach(q => {
      if (q.marketCode) marketSet.add(q.marketCode);
    });
    return Array.from(marketSet);
  }, [unifiedQuestions]);

  // Apply filters
  const filteredQuestions = useMemo(() => {
    return unifiedQuestions.filter(q => {
      // Search filter
      if (searchQuery && !q.question.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter === 'won' && !q.status.includes('won')) return false;
      if (statusFilter === 'lost' && q.status.includes('won')) return false;

      // Market filter
      if (marketFilter !== 'all' && q.marketCode !== marketFilter) return false;

      // LLM agreement filter
      if (llmFilter === 'both' && q.llmAgreement !== 'both') return false;
      if (llmFilter === 'split' && q.llmAgreement !== 'split') return false;
      if (llmFilter === 'gemini' && q.llmAgreement !== 'gemini') return false;
      if (llmFilter === 'openai' && q.llmAgreement !== 'openai') return false;

      return true;
    });
  }, [unifiedQuestions, searchQuery, statusFilter, marketFilter, llmFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const won = filteredQuestions.filter(q => q.status === 'won' || q.status === 'split-won').length;
    const lost = filteredQuestions.filter(q => q.status === 'lost' || q.status === 'split-lost').length;
    const split = filteredQuestions.filter(q => q.llmAgreement === 'split').length;
    return { won, lost, split, total: filteredQuestions.length };
  }, [filteredQuestions]);

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#E0E0E0]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-medium text-[#212121]">Visibility Questions</h3>
            <p className="text-sm text-[#757575]">
              {stats.total} questions • {stats.won} won • {stats.lost} lost
              {stats.split > 0 && ` • ${stats.split} split`}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showFilters ? 'bg-[#E3F2FD] text-[#1976D2]' : 'bg-[#F5F5F5] text-[#757575] hover:bg-[#EEEEEE]'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(statusFilter !== 'all' || marketFilter !== 'all' || llmFilter !== 'all') && (
              <span className="w-2 h-2 bg-[#1976D2] rounded-full" />
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9E9E9E]" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg text-sm focus:outline-none focus:border-[#2196F3] focus:bg-white transition-colors"
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-[#E0E0E0] flex flex-wrap gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#757575]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1 text-sm bg-white border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#2196F3]"
              >
                <option value="all">All</option>
                <option value="won">Won (#1)</option>
                <option value="lost">Not #1</option>
              </select>
            </div>

            {/* Market Filter */}
            {availableMarkets.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#757575]">Market:</span>
                <select
                  value={marketFilter}
                  onChange={(e) => setMarketFilter(e.target.value)}
                  className="px-2 py-1 text-sm bg-white border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#2196F3]"
                >
                  <option value="all">All Markets</option>
                  {availableMarkets.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}

            {/* LLM Agreement Filter */}
            {selectedLLMs.length === 2 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#757575]">LLM:</span>
                <select
                  value={llmFilter}
                  onChange={(e) => setLlmFilter(e.target.value)}
                  className="px-2 py-1 text-sm bg-white border border-[#E0E0E0] rounded-lg focus:outline-none focus:border-[#2196F3]"
                >
                  <option value="all">All</option>
                  <option value="both">Both Agree</option>
                  <option value="split">Split Decision</option>
                </select>
              </div>
            )}

            {/* Clear Filters */}
            {(statusFilter !== 'all' || marketFilter !== 'all' || llmFilter !== 'all') && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setMarketFilter('all');
                  setLlmFilter('all');
                }}
                className="text-xs text-[#F44336] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content: Table + Side Panel */}
      <div className="flex" style={{ height: '500px' }}>
        {/* Table */}
        <div className={`flex-1 overflow-auto transition-all ${selectedQuestion ? 'border-r border-[#E0E0E0]' : ''}`}>
          <table className="w-full">
            <thead className="sticky top-0 bg-[#FAFAFA] z-10">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#757575] uppercase tracking-wider">Question</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#757575] uppercase tracking-wider w-20">Rank</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-[#757575] uppercase tracking-wider w-28">Winner</th>
                {availableMarkets.length > 0 && (
                  <th className="text-left px-3 py-3 text-xs font-semibold text-[#757575] uppercase tracking-wider w-28">Market</th>
                )}
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#757575] uppercase tracking-wider w-24">LLM</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setSelectedQuestion(q)}
                  className={`cursor-pointer transition-colors ${
                    selectedQuestion?.id === q.id
                      ? 'bg-[#E3F2FD]'
                      : 'hover:bg-[#F5F5F5]'
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm text-[#212121] line-clamp-2">{q.question}</p>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {q.llmAgreement === 'split' ? (
                      // Split decision: show average rank with tooltip showing individual LLM ranks
                      <div className="relative group">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-semibold cursor-help bg-[#FFF3E0] text-[#FF9800]`}>
                          #{q.avgRank}
                        </span>
                        {/* Tooltip with LLM breakdown */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-[#424242] text-white text-[10px] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-20 shadow-lg">
                          <div className="space-y-0.5">
                            {Object.entries(q.llmRanks).map(([llm, rank]) => (
                              <div key={llm} className="flex items-center justify-between gap-3">
                                <span className="text-gray-300">{LLM_DISPLAY_NAMES[llm] || llm}</span>
                                <span className={rank === 1 ? 'text-[#81C784]' : 'text-[#EF9A9A]'}>#{rank}</span>
                              </div>
                            ))}
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#424242]" />
                        </div>
                      </div>
                    ) : (
                      // Agreed or single LLM: show single rank
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-semibold ${
                        q.status === 'won' ? 'bg-[#E8F5E9] text-[#4CAF50]' :
                        q.status === 'lost' ? 'bg-[#FFEBEE] text-[#F44336]' :
                        'bg-[#FFF3E0] text-[#FF9800]'
                      }`}>
                        {q.status === 'won' ? '#1' : q.targetRank ? `#${q.targetRank}` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-sm text-[#212121]">
                      {q.status === 'won' ? entity : q.topBrand}
                    </span>
                  </td>
                  {availableMarkets.length > 0 && (
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {getFlagUrl(q.marketCode) && (
                          <img
                            src={getFlagUrl(q.marketCode)}
                            alt=""
                            className="w-5 h-5 rounded-full"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <span className="text-xs text-[#757575]">{q.marketCountry}</span>
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {q.llmAgreement === 'both' && (
                        <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#4CAF50] rounded text-[10px] font-medium">
                          Both
                        </span>
                      )}
                      {q.llmAgreement === 'split' && (
                        <span className="px-2 py-0.5 bg-[#FFF3E0] text-[#FF9800] rounded text-[10px] font-medium">
                          Split
                        </span>
                      )}
                      {q.llmAgreement === 'gemini' && (
                        <span className="px-2 py-0.5 bg-[#E3F2FD] text-[#4285F4] rounded text-[10px] font-medium">
                          Gemini
                        </span>
                      )}
                      {q.llmAgreement === 'openai' && (
                        <span className="px-2 py-0.5 bg-[#E8F5E9] text-[#10A37F] rounded text-[10px] font-medium">
                          ChatGPT
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredQuestions.length === 0 && (
                <tr>
                  <td colSpan={availableMarkets.length > 0 ? 5 : 4} className="px-4 py-12 text-center text-[#757575]">
                    No questions match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Side Panel */}
        {selectedQuestion && (
          <div className="w-[380px] flex-shrink-0 overflow-auto bg-[#FAFAFA] animate-slideIn">
            <div className="p-4">
              {/* Panel Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {selectedQuestion.status === 'won' ? (
                    <div className="w-8 h-8 rounded-lg bg-[#4CAF50] flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-white" />
                    </div>
                  ) : selectedQuestion.llmAgreement === 'split' ? (
                    <div className="w-8 h-8 rounded-lg bg-[#FF9800] flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#F44336] flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className={`text-sm font-semibold ${
                    selectedQuestion.status === 'won' ? 'text-[#4CAF50]' :
                    selectedQuestion.llmAgreement === 'split' ? 'text-[#FF9800]' : 'text-[#F44336]'
                  }`}>
                    {selectedQuestion.status === 'won'
                      ? 'Ranked #1'
                      : selectedQuestion.llmAgreement === 'split'
                        ? `Avg #${selectedQuestion.avgRank} (Split)`
                        : `Ranked #${selectedQuestion.targetRank || '?'}`}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedQuestion(null)}
                  className="w-7 h-7 rounded-lg bg-white border border-[#E0E0E0] flex items-center justify-center hover:bg-[#FFEBEE] hover:border-[#F44336] transition-colors"
                >
                  <X className="w-4 h-4 text-[#757575]" />
                </button>
              </div>

              {/* Question */}
              <h4 className="text-base font-medium text-[#212121] mb-4 leading-relaxed">
                {selectedQuestion.question}
              </h4>

              {/* Meta Tags */}
              <div className="flex flex-wrap gap-2 mb-5">
                {selectedQuestion.marketCode && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#E0E0E0] rounded-lg">
                    {getFlagUrl(selectedQuestion.marketCode) && (
                      <img src={getFlagUrl(selectedQuestion.marketCode)} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <span className="text-xs text-[#757575]">{selectedQuestion.marketCountry}</span>
                  </div>
                )}
                <div className={`px-2 py-1 rounded-lg text-xs font-medium ${
                  selectedQuestion.llmAgreement === 'both' ? 'bg-[#E8F5E9] text-[#4CAF50]' :
                  selectedQuestion.llmAgreement === 'split' ? 'bg-[#FFF3E0] text-[#FF9800]' :
                  'bg-[#E3F2FD] text-[#2196F3]'
                }`}>
                  {selectedQuestion.llmAgreement === 'both' ? 'Both LLMs Agree' :
                   selectedQuestion.llmAgreement === 'split' ? 'LLMs Disagree' :
                   selectedQuestion.llmAgreement === 'gemini' ? 'Gemini Only' : 'ChatGPT Only'}
                </div>
              </div>

              {/* LLM Rank Breakdown - shown for split decisions */}
              {selectedQuestion.llmAgreement === 'split' && selectedQuestion.llmRanks && (
                <div className="mb-5">
                  <h5 className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-2">
                    Rank by LLM
                  </h5>
                  <div className="flex gap-2">
                    {Object.entries(selectedQuestion.llmRanks).map(([llm, rank]) => (
                      <div
                        key={llm}
                        className={`flex-1 px-3 py-2 rounded-lg border ${
                          rank === 1
                            ? 'bg-[#E8F5E9] border-[#A5D6A7]'
                            : 'bg-[#FFEBEE] border-[#EF9A9A]'
                        }`}
                      >
                        <div className="text-[10px] text-[#757575] uppercase tracking-wider mb-0.5">
                          {LLM_DISPLAY_NAMES[llm] || llm}
                        </div>
                        <div className={`text-lg font-semibold ${rank === 1 ? 'text-[#4CAF50]' : 'text-[#F44336]'}`}>
                          #{rank}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Ranking */}
              {selectedQuestion.fullRanking.length > 0 && (
                <div className="mb-5">
                  <h5 className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-2">
                    Full Ranking
                  </h5>
                  <div className="space-y-1.5">
                    {selectedQuestion.fullRanking.slice(0, 5).map((r, idx) => {
                      const isTarget = r.name.toLowerCase() === entity.toLowerCase();
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                            isTarget ? 'bg-[#E3F2FD] border border-[#90CAF9]' : 'bg-white border border-[#E0E0E0]'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold ${
                            r.rank === 1 ? 'bg-[#FFC107] text-white' : 'bg-[#F5F5F5] text-[#757575]'
                          }`}>
                            {r.rank}
                          </span>
                          <span className={`text-sm ${isTarget ? 'font-semibold text-[#1976D2]' : 'text-[#212121]'}`}>
                            {r.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LLM Responses */}
              <div className="space-y-3">
                {/* Gemini Response */}
                {selectedQuestion.geminiData && (
                  <div className="bg-white border border-[#E0E0E0] rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#F8FAFF] border-b border-[#E0E0E0]">
                      <img
                        src={getLLMLogoUrl('gemini')}
                        alt="Gemini"
                        className="w-4 h-4 rounded"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                      <span className="text-xs font-semibold text-[#4285F4]">Gemini</span>
                      <span className={`ml-auto text-xs font-medium ${
                        selectedQuestion.geminiData.target_rank === 1 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                      }`}>
                        {selectedQuestion.geminiData.target_rank === 1 ? `${entity} #1` : `${selectedQuestion.geminiData.top_brand || 'Other'} won`}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-[#424242] leading-relaxed">
                        {selectedQuestion.geminiData.target_rank === 1
                          ? selectedQuestion.geminiData.target_comment
                          : selectedQuestion.geminiData.top_brand_comment}
                      </p>
                      {selectedQuestion.geminiData.target_rank !== 1 && selectedQuestion.geminiData.target_comment && (
                        <div className="mt-2 pt-2 border-t border-[#E0E0E0]">
                          <p className="text-xs text-[#757575] mb-1">About {entity}:</p>
                          <p className="text-sm text-[#616161]">{selectedQuestion.geminiData.target_comment}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ChatGPT Response */}
                {selectedQuestion.openaiData && (
                  <div className="bg-white border border-[#E0E0E0] rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#F6FBF9] border-b border-[#E0E0E0]">
                      <img
                        src={getLLMLogoUrl('openai')}
                        alt="ChatGPT"
                        className="w-4 h-4 rounded"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                      <span className="text-xs font-semibold text-[#10A37F]">ChatGPT</span>
                      <span className={`ml-auto text-xs font-medium ${
                        selectedQuestion.openaiData.target_rank === 1 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                      }`}>
                        {selectedQuestion.openaiData.target_rank === 1 ? `${entity} #1` : `${selectedQuestion.openaiData.top_brand || 'Other'} won`}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-[#424242] leading-relaxed">
                        {selectedQuestion.openaiData.target_rank === 1
                          ? selectedQuestion.openaiData.target_comment
                          : selectedQuestion.openaiData.top_brand_comment}
                      </p>
                      {selectedQuestion.openaiData.target_rank !== 1 && selectedQuestion.openaiData.target_comment && (
                        <div className="mt-2 pt-2 border-t border-[#E0E0E0]">
                          <p className="text-xs text-[#757575] mb-1">About {entity}:</p>
                          <p className="text-sm text-[#616161]">{selectedQuestion.openaiData.target_comment}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sources */}
              {selectedQuestion.sources.length > 0 && (
                <div className="mt-5">
                  <h5 className="text-xs font-semibold text-[#757575] uppercase tracking-wider mb-2">
                    Sources ({selectedQuestion.sources.length})
                  </h5>
                  <div className="space-y-1.5">
                    {selectedQuestion.sources.slice(0, 4).map((source, idx) => (
                      <a
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-[#E0E0E0] rounded-lg text-sm text-[#2196F3] hover:bg-[#E3F2FD] transition-colors group"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{source.title || source.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.2s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
