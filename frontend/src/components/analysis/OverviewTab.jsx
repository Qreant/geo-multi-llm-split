import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../lib/api';
import { Eye, TrendingUp, BarChart3, MessageSquare, Loader, AlertCircle, Trophy } from 'lucide-react';

import MetricCard from '../shared/MetricCard';
import AggregatedSourceAnalysis from './AggregatedSourceAnalysis';
import VisibilityCompetitivenessMatrix from './VisibilityCompetitivenessMatrix';

/**
 * OverviewTab Component
 * Aggregated dashboard view across all categories and markets
 */
export default function OverviewTab({ reportId, entity }) {
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOverviewData();
  }, [reportId]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/reports/${reportId}/overview`);
      setOverviewData(response.data);
    } catch (err) {
      console.error('Error fetching overview data:', err);
      setError(err.response?.data?.error || 'Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader className="w-8 h-8 animate-spin text-[#2196F3] mb-4" />
        <p className="text-[#757575]">Loading overview data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="w-8 h-8 text-[#EF5350] mb-4" />
        <p className="text-[#EF5350] font-medium mb-2">Error loading overview</p>
        <p className="text-[#757575] text-sm">{error}</p>
        <button
          onClick={fetchOverviewData}
          className="mt-4 px-4 py-2 text-sm font-medium text-[#2196F3] hover:bg-[#E3F2FD] rounded transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!overviewData) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <BarChart3 className="w-8 h-8 text-[#9E9E9E] mb-4" />
        <p className="text-[#757575]">No overview data available</p>
      </div>
    );
  }

  const { overallMetrics, categoryMetrics, sourceAnalysis, hasCompetitiveData } = overviewData;

  // Format percentage with 1 decimal
  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(1)}%`;
  };

  // Format average position
  const formatPosition = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toFixed(1);
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="mb-2">
        <h2 className="text-xl font-medium text-[#212121] mb-2">Overview Dashboard</h2>
        <p className="text-sm text-[#757575]">
          Aggregated insights across {overallMetrics.totalCategories} categor{overallMetrics.totalCategories === 1 ? 'y' : 'ies'}
          {overallMetrics.totalMarkets > 1 && ` and ${overallMetrics.totalMarkets} markets`}
        </p>
      </div>

      {/* Top Metrics Row */}
      <div className={`grid grid-cols-2 gap-4 ${hasCompetitiveData ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        <MetricCard
          icon={Eye}
          label="Avg Visibility"
          value={formatPercent(overallMetrics.avgVisibility)}
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg SOV"
          value={formatPercent(overallMetrics.avgSOV)}
        />
        <MetricCard
          icon={BarChart3}
          label="Avg Position"
          value={formatPosition(overallMetrics.avgPosition)}
        />
        {hasCompetitiveData && (
          <MetricCard
            icon={Trophy}
            label="Avg LLM Choice"
            value={formatPercent(overallMetrics.avgWinRate)}
          />
        )}
        <MetricCard
          icon={MessageSquare}
          label="Total Mentions"
          value={overallMetrics.totalMentions}
        />
      </div>

      {/* Visibility-Competitiveness Matrix (conditional) */}
      {hasCompetitiveData && (
        <VisibilityCompetitivenessMatrix
          categoryMetrics={categoryMetrics}
          entity={entity}
        />
      )}

      {/* Source Analysis */}
      <AggregatedSourceAnalysis
        sourceAnalysis={sourceAnalysis}
      />
    </div>
  );
}

OverviewTab.propTypes = {
  reportId: PropTypes.string.isRequired,
  entity: PropTypes.string
};
