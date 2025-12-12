import { useState, useMemo } from 'react';
import { X, Trophy, AlertCircle, ExternalLink, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';

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
  const domain = llm === 'gemini' ? 'google.com' : 'openai.com';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function getBrandLogoUrl(brandName) {
  if (!brandName) return null;
  const domain = brandName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .trim() + '.com';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

// LLM display names for tooltips
const LLM_DISPLAY_NAMES = {
  gemini: 'Gemini',
  openai: 'ChatGPT',
  claude: 'Claude',
  perplexity: 'Perplexity'
};

/**
 * CompetitiveMatrixHeatmap - Matrix view showing competitive outcomes across markets
 * Uses 3-state system: Won (green), Lost (red), Split (amber) with click-to-expand detail
 */
export default function CompetitiveMatrixHeatmap({
  rankedFirst = [],
  notRankedFirst = [],
  entity,
  selectedLLMs = ['gemini', 'openai'],
  perMarketData = null,
  markets = null
}) {
  const [selectedCell, setSelectedCell] = useState(null);
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'won', 'lost'
  const [marketFilter, setMarketFilter] = useState('all');
  const [llmFilter, setLlmFilter] = useState('all'); // 'all', 'both', 'split'
  const [showFilters, setShowFilters] = useState(false);

  // Check if we're in multi-market mode
  const hasMultiMarket = perMarketData && perMarketData.length > 1;

  // Build unified question list (flat structure like visibility table)
  const unifiedQuestions = useMemo(() => {
    const questions = [];

    if (hasMultiMarket) {
      // Multi-market: Create flat list with market info per question
      perMarketData.forEach(marketItem => {
        const marketCode = marketItem.marketCode;
        const marketCountry = marketItem.marketCountry;
        const marketData = marketItem.data;

        const allMarketQuestions = [
          ...(marketData?.ranked_first_questions || []),
          ...(marketData?.not_ranked_first_questions || [])
        ];

        allMarketQuestions.forEach((q, idx) => {
          const cellState = computeCellState(q, entity, selectedLLMs);
          questions.push({
            id: `${marketCode}-${idx}`,
            text: q.question,
            marketCode,
            marketCountry,
            ...cellState,
            rawData: q
          });
        });
      });
    } else {
      // Single market: Use combined data
      const allQuestions = [...rankedFirst, ...notRankedFirst];
      allQuestions.forEach((q, idx) => {
        const cellState = computeCellState(q, entity, selectedLLMs);
        questions.push({
          id: `q-${idx}`,
          text: q.question,
          marketCode: null,
          marketCountry: 'All Markets',
          ...cellState,
          rawData: q
        });
      });
    }

    return questions;
  }, [rankedFirst, notRankedFirst, perMarketData, entity, selectedLLMs, hasMultiMarket]);

  // Get unique markets for display
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
      if (searchQuery && !q.text.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter === 'won' && q.status !== 'won') return false;
      if (statusFilter === 'lost' && q.status !== 'lost') return false;

      // Market filter
      if (marketFilter !== 'all' && q.marketCode !== marketFilter) return false;

      // LLM agreement filter
      if (llmFilter === 'both' && q.llmAgreement !== 'both') return false;
      if (llmFilter === 'split' && q.llmAgreement !== 'split') return false;

      return true;
    });
  }, [unifiedQuestions, searchQuery, statusFilter, marketFilter, llmFilter]);

  // Calculate summary stats from filtered questions
  const stats = useMemo(() => {
    let won = 0, lost = 0, split = 0;
    filteredQuestions.forEach(q => {
      if (q.status === 'won') won++;
      else if (q.status === 'lost') lost++;
      else if (q.status === 'split') split++;
    });
    return { won, lost, split, total: filteredQuestions.length };
  }, [filteredQuestions]);

  // Handle row click
  const handleRowClick = (question) => {
    setSelectedCell(question);
    setExpandedQuestion(null);
  };

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#E0E0E0]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-medium text-[#212121]">Competitive Questions Matrix</h3>
            <p className="text-sm text-[#757575]">
              {stats.total} questions •
              <span className="text-[#4CAF50]"> {stats.won} won</span> •
              <span className="text-[#F44336]"> {stats.lost} lost</span>
              {stats.split > 0 && <span className="text-[#FF9800]"> • {stats.split} split</span>}
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
                <option value="won">Won</option>
                <option value="lost">Lost</option>
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

      {/* Content: Table + Detail Panel */}
      <div className="flex" style={{ height: '500px' }}>
        {/* Table */}
        <div className={`flex-1 overflow-auto transition-all ${selectedCell ? 'border-r border-[#E0E0E0]' : ''}`}>
          <table className="w-full">
            <thead className="sticky top-0 bg-[#FAFAFA] z-10">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#757575] uppercase tracking-wider">Question</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-[#757575] uppercase tracking-wider w-24">Result</th>
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
                  onClick={() => handleRowClick(q)}
                  className={`cursor-pointer transition-colors ${
                    selectedCell?.id === q.id
                      ? 'bg-[#E3F2FD]'
                      : 'hover:bg-[#F5F5F5]'
                  }`}
                >
                  <td className="px-4 py-3">
                    <p className="text-sm text-[#212121] line-clamp-2">{q.text}</p>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {q.status === 'split' ? (
                      <div className="relative group">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-semibold bg-[#FFF3E0] text-[#FF9800]">
                          Split
                        </span>
                        {/* Tooltip with LLM breakdown */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-[#424242] text-white text-[10px] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-20 shadow-lg">
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-gray-300">{LLM_DISPLAY_NAMES.gemini}</span>
                              <span className={q.geminiWinner?.toLowerCase() === entity.toLowerCase() ? 'text-[#81C784]' : 'text-[#EF9A9A]'}>
                                {q.geminiWinner || '?'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-gray-300">{LLM_DISPLAY_NAMES.openai}</span>
                              <span className={q.openaiWinner?.toLowerCase() === entity.toLowerCase() ? 'text-[#81C784]' : 'text-[#EF9A9A]'}>
                                {q.openaiWinner || '?'}
                              </span>
                            </div>
                          </div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#424242]" />
                        </div>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-semibold ${
                        q.status === 'won' ? 'bg-[#E8F5E9] text-[#4CAF50]' : 'bg-[#FFEBEE] text-[#F44336]'
                      }`}>
                        {q.status === 'won' ? 'Won' : 'Lost'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {q.status === 'split' ? (
                      // Split decision: show "Split" with hover tooltip for each LLM's winner
                      <div className="relative group">
                        <span className="text-sm text-[#FF9800] font-medium cursor-help">
                          Split
                        </span>
                        {/* Tooltip with LLM breakdown */}
                        <div className="absolute bottom-full left-0 mb-2 px-2 py-1.5 bg-[#424242] text-white text-[10px] rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-20 shadow-lg">
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-gray-300">{LLM_DISPLAY_NAMES.gemini}:</span>
                              <span className={q.geminiWinner?.toLowerCase() === entity.toLowerCase() ? 'text-[#81C784]' : 'text-[#EF9A9A]'}>
                                {q.geminiWinner || '?'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-gray-300">{LLM_DISPLAY_NAMES.openai}:</span>
                              <span className={q.openaiWinner?.toLowerCase() === entity.toLowerCase() ? 'text-[#81C784]' : 'text-[#EF9A9A]'}>
                                {q.openaiWinner || '?'}
                              </span>
                            </div>
                          </div>
                          <div className="absolute top-full left-4 border-4 border-transparent border-t-[#424242]" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <img
                          src={getBrandLogoUrl(q.status === 'won' ? entity : q.winner)}
                          alt=""
                          className="w-5 h-5 rounded object-contain"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                        <span className="text-sm text-[#212121]">
                          {q.status === 'won' ? entity : q.winner}
                        </span>
                      </div>
                    )}
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
                    {searchQuery || statusFilter !== 'all' || marketFilter !== 'all' || llmFilter !== 'all'
                      ? 'No questions match your filters'
                      : 'No competitive questions available'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selectedCell && (
          <div className="w-[380px] flex-shrink-0 overflow-auto bg-[#FAFAFA] animate-slideIn">
            <div className="p-4">
              {/* Panel Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {selectedCell.status === 'won' ? (
                    <div className="w-8 h-8 rounded-lg bg-[#4CAF50] flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-white" />
                    </div>
                  ) : selectedCell.status === 'lost' ? (
                    <div className="w-8 h-8 rounded-lg bg-[#F44336] flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#FF9800] flex items-center justify-center">
                      <span className="text-white text-xs font-bold">?</span>
                    </div>
                  )}
                  <div>
                    <span className={`text-sm font-semibold ${
                      selectedCell.status === 'won' ? 'text-[#4CAF50]' :
                      selectedCell.status === 'lost' ? 'text-[#F44336]' :
                      'text-[#FF9800]'
                    }`}>
                      {selectedCell.status === 'won' ? `${entity} Chosen` :
                       selectedCell.status === 'lost' ? `${selectedCell.winner} Chosen` :
                       'LLMs Disagree'}
                    </span>
                    {selectedCell.marketCountry && selectedCell.marketCode && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {getFlagUrl(selectedCell.marketCode) && (
                          <img src={getFlagUrl(selectedCell.marketCode)} alt="" className="w-4 h-4 rounded-full" />
                        )}
                        <span className="text-xs text-[#757575]">{selectedCell.marketCountry}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="w-7 h-7 rounded-lg bg-white border border-[#E0E0E0] flex items-center justify-center hover:bg-[#FFEBEE] hover:border-[#F44336] transition-colors"
                >
                  <X className="w-4 h-4 text-[#757575]" />
                </button>
              </div>

              {/* Question */}
              <h4 className="text-base font-medium text-[#212121] mb-4 leading-relaxed">
                {selectedCell.text}
              </h4>

              {/* Split Decision Breakdown */}
              {selectedCell.status === 'split' && (
                <div className="mb-4 p-3 bg-[#FFF3E0] border border-[#FFE0B2] rounded-lg">
                  <p className="text-xs font-semibold text-[#FF9800] uppercase tracking-wider mb-2">
                    LLM Disagreement
                  </p>
                  <div className="flex gap-2">
                    <div className={`flex-1 p-2 rounded-lg text-center ${
                      selectedCell.geminiWinner?.toLowerCase() === entity.toLowerCase()
                        ? 'bg-[#E8F5E9] border border-[#4CAF50]'
                        : 'bg-[#FFEBEE] border border-[#F44336]'
                    }`}>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <img src={getLLMLogoUrl('gemini')} alt="" className="w-3 h-3 rounded" onError={(e) => e.target.style.display = 'none'} />
                        <span className="text-[10px] font-medium text-[#757575]">Gemini</span>
                      </div>
                      <span className={`text-xs font-semibold ${
                        selectedCell.geminiWinner?.toLowerCase() === entity.toLowerCase()
                          ? 'text-[#4CAF50]'
                          : 'text-[#F44336]'
                      }`}>
                        {selectedCell.geminiWinner || 'Unknown'}
                      </span>
                    </div>
                    <div className={`flex-1 p-2 rounded-lg text-center ${
                      selectedCell.openaiWinner?.toLowerCase() === entity.toLowerCase()
                        ? 'bg-[#E8F5E9] border border-[#4CAF50]'
                        : 'bg-[#FFEBEE] border border-[#F44336]'
                    }`}>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <img src={getLLMLogoUrl('openai')} alt="" className="w-3 h-3 rounded" onError={(e) => e.target.style.display = 'none'} />
                        <span className="text-[10px] font-medium text-[#757575]">ChatGPT</span>
                      </div>
                      <span className={`text-xs font-semibold ${
                        selectedCell.openaiWinner?.toLowerCase() === entity.toLowerCase()
                          ? 'text-[#4CAF50]'
                          : 'text-[#F44336]'
                      }`}>
                        {selectedCell.openaiWinner || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* LLM Responses */}
              <div className="space-y-3">
                {/* Gemini Response */}
                {selectedCell.geminiData && (
                  <div className="bg-white border border-[#E0E0E0] rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedQuestion(expandedQuestion === 'gemini' ? null : 'gemini')}
                      className="w-full flex items-center justify-between px-3 py-2 bg-[#F8FAFF] border-b border-[#E0E0E0] hover:bg-[#EEF4FF] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={getLLMLogoUrl('gemini')}
                          alt="Gemini"
                          className="w-4 h-4 rounded"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                        <span className="text-xs font-semibold text-[#4285F4]">Gemini</span>
                        <span className={`text-xs font-medium ${
                          selectedCell.geminiData.rank === 1 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                        }`}>
                          — {selectedCell.geminiData.rank === 1 ? `Chose ${entity}` : `Chose ${selectedCell.geminiData.top_brand || 'Other'}`}
                        </span>
                      </div>
                      {expandedQuestion === 'gemini' ? (
                        <ChevronUp className="w-4 h-4 text-[#757575]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#757575]" />
                      )}
                    </button>
                    {expandedQuestion === 'gemini' && (
                      <div className="p-3 animate-fadeIn">
                        <p className="text-sm text-[#424242] leading-relaxed mb-3">
                          {selectedCell.geminiData.rank === 1
                            ? selectedCell.geminiData.target_comment
                            : selectedCell.geminiData.top_brand_comment}
                        </p>
                        {selectedCell.geminiData.rank !== 1 && selectedCell.geminiData.target_comment && (
                          <div className="mt-2 pt-2 border-t border-[#E0E0E0]">
                            <p className="text-xs text-[#757575] mb-1">About {entity}:</p>
                            <p className="text-sm text-[#616161]">{selectedCell.geminiData.target_comment}</p>
                          </div>
                        )}
                        {selectedCell.geminiData.sources?.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-[#E0E0E0]">
                            <p className="text-xs text-[#757575] mb-1">Sources:</p>
                            {selectedCell.geminiData.sources.slice(0, 2).map((s, idx) => (
                              <a
                                key={idx}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-[#2196F3] hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {s.title || s.url}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ChatGPT Response */}
                {selectedCell.openaiData && (
                  <div className="bg-white border border-[#E0E0E0] rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedQuestion(expandedQuestion === 'openai' ? null : 'openai')}
                      className="w-full flex items-center justify-between px-3 py-2 bg-[#F6FBF9] border-b border-[#E0E0E0] hover:bg-[#E8F5F2] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={getLLMLogoUrl('openai')}
                          alt="ChatGPT"
                          className="w-4 h-4 rounded"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                        <span className="text-xs font-semibold text-[#10A37F]">ChatGPT</span>
                        <span className={`text-xs font-medium ${
                          selectedCell.openaiData.rank === 1 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                        }`}>
                          — {selectedCell.openaiData.rank === 1 ? `Chose ${entity}` : `Chose ${selectedCell.openaiData.top_brand || 'Other'}`}
                        </span>
                      </div>
                      {expandedQuestion === 'openai' ? (
                        <ChevronUp className="w-4 h-4 text-[#757575]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#757575]" />
                      )}
                    </button>
                    {expandedQuestion === 'openai' && (
                      <div className="p-3 animate-fadeIn">
                        <p className="text-sm text-[#424242] leading-relaxed mb-3">
                          {selectedCell.openaiData.rank === 1
                            ? selectedCell.openaiData.target_comment
                            : selectedCell.openaiData.top_brand_comment}
                        </p>
                        {selectedCell.openaiData.rank !== 1 && selectedCell.openaiData.target_comment && (
                          <div className="mt-2 pt-2 border-t border-[#E0E0E0]">
                            <p className="text-xs text-[#757575] mb-1">About {entity}:</p>
                            <p className="text-sm text-[#616161]">{selectedCell.openaiData.target_comment}</p>
                          </div>
                        )}
                        {selectedCell.openaiData.sources?.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-[#E0E0E0]">
                            <p className="text-xs text-[#757575] mb-1">Sources:</p>
                            {selectedCell.openaiData.sources.slice(0, 2).map((s, idx) => (
                              <a
                                key={idx}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-[#2196F3] hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {s.title || s.url}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Expand All Button */}
              {(selectedCell.geminiData || selectedCell.openaiData) && (
                <button
                  onClick={() => setExpandedQuestion(expandedQuestion ? null : 'all')}
                  className="w-full mt-3 py-2 text-xs font-medium text-[#2196F3] hover:bg-[#E3F2FD] rounded-lg transition-colors"
                >
                  {expandedQuestion ? 'Collapse All' : 'Expand All Responses'}
                </button>
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slideIn {
          animation: slideIn 0.2s ease-out;
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out;
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

/**
 * Compute cell state from question data
 */
function computeCellState(questionData, entity, selectedLLMs) {
  const geminiData = questionData.llm_responses?.gemini;
  const openaiData = questionData.llm_responses?.openai;

  const geminiChoseTarget = geminiData?.rank === 1;
  const openaiChoseTarget = openaiData?.rank === 1;

  const geminiWinner = geminiChoseTarget ? entity : (geminiData?.top_brand || 'Unknown');
  const openaiWinner = openaiChoseTarget ? entity : (openaiData?.top_brand || 'Unknown');

  let status = 'lost';
  let winner = null;
  let llmAgreement = 'none';

  if (selectedLLMs.includes('gemini') && selectedLLMs.includes('openai')) {
    if (geminiChoseTarget && openaiChoseTarget) {
      status = 'won';
      winner = entity;
      llmAgreement = 'both';
    } else if (!geminiChoseTarget && !openaiChoseTarget) {
      status = 'lost';
      // Use the most common winner or first available
      winner = geminiWinner === openaiWinner ? geminiWinner : geminiWinner;
      llmAgreement = 'both';
    } else {
      status = 'split';
      winner = geminiChoseTarget ? entity : openaiWinner;
      llmAgreement = 'split';
    }
  } else if (selectedLLMs.includes('gemini') && geminiData) {
    status = geminiChoseTarget ? 'won' : 'lost';
    winner = geminiWinner;
    llmAgreement = 'gemini';
  } else if (selectedLLMs.includes('openai') && openaiData) {
    status = openaiChoseTarget ? 'won' : 'lost';
    winner = openaiWinner;
    llmAgreement = 'openai';
  }

  return {
    status,
    winner,
    llmAgreement,
    geminiWinner,
    openaiWinner,
    geminiData: geminiData ? {
      rank: geminiData.rank,
      top_brand: geminiData.top_brand,
      target_comment: geminiData.target_comment,
      top_brand_comment: geminiData.top_brand_comment,
      sources: geminiData.sources || []
    } : null,
    openaiData: openaiData ? {
      rank: openaiData.rank,
      top_brand: openaiData.top_brand,
      target_comment: openaiData.target_comment,
      top_brand_comment: openaiData.top_brand_comment,
      sources: openaiData.sources || []
    } : null
  };
}
