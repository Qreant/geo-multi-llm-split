import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Highcharts from 'highcharts';
import { Loader, XCircle, Lock, BarChart3, Lightbulb, Sparkles, MessageSquare } from 'lucide-react';

// Import navigation components
import PrimarySidebar from '../components/navigation/PrimarySidebar';

// Import analysis components
import ReputationAnalysis from '../components/analysis/ReputationAnalysis';
import VisibilityAnalysis from '../components/analysis/VisibilityAnalysis';
import CompetitiveAnalysis from '../components/analysis/CompetitiveAnalysis';
import OverviewTab from '../components/analysis/OverviewTab';
import { PRInsightsPanel } from '../components/analysis/insights';

/**
 * Generate logo URL for a brand/entity name using Google's favicon service
 */
function generateBrandLogoUrl(brandName) {
  if (!brandName) return null;

  const cleanName = brandName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .trim();

  return `https://www.google.com/s2/favicons?domain=${cleanName}.com&sz=128`;
}

// Configure Highcharts defaults
Highcharts.setOptions({
  colors: ['#10B981', '#2196F3', '#EF5350', '#9E9E9E', '#4CAF50', '#FF9800'],
  chart: {
    style: {
      fontFamily: 'Roboto, Helvetica Neue, Arial, sans-serif'
    }
  },
  title: {
    style: {
      color: '#212121',
      fontSize: '18px',
      fontWeight: 'bold'
    }
  }
});

