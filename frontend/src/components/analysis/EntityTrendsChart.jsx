import { useState, useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Eye, TrendingUp, BarChart3, LineChart, Layers } from 'lucide-react';

// Brand colors for entities
const BRAND_COLORS = [
  '#EF5350', // Red
  '#42A5F5', // Blue
  '#5C6BC0', // Indigo
  '#FFCA28', // Yellow/Amber
  '#66BB6A', // Green
  '#AB47BC', // Purple
  '#26A69A', // Teal
  '#FF7043', // Deep Orange
  '#78909C', // Blue Grey
  '#8D6E63', // Brown
];

/**
 * EntityTrendsChart Component
 * Shows SOV or Average Position trends for all entities with hover tooltip
 */
export default function EntityTrendsChart({
  rankings = [],
  brandFamilyRanking = [],
  entity,
  showBrandFamilies: externalShowBrandFamilies,
  onToggleBrandFamilies
}) {
  const [activeTab, setActiveTab] = useState('sov'); // 'sov' or 'position'
  const [chartType, setChartType] = useState('line'); // 'line' or 'bar'
  const [internalShowBrandFamilies, setInternalShowBrandFamilies] = useState(true);

  // Use external state if provided, otherwise use internal state
  const showBrandFamilies = externalShowBrandFamilies !== undefined ? externalShowBrandFamilies : internalShowBrandFamilies;
  const hasBrandFamilies = brandFamilyRanking && brandFamilyRanking.length > 0;

  // Determine which rankings to display
  const displayRankings = (showBrandFamilies && hasBrandFamilies) ? brandFamilyRanking : rankings;

  const handleToggleBrandFamilies = () => {
    if (onToggleBrandFamilies) {
      onToggleBrandFamilies(!showBrandFamilies);
    } else {
      setInternalShowBrandFamilies(!internalShowBrandFamilies);
    }
  };

  // Generate placeholder historical data for all entities
  const trendData = useMemo(() => {
    const months = [
      { key: 'jan', label: 'Jan', fullLabel: 'January 2025' },
      { key: 'feb', label: 'Feb', fullLabel: 'February 2025' },
      { key: 'mar', label: 'Mar', fullLabel: 'March 2025' },
      { key: 'apr', label: 'Apr', fullLabel: 'April 2025' },
      { key: 'may', label: 'May', fullLabel: 'May 2025' },
      { key: 'jun', label: 'Jun', fullLabel: 'June 2025' },
    ];

    // Create data series for each entity (use displayRankings for brand family support)
    const entities = displayRankings.slice(0, 5).map((ranking, index) => {
      const currentSov = (ranking.sov || 0) * 100;
      const currentPosition = ranking.average_rank || 3;

      // Generate placeholder historical data with slight variations
      // Real current data is used for the last month
      const sovData = months.map((month, monthIdx) => {
        if (monthIdx === months.length - 1) {
          return currentSov; // Current real data
        }
        // Placeholder: slight random variation around current value
        const variation = (Math.random() - 0.5) * 20;
        return Math.max(0, Math.min(100, currentSov + variation * (monthIdx / months.length)));
      });

      const positionData = months.map((month, monthIdx) => {
        if (monthIdx === months.length - 1) {
          return currentPosition; // Current real data
        }
        // Placeholder: slight random variation
        const variation = (Math.random() - 0.5) * 1.5;
        return Math.max(1, currentPosition + variation);
      });

      return {
        name: ranking.name,
        color: BRAND_COLORS[index % BRAND_COLORS.length],
        sovData,
        positionData,
        currentSov,
        currentPosition,
      };
    });

    return { months, entities };
  }, [displayRankings]);

  // Chart configuration
  const chartOptions = useMemo(() => {
    const isSOV = activeTab === 'sov';
    const isBar = chartType === 'bar';

    return {
      chart: {
        type: isBar ? 'column' : 'spline',
        height: 280,
        backgroundColor: 'transparent',
        style: {
          fontFamily: 'inherit'
        },
        spacing: [20, 20, 20, 20],
      },
      title: { text: null },
      xAxis: {
        categories: trendData.months.map(m => m.label),
        labels: {
          style: { color: '#757575', fontSize: '12px' }
        },
        lineColor: '#E0E0E0',
        tickColor: '#E0E0E0',
      },
      yAxis: {
        title: { text: null },
        labels: {
          format: isSOV ? '{value}%' : '{value}',
          style: { color: '#757575', fontSize: '12px' }
        },
        gridLineColor: '#F5F5F5',
        min: 0,
        // Auto-scale max based on data, with some padding
        softMax: isSOV ? undefined : 5,
        reversed: !isSOV, // Position should be reversed (lower is better)
        startOnTick: true,
        endOnTick: true,
      },
      legend: { enabled: false },
      tooltip: {
        shared: true,
        useHTML: true,
        backgroundColor: '#212121',
        borderRadius: 12,
        borderWidth: 0,
        shadow: {
          color: 'rgba(0,0,0,0.2)',
          offsetX: 0,
          offsetY: 4,
          width: 16,
        },
        padding: 16,
        style: {
          color: '#ffffff',
        },
        formatter: function() {
          const monthIndex = this.points[0]?.point?.index ?? 0;
          const monthLabel = trendData.months[monthIndex]?.fullLabel || '';

          let html = `<div style="font-weight: 500; font-size: 14px; margin-bottom: 12px; color: #ffffff;">${monthLabel}</div>`;

          // Sort points by value (highest first for SOV, lowest first for position)
          const sortedPoints = [...this.points].sort((a, b) => {
            if (isSOV) return b.y - a.y;
            return a.y - b.y;
          });

          sortedPoints.forEach((point) => {
            const value = isSOV
              ? `${point.y.toFixed(0)}%`
              : point.y.toFixed(1);

            html += `
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 24px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background-color: ${point.color};"></span>
                  <span style="font-size: 13px; color: #ffffff;">${point.series.name}</span>
                </div>
                <span style="font-size: 13px; font-weight: 500; color: #4CAF50;">${value}</span>
              </div>
            `;
          });

          return html;
        }
      },
      plotOptions: {
        series: {
          marker: {
            enabled: true,
            radius: 4,
            symbol: 'circle',
          },
          lineWidth: 2,
        },
        column: {
          borderRadius: 4,
        }
      },
      series: trendData.entities.map((ent) => ({
        name: ent.name,
        data: isSOV ? ent.sovData : ent.positionData,
        color: ent.color,
      })),
      credits: { enabled: false },
    };
  }, [trendData, activeTab, chartType]);

  if (displayRankings.length === 0) {
    return (
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
        <p className="text-[#757575] text-center">No ranking data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
      {/* Header with tabs and chart type toggle */}
      <div className="flex items-center justify-between mb-6">
        {/* Tabs */}
        <div className="inline-flex bg-[#F5F5F5] rounded-full p-1">
          <button
            onClick={() => setActiveTab('sov')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'sov'
                ? 'bg-white text-[#212121] shadow-sm'
                : 'text-[#757575] hover:text-[#212121]'
            }`}
          >
            <Eye className="w-4 h-4" />
            SOV
          </button>
          <button
            onClick={() => setActiveTab('position')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === 'position'
                ? 'bg-white text-[#212121] shadow-sm'
                : 'text-[#757575] hover:text-[#212121]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Avg Position
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Brand Families toggle */}
          {hasBrandFamilies && (
            <button
              onClick={handleToggleBrandFamilies}
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

          {/* Chart type toggle */}
          <div className="flex items-center gap-1 bg-[#F5F5F5] rounded-lg p-1">
            <button
              onClick={() => setChartType('line')}
              className={`p-2 rounded transition-all ${
                chartType === 'line'
                  ? 'bg-white text-[#212121] shadow-sm'
                  : 'text-[#757575] hover:text-[#212121]'
              }`}
            >
              <LineChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-2 rounded transition-all ${
                chartType === 'bar'
                  ? 'bg-white text-[#212121] shadow-sm'
                  : 'text-[#757575] hover:text-[#212121]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <HighchartsReact highcharts={Highcharts} options={chartOptions} />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[#F5F5F5]">
        {trendData.entities.map((ent, index) => {
          // Check for target: either by name match or is_target_brand flag (for brand families)
          const rankingItem = displayRankings[index];
          const isTarget = rankingItem?.is_target_brand || ent.name.toLowerCase() === entity?.toLowerCase();
          return (
            <div
              key={index}
              className={`flex items-center gap-2 ${isTarget ? 'font-medium' : ''}`}
            >
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: ent.color }}
              />
              <span className={`text-sm ${isTarget ? 'text-[#212121]' : 'text-[#757575]'}`}>
                {ent.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
