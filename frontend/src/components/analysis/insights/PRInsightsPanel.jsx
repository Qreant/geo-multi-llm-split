import PropTypes from 'prop-types';
import { useState, useEffect, useMemo } from 'react';
import { History, RefreshCw, Lightbulb, Globe, MessageSquare, Eye, Swords } from 'lucide-react';
import PrioritySummary from './PrioritySummary';
import OpportunityCard from './OpportunityCard';
import ExecutionHistorySidebar from './ExecutionHistorySidebar';
import PrioritySourceTargets from './PrioritySourceTargets';
import OwnedMediaAnalysis from './OwnedMediaAnalysis';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Extract domain from URL if domain field is empty
 */
function extractDomain(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Process opportunities to ensure sources have valid domains
 */
function processOpportunities(opportunities) {
  if (!opportunities) return [];

  return opportunities.map(opp => ({
    ...opp,
    sources: (opp.sources || []).map(source => ({
      ...source,
      domain: source.domain || extractDomain(source.url)
    }))
  }));
}

/**
 * PRInsightsPanel Component
 * Main container for PR Insights and Recommendations with category tabs
 */
export default function PRInsightsPanel({ reportId, entity }) {
  const [insights, setInsights] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('panorama');
  const [priorityFilter, setPriorityFilter] = useState(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Tab configuration
  const tabs = [
    { id: 'panorama', label: 'Panorama', icon: Globe, description: 'Priority sources to target' },
    { id: 'reputation', label: 'Reputation', icon: MessageSquare, description: 'Reputation issues' },
    { id: 'visibility', label: 'Visibility', icon: Eye, description: 'AI search visibility gaps' },
    { id: 'competitive', label: 'Competitive', icon: Swords, description: 'Competitive positioning' }
  ];

  // Fetch insights data
  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE}/api/insights/${reportId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch insights');
        }

        const data = await response.json();
        // Process opportunities to fix source domains
        const processedInsights = {
          ...data.insights,
          opportunities: processOpportunities(data.insights?.opportunities)
        };
        setInsights(processedInsights);
        setExecutionHistory(data.executionHistory || []);
      } catch (err) {
        console.error('Error fetching insights:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (reportId) {
      fetchInsights();
    }
  }, [reportId]);

  // Handle marking opportunity as implemented
  const handleImplement = async (opportunityId) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/insights/${reportId}/opportunities/${opportunityId}/implement`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: 'Marked as implemented via UI' })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to mark as implemented');
      }

      // Update local state
      setInsights(prev => ({
        ...prev,
        opportunities: prev.opportunities.map(opp =>
          opp.id === opportunityId
            ? { ...opp, is_implemented: 1, implemented_at: new Date().toISOString() }
            : opp
        ),
        implemented_count: prev.implemented_count + 1,
        pending_count: prev.pending_count - 1
      }));

      // Refresh history
      const historyResponse = await fetch(`${API_BASE}/api/insights/${reportId}/history`);
      const historyData = await historyResponse.json();
      setExecutionHistory(historyData.history || []);
    } catch (err) {
      console.error('Error implementing opportunity:', err);
      alert('Failed to mark opportunity as implemented');
    }
  };

  // Categorize opportunities by type
  const categorizedOpportunities = useMemo(() => {
    const opps = insights?.opportunities || [];
    return {
      reputation: opps.filter(o => o.opportunity_type === 'Reputation Issue'),
      visibility: opps.filter(o => o.opportunity_type === 'AI Visibility Gap'),
      competitive: opps.filter(o => o.opportunity_type === 'Competitive Positioning Gap')
    };
  }, [insights?.opportunities]);

  // Get counts for each category
  const categoryCounts = useMemo(() => ({
    reputation: categorizedOpportunities.reputation.length,
    visibility: categorizedOpportunities.visibility.length,
    competitive: categorizedOpportunities.competitive.length
  }), [categorizedOpportunities]);

  // Filter opportunities based on active tab and priority
  const filteredOpportunities = useMemo(() => {
    let opps = [];

    if (activeTab === 'panorama') {
      opps = insights?.opportunities || [];
    } else if (activeTab === 'reputation') {
      opps = categorizedOpportunities.reputation;
    } else if (activeTab === 'visibility') {
      opps = categorizedOpportunities.visibility;
    } else if (activeTab === 'competitive') {
      opps = categorizedOpportunities.competitive;
    }

    if (priorityFilter) {
      opps = opps.filter(o => o.priority?.tier === priorityFilter);
    }

    return opps;
  }, [activeTab, insights?.opportunities, categorizedOpportunities, priorityFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-[#1976D2] animate-spin" />
        <span className="ml-3 text-[#757575]">Loading insights...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#E3F2FD] rounded-lg">
            <Lightbulb className="w-6 h-6 text-[#1976D2]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#212121]">
              PR Insights & Recommendations
            </h2>
            <p className="text-sm text-[#757575]">
              {insights?.total_opportunities || 0} opportunities identified for {entity}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 px-4 py-2 border border-[#E0E0E0] rounded-lg hover:bg-[#F5F5F5] transition-colors"
        >
          <History className="w-4 h-4 text-[#757575]" />
          <span className="text-sm text-[#424242]">Execution History</span>
          {executionHistory.length > 0 && (
            <span className="bg-[#1976D2] text-white text-xs px-2 py-0.5 rounded-full">
              {executionHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* Category Tabs */}
      <div className="bg-white border border-[#E0E0E0] rounded-lg">
        <div className="flex border-b border-[#E0E0E0]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const count = tab.id === 'panorama'
              ? insights?.total_opportunities || 0
              : categoryCounts[tab.id] || 0;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setPriorityFilter(null);
                }}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium
                  border-b-2 transition-colors
                  ${isActive
                    ? 'border-[#1976D2] text-[#1976D2] bg-[#E3F2FD] bg-opacity-30'
                    : 'border-transparent text-[#757575] hover:text-[#424242] hover:bg-[#F5F5F5]'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className={`
                  text-xs px-2 py-0.5 rounded-full
                  ${isActive ? 'bg-[#1976D2] text-white' : 'bg-[#E0E0E0] text-[#757575]'}
                `}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Panorama Tab - Shows Priority Source Targets */}
          {activeTab === 'panorama' && (
            <div className="space-y-6">
              {/* Owned Media Analysis Alert */}
              {insights?.owned_media_analysis && (
                <OwnedMediaAnalysis
                  analysis={insights.owned_media_analysis}
                  entity={entity}
                />
              )}

              {/* Priority Summary - Source Target focused for Panorama */}
              <PrioritySummary
                summary={insights?.priority_summary}
                sourceTargets={insights?.priority_source_targets}
                activeFilter={priorityFilter}
                onFilterChange={setPriorityFilter}
                useSourceTargets={true}
              />

              {/* Priority Source Targets - Main focus of Panorama */}
              {insights?.priority_source_targets && (
                <PrioritySourceTargets sourceTargets={insights.priority_source_targets} />
              )}
            </div>
          )}

          {/* Category Tabs - Reputation, Visibility, Competitive */}
          {activeTab !== 'panorama' && (
            <div className="space-y-6">
              {/* Priority Filter - Use source targets mode for consistency */}
              <PrioritySummary
                summary={insights?.priority_summary}
                sourceTargets={insights?.priority_source_targets}
                activeFilter={priorityFilter}
                onFilterChange={setPriorityFilter}
                useSourceTargets={true}
              />

              {/* Opportunity Cards */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-medium text-[#212121]">
                    {tabs.find(t => t.id === activeTab)?.label} Opportunities
                    {priorityFilter && (
                      <span className="ml-2 text-sm font-normal text-[#757575]">
                        - {priorityFilter}
                      </span>
                    )}
                  </h3>
                  <span className="text-sm text-[#757575]">
                    {filteredOpportunities.length} {filteredOpportunities.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {filteredOpportunities.length > 0 ? (
                  <div className="space-y-4">
                    {filteredOpportunities.map(opportunity => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        isSelected={selectedOpportunityId === opportunity.id}
                        onSelect={setSelectedOpportunityId}
                        onImplement={handleImplement}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#F5F5F5] rounded-lg p-8 text-center">
                    <p className="text-[#757575]">
                      {priorityFilter
                        ? `No ${priorityFilter} opportunities found in this category`
                        : `No ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()} opportunities identified`}
                    </p>
                    {priorityFilter && (
                      <button
                        onClick={() => setPriorityFilter(null)}
                        className="mt-2 text-sm text-[#1976D2] hover:underline"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Execution History Sidebar */}
      <ExecutionHistorySidebar
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        history={executionHistory}
      />
    </div>
  );
}

PRInsightsPanel.propTypes = {
  reportId: PropTypes.string.isRequired,
  entity: PropTypes.string
};
