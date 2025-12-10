import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getEventSourceUrl } from '../lib/api';
import Highcharts from 'highcharts';
import { ArrowLeft, Loader, CheckCircle, XCircle } from 'lucide-react';

// Import navigation components
import PrimarySidebar from '../components/navigation/PrimarySidebar';

// Import analysis components
import ReputationAnalysis from '../components/analysis/ReputationAnalysis';
import VisibilityAnalysis from '../components/analysis/VisibilityAnalysis';
import CompetitiveAnalysis from '../components/analysis/CompetitiveAnalysis';
import OverviewTab from '../components/analysis/OverviewTab';
import { PRInsightsPanel } from '../components/analysis/insights';

// Configure Highcharts defaults with Social Analytics colors
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

export default function ReportDetailPage() {
  const { reportId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [progressDetails, setProgressDetails] = useState({
    phase: 'starting',
    processedCount: 0,
    totalQuestions: 0,
    elapsedTime: 0
  });
  const [startTime] = useState(Date.now());

  // Hierarchical navigation state - unified view state
  const [activeView, setActiveView] = useState({
    type: 'reputation',
    categoryIndex: 0,
    subTab: 'visibility'
  });

  // Multi-market state
  const [selectedMarket, setSelectedMarket] = useState(null);

  // LLM filter state - both selected by default
  const [selectedLLMs, setSelectedLLMs] = useState(['gemini', 'openai']);

  // Toggle LLM selection (ensure at least one is always selected)
  const handleLLMToggle = (llmId) => {
    setSelectedLLMs(prev => {
      if (prev.includes(llmId)) {
        // Don't allow deselecting if it's the only one selected
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== llmId);
      } else {
        return [...prev, llmId];
      }
    });
  };

  useEffect(() => {
    fetchReport();
  }, [reportId]);

  const fetchReport = async () => {
    try {
      const response = await api.get(`/api/reports/${reportId}`);
      setReport(response.data);
      setProgress(response.data.progress || 0);

      // Handle multi-market vs legacy reports
      if (response.data.isMultiMarket) {
        // Set default selected market (primary or first)
        const markets = response.data.markets || [];
        const primaryMarket = markets.find(m => m.isPrimary) || markets[0];
        if (primaryMarket) {
          setSelectedMarket(primaryMarket.code);
        }

        // Auto-select first available view based on market results
        const marketResults = response.data.marketResults || {};
        const firstMarketResults = primaryMarket ? marketResults[primaryMarket.code] : null;
        const categoryFamilies = response.data.categoryFamilies || [];

        // Default to Overview if multiple markets OR multiple categories
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
        // Legacy single-market handling
        const results = response.data.analysisResults || {};

        // Default to Overview if multiple categories
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

      if (response.data.status === 'processing') {
        setupProgressTracking();
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const setupProgressTracking = () => {
    const eventSource = new EventSource(getEventSourceUrl(`/api/analysis/progress/${reportId}`));
    const trackingStartTime = Date.now();

    // Update elapsed time every second
    const timerInterval = setInterval(() => {
      setProgressDetails(prev => ({
        ...prev,
        elapsedTime: Math.round((Date.now() - trackingStartTime) / 1000)
      }));
    }, 1000);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'progress') {
        setProgress(data.progress);
        setProgressMessage(data.currentQuestion);
        setProgressDetails(prev => ({
          ...prev,
          phase: 'querying',
          processedCount: data.processedCount || prev.processedCount,
          totalQuestions: data.totalQuestions || prev.totalQuestions
        }));
      } else if (data.type === 'status') {
        // Phase transitions
        setProgress(data.progress);
        setProgressMessage(data.message || '');
        setProgressDetails(prev => ({
          ...prev,
          phase: data.status,
          processedCount: data.processedCount || prev.processedCount,
          totalQuestions: data.totalQuestions || prev.totalQuestions
        }));
      } else if (data.type === 'complete') {
        setProgress(100);
        setProgressMessage('Analysis complete!');
        setProgressDetails(prev => ({ ...prev, phase: 'completed' }));
        clearInterval(timerInterval);
        eventSource.close();
        setTimeout(fetchReport, 1000);
      } else if (data.type === 'error') {
        setProgressMessage(`Error: ${data.message}`);
        setProgressDetails(prev => ({ ...prev, phase: 'failed' }));
        clearInterval(timerInterval);
        eventSource.close();
        setTimeout(fetchReport, 1000);
      }
    };

    return () => {
      clearInterval(timerInterval);
      eventSource.close();
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-[#10B981]" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="card-base border-[#EF5350]">
        <div className="flex items-center">
          <XCircle className="w-5 h-5 text-[#EF5350] mr-3" />
          <p className="text-[#EF5350] font-medium">Report not found</p>
        </div>
      </div>
    );
  }

  // Helper to get phase display info
  const getPhaseInfo = (phase) => {
    const phases = {
      starting: { label: 'Starting', icon: '🚀', color: '#2196F3' },
      processing: { label: 'Querying LLMs', icon: '🤖', color: '#2196F3' },
      querying: { label: 'Querying LLMs', icon: '🤖', color: '#2196F3' },
      classifying: { label: 'Classifying Sources', icon: '🔍', color: '#FF9800' },
      aggregating: { label: 'Aggregating Results', icon: '📊', color: '#9C27B0' },
      insights: { label: 'Generating PR Insights', icon: '💡', color: '#4CAF50' },
      completed: { label: 'Complete', icon: '✅', color: '#4CAF50' },
      failed: { label: 'Failed', icon: '❌', color: '#EF5350' }
    };
    return phases[phase] || phases.starting;
  };

  // Format elapsed time
  const formatElapsedTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Processing state
  if (report.status === 'processing') {
    const phaseInfo = getPhaseInfo(progressDetails.phase);
    const { processedCount, totalQuestions, elapsedTime } = progressDetails;

    return (
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center text-[#2196F3] hover:text-[#1976D2] mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Reports
        </Link>

        <div className="card-base">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#E3F2FD] flex items-center justify-center mx-auto mb-4">
              <Loader className="w-8 h-8 animate-spin text-[#2196F3]" />
            </div>
            <h2 className="text-xxl font-bold text-[#212121] mb-2">Analyzing {report.entity}</h2>
            <p className="text-[#757575]">This usually takes 65-70 seconds</p>
          </div>

          {/* Phase indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-xl">{phaseInfo.icon}</span>
            <span
              className="font-semibold text-sm px-3 py-1 rounded-full"
              style={{ backgroundColor: `${phaseInfo.color}20`, color: phaseInfo.color }}
            >
              {phaseInfo.label}
            </span>
            <span className="text-sm text-[#757575] ml-2">
              {formatElapsedTime(elapsedTime)}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-[#757575] mb-2">
              <span>
                {totalQuestions > 0 && (
                  <span className="font-medium text-[#212121]">
                    {processedCount}/{totalQuestions} questions
                  </span>
                )}
                {totalQuestions === 0 && <span>Progress</span>}
              </span>
              <span className="font-medium text-[#212121]">{progress}%</span>
            </div>
            <div className="w-full bg-[#E0E0E0] rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, backgroundColor: phaseInfo.color }}
              />
            </div>
          </div>

          {/* Phase breakdown steps */}
          <div className="flex justify-between text-xs text-[#9E9E9E] mb-4 px-1">
            <span className={progressDetails.phase === 'querying' || progressDetails.phase === 'processing' ? 'text-[#2196F3] font-medium' : ''}>
              LLMs (0-70%)
            </span>
            <span className={progressDetails.phase === 'classifying' ? 'text-[#FF9800] font-medium' : ''}>
              Sources (75%)
            </span>
            <span className={progressDetails.phase === 'aggregating' ? 'text-[#9C27B0] font-medium' : ''}>
              Aggregate (85%)
            </span>
            <span className={progressDetails.phase === 'insights' ? 'text-[#4CAF50] font-medium' : ''}>
              Insights (95%)
            </span>
          </div>

          {progressMessage && (
            <div className="ai-summary">
              <div className="flex items-start">
                <p className="text-sm text-[#757575] italic truncate">{progressMessage}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Failed state
  if (report.status === 'failed') {
    return (
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center text-[#2196F3] hover:text-[#1976D2] mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Reports
        </Link>

        <div className="card-base border-[#EF5350]">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#FFEBEE] flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-[#EF5350]" />
            </div>
            <h2 className="text-xxl font-bold text-[#212121] mb-2">Analysis Failed</h2>
            <p className="text-[#757575] mb-6">{report.error_message || 'Unknown error occurred'}</p>
            <Link to="/new" className="btn-primary">
              Create New Report
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Completed state - extract data based on report type
  const isMultiMarket = report.isMultiMarket;

  // Get current market's data for multi-market reports
  const getMarketData = () => {
    if (!isMultiMarket) {
      // Legacy single-market format
      const analysisResults = report.analysisResults || {};
      return {
        reputation: analysisResults.reputation || null,
        categoriesAssociated: analysisResults.categories_associated || null,
        categories: analysisResults.categories || []
      };
    }

    // Multi-market format - get data for selected market
    const marketResults = report.marketResults || {};
    const currentMarketData = selectedMarket ? marketResults[selectedMarket] : null;

    if (!currentMarketData) {
      return { reputation: null, categoriesAssociated: null, categories: [] };
    }

    // Transform market categories from object format to array format
    const categoryFamilies = report.categoryFamilies || [];
    const categories = categoryFamilies.map((family, idx) => {
      const catData = currentMarketData.categories?.[family.id] || {};
      // Get the translated name for this market or fallback to canonical
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
      categoriesAssociated: null, // Not used in multi-market
      categories
    };
  };

  const { reputation: reputationData, categoriesAssociated, categories } = getMarketData();

  // Get competitors for current market and category (for multi-market)
  const getCurrentCompetitors = (categoryIndex) => {
    if (!isMultiMarket) {
      return report.competitors || [];
    }

    // Get competitors from multi-market structure
    const categoryFamilies = report.categoryFamilies || [];
    const category = categoryFamilies[categoryIndex];
    if (!category || !selectedMarket) {
      return [];
    }

    return report.competitors?.[category.id]?.[selectedMarket] || [];
  };

  // Get categoriesAssociated - prefer real category detection data from analysis
  const getCategoriesAssociated = () => {
    if (!isMultiMarket) {
      return categoriesAssociated; // Use legacy data for single-market
    }

    // Get categories_associated from market results (from category detection questions)
    const marketResults = report.marketResults || {};
    const currentMarketData = selectedMarket ? marketResults[selectedMarket] : null;

    if (currentMarketData?.categories_associated) {
      // Use the real categories_associated from category detection analysis
      return currentMarketData.categories_associated;
    }

    // Fallback: Build from visibility data if categories_associated not available
    if (categories.length === 0) {
      return null;
    }

    const builtCategories = categories.map(cat => {
      const visData = cat.visibility;

      // Get visibility metrics from the nested visibility object
      const visibilityMetrics = visData?.visibility || {};

      // Get top competitors from brand_family_ranking or entities_ranking
      const competitors = visData?.brand_family_ranking || visData?.entities_ranking || [];
      const topCompetitors = competitors
        .filter(comp => !comp.is_target_brand) // Exclude target entity
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

  // Content rendering logic
  const renderActiveContent = () => {
    if (activeView.type === 'overview') {
      return <OverviewTab reportId={reportId} entity={report.entity} />;
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
          <div className="card-base p-8 text-center">
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
      return <PRInsightsPanel reportId={reportId} entity={report.entity} />;
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center text-[#2196F3] hover:text-[#1976D2] transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Reports
        </Link>

        <span className="inline-flex items-center px-4 py-2 rounded bg-[#E8F5E9] text-[#4CAF50] font-medium text-sm">
          <CheckCircle className="w-4 h-4 mr-2" />
          Completed in {report.execution_time}s
        </span>
      </div>

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
                {report.competitors && report.competitors.length > 0 && (
                  <p className="text-sm text-[#9E9E9E] mt-1">
                    Competitors: {report.competitors.join(', ')}
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
        {/* Left Sidebar - 240px width */}
        <aside className="w-60 flex-shrink-0">
          <PrimarySidebar
            activeView={activeView}
            onViewChange={setActiveView}
            categories={categories}
            hasReputation={!!reputationData}
            countries={report.countries}
            languages={report.languages}
            report={report}
            // Multi-market props
            isMultiMarket={isMultiMarket}
            markets={report.markets || []}
            selectedMarket={selectedMarket}
            onMarketChange={setSelectedMarket}
            // LLM filter props
            selectedLLMs={selectedLLMs}
            onLLMToggle={handleLLMToggle}
          />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {/* Content */}
          <div className="card-base">
            {renderActiveContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
