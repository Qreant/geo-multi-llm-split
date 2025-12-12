import { useState, useMemo, useEffect } from 'react';
import { Trophy, AlertCircle, TrendingUp, Eye, ChevronDown, ChevronRight, Layers, BarChart3 } from 'lucide-react';
import SourceAnalysis from './SourceAnalysis';
import EntityTrendsChart from './EntityTrendsChart';
import VisibilityQuestionsTable from './VisibilityQuestionsTable';

/**
 * Generate logo URL from brand name using Google's favicon service
 */
function generateBrandLogoUrl(brandName) {
  if (!brandName) return null;

  // Convert brand name to likely domain
  const domain = brandName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .trim() + '.com';

  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

/**
 * Generate logo URL for LLM providers using Google's favicon service
 */
function getLLMLogoUrl(llm) {
  const domain = llm === 'gemini' ? 'google.com' : 'openai.com';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

/**
 * VisibilityAnalysis Component
 * Displays brand visibility metrics, rankings, and opportunities
 */
export default function VisibilityAnalysis({ data, entity, allSources = [], selectedLLMs = ['gemini', 'openai'], perMarketData = null, markets = null }) {
  // State for toggling between raw entities and brand family view
  const [showBrandFamilies, setShowBrandFamilies] = useState(true);
  // State for tracking expanded brand families
  const [expandedFamilies, setExpandedFamilies] = useState(new Set());
  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#757575]">No visibility data available</p>
      </div>
    );
  }

  const visibility = data.visibility || {};
  const rankings = data.entities_ranking || [];
  const brandFamilyRanking = data.brand_family_ranking || null;
  const brandGroupingMetadata = data.brand_grouping_metadata || null;
  const rankedFirst = data.ranked_first_questions || [];
  const notRankedFirst = data.not_ranked_first_questions || [];
  const llmPerformance = data.llm_performance || [];

  // Check if both LLMs are selected
  const bothSelected = selectedLLMs.includes('gemini') && selectedLLMs.includes('openai');

  // Calculate metrics based on selected LLMs using llm_performance data
  const filteredMetrics = useMemo(() => {
    // Filter llm_performance to only selected LLMs
    const selectedPerformance = llmPerformance.filter(perf =>
      selectedLLMs.includes(perf.llm)
    );

    if (selectedPerformance.length === 0) {
      // Fallback to combined visibility data
      return {
        visibility: visibility.visibility || 0,
        sov: visibility.sov || 0,
        avgPosition: visibility.averagePosition || 0
      };
    }

    // Average the metrics across selected LLMs
    const totalVisibility = selectedPerformance.reduce((sum, p) => sum + (p.visibility || 0), 0);
    const totalSov = selectedPerformance.reduce((sum, p) => sum + (p.sov || 0), 0);
    const totalAvgPos = selectedPerformance.reduce((sum, p) => sum + (p.avgPosition || 0), 0);

    return {
      visibility: totalVisibility / selectedPerformance.length,
      sov: totalSov / selectedPerformance.length,
      avgPosition: totalAvgPos / selectedPerformance.length
    };
  }, [llmPerformance, selectedLLMs, visibility]);

  // Helper to check if a question has data for selected LLMs
  const hasSelectedLLMData = (item) => {
    const geminiData = item.llm_responses?.gemini;
    const openaiData = item.llm_responses?.openai;

    if (selectedLLMs.includes('gemini') && selectedLLMs.includes('openai')) {
      return geminiData || openaiData;
    }
    if (selectedLLMs.includes('gemini') && !selectedLLMs.includes('openai')) {
      return geminiData;
    }
    if (selectedLLMs.includes('openai') && !selectedLLMs.includes('gemini')) {
      return openaiData;
    }
    return false;
  };

  // Filter questions by selected LLMs
  const filteredRankedFirst = useMemo(() =>
    rankedFirst.filter(hasSelectedLLMData),
    [rankedFirst, selectedLLMs]
  );

  const filteredNotRankedFirst = useMemo(() =>
    notRankedFirst.filter(hasSelectedLLMData),
    [notRankedFirst, selectedLLMs]
  );

  // Calculate filtered rankings from question data when single LLM selected
  const filteredRankings = useMemo(() => {
    if (bothSelected) {
      return null; // Use original rankings when both selected
    }

    const allQuestions = [...rankedFirst, ...notRankedFirst];
    const entityStats = new Map();
    let totalQuestionsWithData = 0;

    allQuestions.forEach(item => {
      // Get data from the selected LLM only
      const llmData = selectedLLMs.includes('gemini')
        ? item.llm_responses?.gemini
        : item.llm_responses?.openai;

      if (!llmData) return;
      totalQuestionsWithData++;

      // Process full ranking from this question
      const fullRanking = llmData.full_ranking || llmData.ranking || [];
      fullRanking.forEach(entry => {
        const name = entry.name;
        const rank = entry.rank;

        if (!entityStats.has(name)) {
          entityStats.set(name, {
            name,
            totalRank: 0,
            mentions: 0,
            rankOneMentions: 0
          });
        }

        const stats = entityStats.get(name);
        stats.mentions++;
        stats.totalRank += rank;
        if (rank === 1) {
          stats.rankOneMentions++;
        }
      });
    });

    if (totalQuestionsWithData === 0) {
      return [];
    }

    // Calculate metrics and sort
    const rankings = Array.from(entityStats.values()).map(stats => {
      const avgRank = stats.mentions > 0 ? stats.totalRank / stats.mentions : 10;
      const visibility = stats.mentions / totalQuestionsWithData;
      // SOV: weighted by inverse rank (rank 1 = 1, rank 2 = 0.5, etc.)
      const weightedScore = stats.mentions > 0
        ? stats.mentions / avgRank
        : 0;

      return {
        name: stats.name,
        average_rank: avgRank,
        mentions: stats.mentions,
        visibility: visibility,
        sov: visibility / avgRank, // Simple SOV based on visibility and position
        rank_one_count: stats.rankOneMentions
      };
    });

    // Sort by SOV descending
    rankings.sort((a, b) => b.sov - a.sov);

    // Normalize SOV to percentages (sum to ~100%)
    const totalSov = rankings.reduce((sum, r) => sum + r.sov, 0);
    if (totalSov > 0) {
      rankings.forEach(r => {
        r.sov = r.sov / totalSov;
      });
    }

    return rankings;
  }, [rankedFirst, notRankedFirst, selectedLLMs, bothSelected]);

  // Helper to toggle expanded state for a brand family
  const toggleFamily = (familyName) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(familyName)) {
        next.delete(familyName);
      } else {
        next.add(familyName);
      }
      return next;
    });
  };

  // Determine which ranking to display
  // When filtering by single LLM, use filteredRankings calculated from questions
  const displayRankings = useMemo(() => {
    if (!bothSelected && filteredRankings && filteredRankings.length > 0) {
      // Use recalculated rankings when single LLM selected
      return filteredRankings;
    }
    // Use brand family or raw rankings when both LLMs selected
    return (showBrandFamilies && brandFamilyRanking) ? brandFamilyRanking : rankings;
  }, [bothSelected, filteredRankings, showBrandFamilies, brandFamilyRanking, rankings]);

  // Find target entity in the DISPLAYED rankings (brand family or raw) to ensure consistency
  const targetInDisplayedRankings = useMemo(() => {
    if (bothSelected) {
      if (showBrandFamilies && brandFamilyRanking) {
        // In brand family mode, find by is_target_brand flag
        return brandFamilyRanking.find(r => r.is_target_brand);
      }
      // In raw mode, find by entity name
      return rankings.find(r => r.name.toLowerCase() === entity.toLowerCase());
    }
    // When single LLM selected, find in filtered rankings
    return displayRankings.find(r => r.name.toLowerCase() === entity.toLowerCase());
  }, [bothSelected, showBrandFamilies, brandFamilyRanking, rankings, displayRankings, entity]);

  // Use filtered metrics based on selected LLMs
  // If both LLMs selected, use combined data; otherwise use per-LLM data
  const visibilityPercent = bothSelected && targetInDisplayedRankings
    ? (targetInDisplayedRankings.visibility * 100)
    : (filteredMetrics.visibility * 100);
  const sovPercent = bothSelected && targetInDisplayedRankings
    ? (targetInDisplayedRankings.sov * 100)
    : (filteredMetrics.sov * 100);
  const avgPosition = bothSelected && targetInDisplayedRankings
    ? targetInDisplayedRankings.average_rank
    : filteredMetrics.avgPosition;

  // SOV Status - recalculate based on corrected SOV value
  const sovStatus = sovPercent > 50 ? 'Good' : sovPercent > 25 ? 'Fair' : 'Poor';
  const sovStatusColor = sovStatus === 'Good' ? '#4CAF50' :
                         sovStatus === 'Fair' ? '#FF9800' : '#EF5350';

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xl font-medium text-[#212121] mb-2">Visibility Analysis</h2>
        <p className="text-sm text-[#757575]">
          Brand visibility and competitive positioning in AI search results
        </p>
      </div>

      {/* Top Metrics Grid - 3 columns for summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Brand Visibility Card */}
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-5">
          <h3 className="text-base font-medium text-[#212121] mb-0.5">Brand Visibility</h3>
          <p className="text-xs text-[#757575] mb-4">Answers mentioning your brand</p>

          <div className="flex items-center gap-4">
            {/* Circular Progress */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="transform -rotate-90 w-20 h-20">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="#F5F5F5"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="#2196F3"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - visibilityPercent / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Eye className="w-5 h-5 text-[#2196F3]" />
              </div>
            </div>

            {/* Metrics */}
            <div>
              <div className="text-3xl font-light text-[#212121]">
                {visibilityPercent.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Average Position Card */}
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-5">
          <h3 className="text-base font-medium text-[#212121] mb-0.5">Average Position</h3>
          <p className="text-xs text-[#757575] mb-4">Typical rank in AI responses</p>

          <div className="flex items-center gap-4">
            {/* Circular Progress - Position based (1 is best, lower is better) */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="transform -rotate-90 w-20 h-20">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="#F5F5F5"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="#9C27B0"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (Math.min(avgPosition, 5) / 5)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#9C27B0]" />
              </div>
            </div>

            {/* Metrics */}
            <div>
              <div className="text-3xl font-light text-[#212121]">
                #{avgPosition.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Brand Share of Voice Card */}
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-5">
          <h3 className="text-base font-medium text-[#212121] mb-0.5">Share of Voice</h3>
          <p className="text-xs text-[#757575] mb-4">Visibility weighted by position</p>

          <div className="flex items-center gap-4">
            {/* Circular Progress */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="transform -rotate-90 w-20 h-20">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="#F5F5F5"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke={sovStatusColor}
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - sovPercent / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" style={{ color: sovStatusColor }} />
              </div>
            </div>

            {/* Metrics */}
            <div>
              <div className="text-3xl font-light text-[#212121]">
                {sovPercent.toFixed(0)}%
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: sovStatusColor }}
                />
                <span className="text-xs font-medium" style={{ color: sovStatusColor }}>
                  {sovStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Chart and Ranking */}
      {/* Entity Trends Chart - SOV and Position */}
      <EntityTrendsChart
        rankings={bothSelected ? rankings : (filteredRankings || rankings)}
        brandFamilyRanking={bothSelected ? brandFamilyRanking : null}
        entity={entity}
        showBrandFamilies={bothSelected ? showBrandFamilies : false}
        onToggleBrandFamilies={bothSelected ? setShowBrandFamilies : undefined}
        perMarketData={perMarketData}
        markets={markets}
      />

      {/* Brand Industry Ranking Table */}
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-medium text-[#212121]">Brand Industry Ranking</h3>
            {/* Toggle for Brand Families view */}
            {brandFamilyRanking && brandFamilyRanking.length > 0 && (
              <button
                onClick={() => setShowBrandFamilies(!showBrandFamilies)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  showBrandFamilies
                    ? 'bg-[#E3F2FD] text-[#1976D2]'
                    : 'bg-[#F5F5F5] text-[#757575] hover:bg-[#EEEEEE]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {showBrandFamilies ? 'Brand Families' : 'All Products'}
              </button>
            )}
          </div>
          <p className="text-sm text-[#757575] mb-4">
            {showBrandFamilies && brandFamilyRanking
              ? `Products grouped by parent brand (${brandGroupingMetadata?.total_brands || 0} brands, ${brandGroupingMetadata?.total_variants || 0} products)`
              : 'Complete brand performance metrics'}
          </p>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {displayRankings.slice(0, 10).map((competitor, index) => {
              const isTarget = showBrandFamilies && brandFamilyRanking
                ? competitor.is_target_brand
                : competitor.name.toLowerCase() === entity.toLowerCase();
              const sovValue = (competitor.sov * 100).toFixed(2);
              const visibilityValue = competitor.visibility !== undefined
                ? (competitor.visibility * 100).toFixed(2)
                : Math.min((competitor.mentions / (visibility.totalQuestions * 2)) * 100, 100).toFixed(2);

              // Check if this is a brand family with variants
              const hasVariants = showBrandFamilies && competitor.variants && competitor.variants.length > 1;
              const isExpanded = expandedFamilies.has(competitor.name);

              return (
                <div key={index}>
                  <div
                    className={`flex items-center gap-3 p-3 rounded-lg ${isTarget ? 'bg-[#E3F2FD]' : 'bg-[#F9FAFB]'} ${hasVariants ? 'cursor-pointer hover:bg-opacity-80' : ''}`}
                    onClick={hasVariants ? () => toggleFamily(competitor.name) : undefined}
                  >
                    {/* Rank Badge */}
                    <div className="flex items-center gap-2 min-w-[40px]">
                      {index === 0 && <Trophy className="w-5 h-5 text-[#FFA000]" />}
                      {index > 0 && <span className="text-sm font-medium text-[#757575]">{index + 1}</span>}
                    </div>

                    {/* Brand Logo with fallback */}
                    <div className="w-6 h-6 flex-shrink-0 relative">
                      <img
                        src={generateBrandLogoUrl(competitor.name)}
                        alt=""
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                      <div
                        className="w-6 h-6 rounded bg-[#E0E0E0] items-center justify-center text-xs font-medium text-[#757575]"
                        style={{ display: 'none' }}
                      >
                        {competitor.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    </div>

                    {/* Expand arrow (if has variants) - fixed width container */}
                    <div className="w-5 flex-shrink-0">
                      {hasVariants && (
                        <div className="flex items-center justify-center">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-[#757575]" />
                            : <ChevronRight className="w-4 h-4 text-[#757575]" />
                          }
                        </div>
                      )}
                    </div>

                    {/* Brand Name */}
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div className="text-sm font-medium text-[#212121] truncate">
                        {competitor.name}
                      </div>
                      {hasVariants && (
                        <span className="text-xs text-[#9E9E9E] flex-shrink-0">
                          ({competitor.variant_count} products)
                        </span>
                      )}
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-[#4CAF50]" />
                        <span className="text-[#757575]">{sovValue}%</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-[#757575]" />
                        <span className="text-[#757575]">{visibilityValue}%</span>
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-[#E0E0E0]">
                        <span className="text-xs font-medium text-[#212121]">
                          {competitor.average_rank.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded variants list */}
                  {hasVariants && isExpanded && (
                    <div className="ml-12 mt-1 space-y-1">
                      {competitor.variants.map((variant, vIndex) => (
                        <div
                          key={vIndex}
                          className="flex items-center gap-3 px-3 py-2 rounded bg-white border border-[#E8E8E8] text-xs"
                        >
                          <span className="text-[#9E9E9E] min-w-[20px]">•</span>
                          <span className="flex-1 text-[#424242] truncate">{variant.name}</span>
                          <div className="flex items-center gap-3 text-[#757575]">
                            <span>{(variant.sov * 100).toFixed(1)}%</span>
                            <span>{(variant.visibility * 100).toFixed(1)}%</span>
                            <span className="w-6 text-center">{variant.average_rank.toFixed(1)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      {/* Visibility Questions Table - Data Table with Side Panel */}
      <VisibilityQuestionsTable
        rankedFirst={rankedFirst}
        notRankedFirst={notRankedFirst}
        entity={entity}
        selectedLLMs={selectedLLMs}
        perMarketData={perMarketData}
        markets={markets}
      />

      {/* Source Analysis - Pie Chart and Domain List (last) */}
      {(data.source_analysis || data.full_sources_list || allSources.length > 0) && (
        <SourceAnalysis
          sourceAnalysis={data.source_analysis}
          sources={data.full_sources_list || allSources}
        />
      )}
    </div>
  );
}
