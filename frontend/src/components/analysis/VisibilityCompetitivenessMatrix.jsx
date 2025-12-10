import PropTypes from 'prop-types';
import { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import AnnotationsModule from 'highcharts/modules/annotations';

// Initialize the annotations module
if (typeof Highcharts === 'object') {
  AnnotationsModule(Highcharts);
}

/**
 * VisibilityCompetitivenessMatrix Component
 * Highcharts scatter plot showing categories by Visibility (X) vs Competitiveness/Win Rate (Y)
 * Each point represents a category/market combination with country label for disambiguation
 */
export default function VisibilityCompetitivenessMatrix({ categoryMetrics = [], entity = '' }) {
  // Check if we have competitive data (win rates)
  const hasCompetitiveData = categoryMetrics.some(cat => cat.winRate !== null && cat.winRate !== undefined);

  const chartOptions = useMemo(() => {
    // Prepare scatter data points
    // X = Visibility, Y = Win Rate (Competitiveness)
    const dataPoints = categoryMetrics
      .filter(cat => cat.visibility !== null && cat.visibility !== undefined)
      .map(cat => ({
        x: (cat.visibility || 0) * 100,       // X-axis: Visibility
        y: (cat.winRate || 0) * 100,          // Y-axis: Win Rate (Competitiveness)
        name: cat.marketLabel || cat.categoryName,
        avgPosition: cat.avgPosition?.toFixed(1) || 'N/A',
        mentions: cat.mentions || 0,
        sov: (cat.sov || 0) * 100,
        winRate: (cat.winRate || 0) * 100
      }));

    return {
      chart: {
        type: 'scatter',
        height: 420,
        backgroundColor: 'transparent',
        style: {
          fontFamily: 'Roboto, Helvetica Neue, Arial, sans-serif'
        }
      },
      title: {
        text: 'Visibility vs Competitiveness',
        align: 'left',
        style: {
          color: '#212121',
          fontSize: '18px',
          fontWeight: '500'
        }
      },
      subtitle: {
        text: `Category positioning for ${entity}`,
        align: 'left',
        style: {
          color: '#757575',
          fontSize: '14px'
        }
      },
      xAxis: {
        title: {
          text: 'Visibility (%)',
          style: { color: '#757575', fontSize: '12px' }
        },
        min: 0,
        max: 100,
        gridLineWidth: 1,
        gridLineColor: '#F5F5F5',
        lineColor: '#E0E0E0',
        tickColor: '#E0E0E0',
        labels: {
          format: '{value}%',
          style: { color: '#757575' }
        },
        // Quadrant line at 50%
        plotLines: [{
          color: '#E0E0E0',
          dashStyle: 'Dash',
          value: 50,
          width: 1,
          zIndex: 3
        }]
      },
      yAxis: {
        title: {
          text: 'Competitiveness (%)',
          style: { color: '#757575', fontSize: '12px' }
        },
        min: 0,
        max: 100,
        gridLineColor: '#F5F5F5',
        lineColor: '#E0E0E0',
        labels: {
          format: '{value}%',
          style: { color: '#757575' }
        },
        // Quadrant line at 50%
        plotLines: [{
          color: '#E0E0E0',
          dashStyle: 'Dash',
          value: 50,
          width: 1,
          zIndex: 3
        }]
      },
      tooltip: {
        useHTML: true,
        backgroundColor: '#FFFFFF',
        borderColor: '#E0E0E0',
        borderRadius: 8,
        shadow: true,
        padding: 12,
        formatter: function() {
          return `
            <div style="min-width: 180px;">
              <div style="font-weight: 600; font-size: 14px; color: #212121; margin-bottom: 8px;">
                ${this.point.name}
              </div>
              <div style="display: grid; grid-template-columns: auto auto; gap: 4px 12px; font-size: 13px;">
                <span style="color: #757575;">Visibility:</span>
                <span style="color: #212121; font-weight: 500;">${this.point.x.toFixed(1)}%</span>
                <span style="color: #757575;">Competitiveness:</span>
                <span style="color: #212121; font-weight: 500;">${this.point.y.toFixed(1)}%</span>
                <span style="color: #757575;">SOV:</span>
                <span style="color: #212121; font-weight: 500;">${this.point.sov.toFixed(1)}%</span>
                <span style="color: #757575;">Avg Position:</span>
                <span style="color: #212121; font-weight: 500;">${this.point.avgPosition}</span>
              </div>
            </div>
          `;
        }
      },
      plotOptions: {
        scatter: {
          marker: {
            radius: 10,
            fillColor: '#2196F3',
            lineWidth: 2,
            lineColor: '#1976D2',
            symbol: 'circle',
            states: {
              hover: {
                enabled: true,
                radius: 14,
                fillColor: '#1976D2',
                lineColor: '#1565C0'
              }
            }
          },
          dataLabels: {
            enabled: dataPoints.length <= 10, // Show labels for up to 10 points
            format: '{point.name}',
            style: {
              fontSize: '11px',
              fontWeight: '500',
              color: '#424242',
              textOutline: '2px white'
            },
            y: -15,
            overflow: 'allow',
            crop: false,
            allowOverlap: true
          }
        }
      },
      legend: {
        enabled: false
      },
      series: [{
        name: 'Categories',
        data: dataPoints,
        color: '#2196F3'
      }],
      credits: {
        enabled: false
      },
      // Quadrant labels
      annotations: [{
        draggable: '',
        labelOptions: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          style: {
            fontSize: '11px',
            color: '#9E9E9E',
            fontWeight: '500'
          }
        },
        labels: [
          {
            point: { x: 75, y: 90, xAxis: 0, yAxis: 0 },
            text: 'STARS',
            style: { color: '#4CAF50' }
          },
          {
            point: { x: 25, y: 90, xAxis: 0, yAxis: 0 },
            text: 'OPPORTUNITY',
            style: { color: '#FF9800' }
          },
          {
            point: { x: 75, y: 10, xAxis: 0, yAxis: 0 },
            text: 'AT RISK',
            style: { color: '#EF5350' }
          },
          {
            point: { x: 25, y: 10, xAxis: 0, yAxis: 0 },
            text: 'MONITOR',
            style: { color: '#9E9E9E' }
          }
        ]
      }]
    };
  }, [categoryMetrics, entity]);

  // Don't render if no category metrics or no competitive data
  // User requirement: no fallback to SOV - matrix requires competitive data
  if (categoryMetrics.length === 0 || !hasCompetitiveData) {
    return null;
  }

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
      <HighchartsReact
        highcharts={Highcharts}
        options={chartOptions}
      />

      {/* Quadrant Legend */}
      <div className="mt-4 pt-4 border-t border-[#F5F5F5]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-[#4CAF50] mb-1"></div>
            <span className="text-xs font-medium text-[#4CAF50]">Stars</span>
            <span className="text-xs text-[#9E9E9E]">High Visibility + High Competitiveness</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-[#FF9800] mb-1"></div>
            <span className="text-xs font-medium text-[#FF9800]">Opportunity</span>
            <span className="text-xs text-[#9E9E9E]">Low Visibility + High Competitiveness</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-[#EF5350] mb-1"></div>
            <span className="text-xs font-medium text-[#EF5350]">At Risk</span>
            <span className="text-xs text-[#9E9E9E]">High Visibility + Low Competitiveness</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-[#9E9E9E] mb-1"></div>
            <span className="text-xs font-medium text-[#9E9E9E]">Monitor</span>
            <span className="text-xs text-[#9E9E9E]">Low Visibility + Low Competitiveness</span>
          </div>
        </div>
      </div>
    </div>
  );
}

VisibilityCompetitivenessMatrix.propTypes = {
  categoryMetrics: PropTypes.arrayOf(
    PropTypes.shape({
      categoryId: PropTypes.string,
      categoryName: PropTypes.string,
      marketCode: PropTypes.string,
      marketLabel: PropTypes.string,
      visibility: PropTypes.number,
      sov: PropTypes.number,
      avgPosition: PropTypes.number,
      mentions: PropTypes.number,
      winRate: PropTypes.number
    })
  ),
  entity: PropTypes.string
};
