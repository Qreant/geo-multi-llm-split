import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { api } from '../../lib/api';
import { Eye, TrendingUp, BarChart3, Loader, AlertCircle, Trophy } from 'lucide-react';

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
      <div className={`grid gap-4 ${hasCompetitiveData ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <MetricCard
          icon={Eye}
          label="Visibility"
          subtitle="Brand mention rate"
          value={formatPercent(overallMetrics.avgVisibility)}
          progress={(overallMetrics.avgVisibility || 0) * 100}
          color="#2196F3"
        />
        <MetricCard
          icon={BarChart3}
          label="Avg Position"
          subtitle="Typical AI rank"
          value={`#${formatPosition(overallMetrics.avgPosition)}`}
          progress={Math.max(0, 100 - ((overallMetrics.avgPosition || 1) - 1) * 20)}
          color="#9C27B0"
        />
        <MetricCard
          icon={TrendingUp}
          label="Share of Voice"
          subtitle="Position-weighted visibility"
          value={formatPercent(overallMetrics.avgSOV)}
          progress={(overallMetrics.avgSOV || 0) * 100}
          color={(overallMetrics.avgSOV || 0) > 0.5 ? '#4CAF50' : (overallMetrics.avgSOV || 0) > 0.25 ? '#FF9800' : '#EF5350'}
          status={(overallMetrics.avgSOV || 0) > 0.5 ? 'Good' : (overallMetrics.avgSOV || 0) > 0.25 ? 'Fair' : 'Poor'}
          statusColor={(overallMetrics.avgSOV || 0) > 0.5 ? '#4CAF50' : (overallMetrics.avgSOV || 0) > 0.25 ? '#FF9800' : '#EF5350'}
        />
        {hasCompetitiveData && (
          <MetricCard
            icon={Trophy}
            label="LLM Choice"
            subtitle="First choice rate"
            value={formatPercent(overallMetrics.avgWinRate)}
            progress={(overallMetrics.avgWinRate || 0) * 100}
            color="#FF9800"
          />
        )}
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