export default function SharedReportPage() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Hierarchical navigation state
  const [activeView, setActiveView] = useState({
    type: 'reputation',
    categoryIndex: 0,
    subTab: 'visibility'
  });

  // Multi-market state
  const [selectedMarket, setSelectedMarket] = useState(null);

  // LLM filter state
  const [selectedLLMs, setSelectedLLMs] = useState(['gemini', 'openai']);

  const handleLLMToggle = (llmId) => {
    setSelectedLLMs(prev => {
      if (prev.includes(llmId)) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== llmId);
      } else {
        return [...prev, llmId];
      }
    });
  };

  useEffect(() => {
    fetchSharedReport();
  }, [token]);

  const fetchSharedReport = async () => {
    try {
      const response = await api.get(`/api/reports/shared/${token}`);
      setReport(response.data);

      // Handle multi-market vs legacy reports
      if (response.data.isMultiMarket) {
        const markets = response.data.markets || [];
        const marketResults = response.data.marketResults || {};
        const primaryMarket = markets.find(m => m.isPrimary) || markets[0];
        const firstMarketResults = primaryMarket ? marketResults[primaryMarket.code] : null;
        const categoryFamilies = response.data.categoryFamilies || [];

        // Set default selected market: single market = that market, multiple = master
        if (markets.length === 1) {
          setSelectedMarket(markets[0].code);
        } else {
          setSelectedMarket('master');
        }

        if (markets.length > 1 || categoryFamilies.length > 1) {
          setActiveView({ type: 'overview' });
        } else if (firstMarketResults?.reputation) {
          setActiveView({ type: 'reputation' });
        } else if (firstMarketResults?.categories && Object.keys(firstMarketResults.categories).length > 0) {
          setActiveView({ type: 'category', categoryIndex: 0, subTab: 'visibility' });
        } else {
          setActiveView({ type: 'insights' });
        }
      } else {
        const results = response.data.analysisResults || {};

        if (results.categories && results.categories.length > 1) {
          setActiveView({ type: 'overview' });
        } else if (results.reputation) {
          setActiveView({ type: 'reputation' });
        } else if (results.categories && results.categories.length > 0) {
          setActiveView({ type: 'category', categoryIndex: 0, subTab: 'visibility' });
        } else {
          setActiveView({ type: 'insights' });
        }
      }
    } catch (err) {
      console.error('Error fetching shared report:', err);
      setError(err.response?.data?.error || 'Failed to load shared report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-[#10B981] mx-auto mb-4" />
          <p className="text-[#757575]">Loading shared report...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center">
        <div className="card-base max-w-md mx-4 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FFEBEE] flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-[#EF5350]" />
          </div>
          <h2 className="text-xl font-bold text-[#212121] mb-2">Report Not Found</h2>
          <p className="text-[#757575]">
            {error || 'This shared report link is invalid or has expired.'}
          </p>
        </div>
      </div>
    );
  }

  // Extract data based on report type
  const isMultiMarket = report.isMultiMarket;

  // Helper function to merge entity rankings from multiple markets
  const mergeEntityRankings = (rankingsArrays) => {
    const entityMap = new Map();
    rankingsArrays.flat().forEach(entity => {
      const key = entity.name?.toLowerCase();
      if (!key) return;
      if (entityMap.has(key)) {
        const existing = entityMap.get(key);
        existing.visibility = ((existing.visibility || 0) + (entity.visibility || 0)) / 2;
        existing.sov = ((existing.sov || 0) + (entity.sov || 0)) / 2;
        existing.average_rank = ((existing.average_rank || 0) + (entity.average_rank || 0)) / 2;
        existing.mentions = (existing.mentions || 0) + (entity.mentions || 0);
      } else {
        entityMap.set(key, { ...entity });
      }
    });
    return Array.from(entityMap.values()).sort((a, b) => (b.sov || 0) - (a.sov || 0));
  };

  // Helper function to merge brand family rankings from multiple markets
  const mergeBrandFamilyRankings = (rankingsArrays) => {
    const brandMap = new Map();
    rankingsArrays.flat().forEach(brand => {
      const key = brand.name?.toLowerCase();
      if (!key) return;
      if (brandMap.has(key)) {
        const existing = brandMap.get(key);
        existing.visibility = ((existing.visibility || 0) + (brand.visibility || 0)) / 2;
        existing.sov = ((existing.sov || 0) + (brand.sov || 0)) / 2;
        existing.average_rank = ((existing.average_rank || 0) + (brand.average_rank || 0)) / 2;
        existing.mentions = (existing.mentions || 0) + (brand.mentions || 0);
      } else {
        brandMap.set(key, { ...brand });
      }
    });
    return Array.from(brandMap.values()).sort((a, b) => (b.sov || 0) - (a.sov || 0));
  };

  // Helper function to merge LLM performance data from multiple markets
  const mergeLLMPerformance = (performanceArrays) => {
    const llmMap = new Map();
    performanceArrays.flat().forEach(perf => {
      const llm = perf.llm;
      if (!llm) return;
      if (llmMap.has(llm)) {
        const existing = llmMap.get(llm);
        existing.visibility = ((existing.visibility || 0) + (perf.visibility || 0)) / 2;
        existing.sov = ((existing.sov || 0) + (perf.sov || 0)) / 2;
        existing.avgPosition = ((existing.avgPosition || 0) + (perf.avgPosition || 0)) / 2;
        existing.mentions = (existing.mentions || 0) + (perf.mentions || 0);
        existing.totalQuestions = (existing.totalQuestions || 0) + (perf.totalQuestions || 0);
      } else {
        llmMap.set(llm, { ...perf });
      }
    });
    return Array.from(llmMap.values());
  };

  const getMarketData = () => {
    if (!isMultiMarket) {
      const analysisResults = report.analysisResults || {};
      return {
        reputation: analysisResults.reputation || null,
        categoriesAssociated: analysisResults.categories_associated || null,
        categories: analysisResults.categories || []
      };
    }

    const marketResults = report.marketResults || {};
    const categoryFamilies = report.categoryFamilies || [];

    // Master mode: aggregate data across all markets
    if (selectedMarket === 'master') {
      const allMarkets = report.markets || [];

      // Aggregate reputation data from all markets
      const allReputations = allMarkets
        .map(m => marketResults[m.code]?.reputation)
        .filter(Boolean);

      let aggregatedReputation = null;
      if (allReputations.length > 0) {
        aggregatedReputation = allReputations[0]; // Simplified for shared view
      }

      // Aggregate categories across all markets
      const aggregatedCategories = categoryFamilies.map((family) => {
        const categoryDataFromAllMarkets = allMarkets
          .map(m => marketResults[m.code]?.categories?.[family.id])
          .filter(Boolean);

        // Aggregate visibility data across all markets
        let aggregatedVisibility = null;
        const visibilityDataList = categoryDataFromAllMarkets.map(c => c.visibility).filter(Boolean);
        if (visibilityDataList.length > 0) {
          const avgMetrics = {
            visibility: visibilityDataList.reduce((sum, v) => sum + (v.visibility?.visibility || 0), 0) / visibilityDataList.length,
            sov: visibilityDataList.reduce((sum, v) => sum + (v.visibility?.sov || 0), 0) / visibilityDataList.length,
            averagePosition: visibilityDataList.reduce((sum, v) => sum + (v.visibility?.averagePosition || 0), 0) / visibilityDataList.length,
            mentions: visibilityDataList.reduce((sum, v) => sum + (v.visibility?.mentions || 0), 0),
            totalQuestions: visibilityDataList.reduce((sum, v) => sum + (v.visibility?.totalQuestions || 0), 0)
          };
          aggregatedVisibility = {
            ...visibilityDataList[0],
            visibility: avgMetrics,
            // Merge all question arrays from all markets
            ranked_first_questions: visibilityDataList.flatMap(v => v.ranked_first_questions || []),
            not_ranked_first_questions: visibilityDataList.flatMap(v => v.not_ranked_first_questions || []),
            entities_ranking: mergeEntityRankings(visibilityDataList.map(v => v.entities_ranking || [])),
            brand_family_ranking: mergeBrandFamilyRankings(visibilityDataList.map(v => v.brand_family_ranking || [])),
            llm_performance: mergeLLMPerformance(visibilityDataList.map(v => v.llm_performance || []))
          };
        }

        // Aggregate competitive data across all markets
        let aggregatedCompetitive = null;
        const competitiveDataList = categoryDataFromAllMarkets.map(c => c.competitive).filter(Boolean);
        if (competitiveDataList.length > 0) {
          aggregatedCompetitive = {
            ...competitiveDataList[0],
            // Merge all question arrays from all markets
            ranked_first_questions: competitiveDataList.flatMap(c => c.ranked_first_questions || []),
            not_ranked_first_questions: competitiveDataList.flatMap(c => c.not_ranked_first_questions || []),
            missed_opportunities: competitiveDataList.flatMap(c => c.missed_opportunities || []),
            competitive_llm_performance: mergeLLMPerformance(competitiveDataList.map(c => c.competitive_llm_performance || []))
          };
        }

        return {
          id: family.id,
          name: family.canonical_name,
          visibility: aggregatedVisibility,
          competitive: aggregatedCompetitive
        };
      });

      return {
        reputation: aggregatedReputation,
        categoriesAssociated: null,
        categories: aggregatedCategories
      };
    }

    // Single market mode
    const currentMarketData = selectedMarket ? marketResults[selectedMarket] : null;

    if (!currentMarketData) {
      return { reputation: null, categoriesAssociated: null, categories: [] };
    }

    const categories = categoryFamilies.map((family) => {
      const catData = currentMarketData.categories?.[family.id] || {};
      const translatedName = family.translations?.[selectedMarket]?.name || family.canonical_name;
      return {
        id: family.id,
        name: translatedName,
        visibility: catData.visibility || null,
        competitive: catData.competitive || null
      };
    });

    return {
      reputation: currentMarketData.reputation || null,
      categoriesAssociated: null,
      categories
    };
  };

  const { reputation: reputationData, categoriesAssociated, categories } = getMarketData();

  const getCurrentCompetitors = (categoryIndex) => {
    if (!isMultiMarket) {
      return report.competitors || [];
    }

    const categoryFamilies = report.categoryFamilies || [];
    const category = categoryFamilies[categoryIndex];
    if (!category) {
      return [];
    }

    // Master mode: aggregate competitors from all markets
    if (selectedMarket === 'master') {
      const allMarkets = report.markets || [];
      const allCompetitors = new Set();
      allMarkets.forEach(market => {
        const marketCompetitors = report.competitors?.[category.id]?.[market.code] || [];
        marketCompetitors.forEach(c => allCompetitors.add(c));
      });
      return Array.from(allCompetitors);
    }

    return report.competitors?.[category.id]?.[selectedMarket] || [];
  };

  const getCategoriesAssociated = () => {
    if (!isMultiMarket) {
      return categoriesAssociated;
    }

    const marketResults = report.marketResults || {};
    const currentMarketData = selectedMarket ? marketResults[selectedMarket] : null;

    if (currentMarketData?.categories_associated) {
      return currentMarketData.categories_associated;
    }

    if (categories.length === 0) {
      return null;
    }

    const builtCategories = categories.map(cat => {
      const visData = cat.visibility;
      const visibilityMetrics = visData?.visibility || {};
      const competitors = visData?.brand_family_ranking || visData?.entities_ranking || [];
      const topCompetitors = competitors
        .filter(comp => !comp.is_target_brand)
        .slice(0, 5)
        .map(comp => ({
          name: comp.name,
          average_rank: comp.average_rank,
          sov: comp.sov
        }));

      return {
        name: cat.name,
        category_visibility: visibilityMetrics.visibility || 0,
        category_sov: visibilityMetrics.sov || 0,
        average_position: visibilityMetrics.averagePosition || null,
        mentions: visibilityMetrics.mentions || 0,
        comment: visData?.summary || '',
        top_competitors: topCompetitors
      };
    });

    return { categories: builtCategories };
  };

  const renderActiveContent = () => {
    if (activeView.type === 'overview') {
      // Use the OverviewTab component - it will fetch its own data using the report ID
      if (!report.id) {
        return (
          <div className="p-8 text-center">
            <p className="text-[#757575]">Overview not available</p>
          </div>
        );
      }
      return (
        <OverviewTab
          reportId={report.id}
          entity={report.entity}
          selectedMarket={selectedMarket}
          selectedLLMs={selectedLLMs}
        />
      );
    }

    if (activeView.type === 'reputation') {
      const categoriesForReputation = getCategoriesAssociated();
      return (
        <ReputationAnalysis
          data={reputationData}
          entity={report.entity}
          categoriesAssociated={categoriesForReputation}
          selectedLLMs={selectedLLMs}
        />
      );
    }

    if (activeView.type === 'category') {
      if (categories.length === 0) {
        return (
          <div className="p-8 text-center">
            <p className="text-[#757575]">No category data available</p>
          </div>
        );
      }

      const categoryIndex = activeView.categoryIndex || 0;
      const category = categories[categoryIndex];

      if (activeView.subTab === 'visibility') {
        return (
          <VisibilityAnalysis
            data={category.visibility}
            category={category.name}
            entity={report.entity}
            allSources={report.sources}
            selectedLLMs={selectedLLMs}
          />
        );
      }

      if (activeView.subTab === 'competitive') {
        return (
          <CompetitiveAnalysis
            data={category.competitive}
            category={category.name}
            entity={report.entity}
            competitors={getCurrentCompetitors(categoryIndex)}
            allSources={report.sources}
            selectedLLMs={selectedLLMs}
          />
        );
      }
    }

    if (activeView.type === 'insights') {
      // Use the PRInsightsPanel component - it will fetch its own data using the report ID
      if (!report.id) {
        return (
          <div className="p-8 text-center">
            <Lightbulb className="w-12 h-12 text-[#E0E0E0] mx-auto mb-4" />
            <p className="text-[#757575]">PR Insights not available</p>
          </div>
        );
      }
      return (
        <PRInsightsPanel
          reportId={report.id}
          entity={report.entity}
          selectedMarket={selectedMarket}
          selectedLLMs={selectedLLMs}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      {/* Shared Report Header */}
      <header className="bg-white border-b border-[#E0E0E0]" style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#10B981] rounded-md flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#212121]">
                  GEO Multi-LLM Analysis
                </h1>
                <p className="text-xs text-[#757575]">Shared Report View</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F4F6F8] rounded-full text-sm text-[#757575]">
              <Lock className="w-4 h-4" />
              Read-only
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Sticky Header Card with Filters */}
          <div className="sticky top-0 z-20 bg-[#F5F5F5] pb-4 -mx-6 px-6 pt-2 -mt-2">
            <div className="card-base">
              <div className="flex items-center justify-between">
                {/* Left: Entity Info */}
                <div className="flex items-center gap-4">
                  {/* Brand Logo */}
                  {generateBrandLogoUrl(report.entity) && (
                    <img
                      src={generateBrandLogoUrl(report.entity)}
                      alt={`${report.entity} logo`}
                      className="w-10 h-10 object-contain rounded-lg"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-[#212121]">{report.entity}</h1>
                    <p className="text-sm text-[#757575]">
                      {isMultiMarket ? (
                        <>{report.categoryFamilies?.length || 0} categor{report.categoryFamilies?.length === 1 ? 'y' : 'ies'} across {report.markets?.length || 0} market{report.markets?.length === 1 ? '' : 's'}</>
                      ) : (
                        report.category && (
                          <>Category: <span className="text-[#212121] font-medium">{report.category}</span></>
                        )
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Filters */}
                <div className="flex items-center gap-4">
                  {/* Market Selector */}
                  {isMultiMarket && report.markets && report.markets.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#9E9E9E] uppercase">Market</span>
                      <select
                        value={selectedMarket || 'master'}
                        onChange={(e) => setSelectedMarket(e.target.value)}
                        className="appearance-none bg-white border border-[#E0E0E0] rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-[#212121] cursor-pointer hover:border-[#2196F3] focus:outline-none focus:ring-2 focus:ring-[#2196F3]/20 focus:border-[#2196F3] transition-colors"
                      >
                        <option value="master">Master (All Markets)</option>
                        {report.markets.map((market) => (
                          <option key={market.code} value={market.code}>
                            {market.country} ({market.language}){market.isPrimary ? ' ★' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Divider */}
                  {isMultiMarket && <div className="w-px h-8 bg-[#E0E0E0]" />}

                  {/* LLM Toggle Buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#9E9E9E] uppercase">Source</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleLLMToggle('gemini')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          selectedLLMs.includes('gemini')
                            ? 'bg-[#E8F0FE] text-[#4285F4]'
                            : 'bg-[#F5F5F5] text-[#9E9E9E] hover:bg-[#EEEEEE]'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Gemini
                      </button>
                      <button
                        onClick={() => handleLLMToggle('openai')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          selectedLLMs.includes('openai')
                            ? 'bg-[#E6F4F1] text-[#10A37F]'
                            : 'bg-[#F5F5F5] text-[#9E9E9E] hover:bg-[#EEEEEE]'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        ChatGPT
                      </button>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-8 bg-[#E0E0E0]" />

                  {/* Generated Date */}
                  <div className="text-right">
                    <p className="text-xs text-[#9E9E9E]">Generated</p>
                    <p className="text-sm font-medium text-[#212121]">
                      {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hierarchical Layout: Sidebar + Content */}
          <div className="flex gap-4">
            {/* Left Sidebar - 260px width */}
            <aside className="w-[260px] flex-shrink-0">
              <PrimarySidebar
                activeView={activeView}
                onViewChange={setActiveView}
                categories={categories}
                hasReputation={!!reputationData}
                countries={report.countries}
                languages={report.languages}
                report={report}
                isMultiMarket={isMultiMarket}
                isSharedView={true}
              />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0">
              <div className="card-base">
                {renderActiveContent()}
              </div>
            </main>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E0E0E0] mt-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#757575]">
              GEO Multi-LLM Brand Analysis - Shared Report
            </p>
            <p className="text-xs text-[#9E9E9E]">
              Powered by Gemini 2.0 & OpenAI GPT-4
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
