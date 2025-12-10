import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Highcharts from 'highcharts';
import { Loader, XCircle, Lock, BarChart3 } from 'lucide-react';

// Import navigation components
import PrimarySidebar from '../components/navigation/PrimarySidebar';

// Import analysis components
import ReputationAnalysis from '../components/analysis/ReputationAnalysis';
import VisibilityAnalysis from '../components/analysis/VisibilityAnalysis';
import CompetitiveAnalysis from '../components/analysis/CompetitiveAnalysis';
import OverviewTab from '../components/analysis/OverviewTab';
import { PRInsightsPanel } from '../components/analysis/insights';

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
        const primaryMarket = markets.find(m => m.isPrimary) || markets[0];
        if (primaryMarket) {
          setSelectedMarket(primaryMarket.code);
        }

        const marketResults = response.data.marketResults || {};
        const firstMarketResults = primaryMarket ? marketResults[primaryMarket.code] : null;
        const categoryFamilies = response.data.categoryFamilies || [];

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
    const currentMarketData = selectedMarket ? marketResults[selectedMarket] : null;

    if (!currentMarketData) {
      return { reputation: null, categoriesAssociated: null, categories: [] };
    }

    const categoryFamilies = report.categoryFamilies || [];
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
    if (!category || !selectedMarket) {
      return [];
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
      // For shared view, we pass the token instead of reportId
      // The OverviewTab needs to handle this - for now show a message
      return (
        <div className="p-8 text-center">
          <p className="text-[#757575]">Overview data is not available in shared view</p>
        </div>
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
      // PR Insights needs reportId for API calls - show message for shared view
      return (
        <div className="p-8 text-center">
          <p className="text-[#757575]">PR Insights are not available in shared view</p>
        </div>
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
          {/* Header Card */}
          <div className="card-base">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xxl font-bold text-[#212121] mb-2">{report.entity}</h1>
                {isMultiMarket ? (
                  <>
                    <p className="text-base text-[#757575]">
                      {report.categoryFamilies?.length || 0} categor{report.categoryFamilies?.length === 1 ? 'y' : 'ies'} across {report.markets?.length || 0} market{report.markets?.length === 1 ? '' : 's'}
                    </p>
                    {selectedMarket && (
                      <p className="text-sm text-[#9E9E9E] mt-1">
                        Viewing: {report.markets?.find(m => m.code === selectedMarket)?.country} ({report.markets?.find(m => m.code === selectedMarket)?.language})
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {report.category && (
                      <p className="text-base text-[#757575]">
                        Category: <span className="text-[#212121] font-medium">{report.category}</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="text-right">
                <p className="text-xs text-[#757575]">Generated</p>
                <p className="text-sm font-medium text-[#212121]">
                  {new Date(report.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Hierarchical Layout: Sidebar + Content */}
          <div className="flex gap-6">
            {/* Left Sidebar */}
            <aside className="w-60 flex-shrink-0">
              <PrimarySidebar
                activeView={activeView}
                onViewChange={setActiveView}
                categories={categories}
                hasReputation={!!reputationData}
                countries={report.countries}
                languages={report.languages}
                report={report}
                isMultiMarket={isMultiMarket}
                markets={report.markets || []}
                selectedMarket={selectedMarket}
                onMarketChange={setSelectedMarket}
                selectedLLMs={selectedLLMs}
                onLLMToggle={handleLLMToggle}
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
