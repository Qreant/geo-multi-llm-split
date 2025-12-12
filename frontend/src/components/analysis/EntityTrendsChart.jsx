import { useState, useMemo, useRef, useEffect } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Eye, TrendingUp, Layers, Globe } from 'lucide-react';

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

// Map country suffix (from market code) to ISO 3166-1 alpha-2 country codes
// Handles auto-generated codes like "UN" from "UnitedStates", "SW" from "Switzerland", etc.
const COUNTRY_SUFFIX_TO_ISO = {
  // Standard ISO codes (already correct)
  'US': 'us', 'CA': 'ca', 'MX': 'mx', 'GB': 'gb', 'UK': 'gb', 'IE': 'ie', 'FR': 'fr',
  'DE': 'de', 'ES': 'es', 'IT': 'it', 'PT': 'pt', 'NL': 'nl', 'BE': 'be', 'AT': 'at',
  'CH': 'ch', 'LU': 'lu', 'SE': 'se', 'NO': 'no', 'DK': 'dk', 'FI': 'fi', 'IS': 'is',
  'PL': 'pl', 'CZ': 'cz', 'SK': 'sk', 'HU': 'hu', 'RO': 'ro', 'BG': 'bg', 'UA': 'ua',
  'RU': 'ru', 'GR': 'gr', 'HR': 'hr', 'SI': 'si', 'RS': 'rs', 'JP': 'jp', 'KR': 'kr',
  'CN': 'cn', 'TW': 'tw', 'HK': 'hk', 'SG': 'sg', 'AU': 'au', 'NZ': 'nz', 'TH': 'th',
  'VN': 'vn', 'ID': 'id', 'MY': 'my', 'PH': 'ph', 'IN': 'in', 'BD': 'bd', 'PK': 'pk',
  'SA': 'sa', 'AE': 'ae', 'EG': 'eg', 'IL': 'il', 'TR': 'tr', 'IR': 'ir', 'QA': 'qa',
  'KW': 'kw', 'BH': 'bh', 'OM': 'om', 'JO': 'jo', 'LB': 'lb', 'BR': 'br', 'AR': 'ar',
  'CL': 'cl', 'CO': 'co', 'PE': 'pe', 'VE': 've', 'EC': 'ec', 'UY': 'uy', 'PY': 'py',
  'BO': 'bo', 'ZA': 'za', 'NG': 'ng', 'KE': 'ke', 'MA': 'ma', 'SN': 'sn', 'GH': 'gh',
  'DZ': 'dz', 'TN': 'tn',

  // Auto-generated codes from country names (first 2 letters after removing spaces)
  'UN': 'us',  // UnitedStates, UnitedKingdom - default to US, UK handled by context
  'GE': 'de',  // Germany
  'SP': 'es',  // Spain
  'SW': 'ch',  // Switzerland (or Sweden - but SE is standard for Sweden)
  'NE': 'nl',  // Netherlands
  'PO': 'pt',  // Portugal (or Poland - PL is standard)
  'JA': 'jp',  // Japan
  'KO': 'kr',  // Korea
  'SO': 'kr',  // SouthKorea
  'TA': 'tw',  // Taiwan
  'HO': 'hk',  // HongKong
  'TU': 'tr',  // Turkey
  'ME': 'mx',  // Mexico
  'IR': 'ie',  // Ireland
  'IS': 'il',  // Israel
};

// Get ISO country code from market code (e.g., 'en-US' -> 'us', 'fr-SW' -> 'ch')
const getCountryCode = (marketCode) => {
  if (!marketCode) return null;

  // Extract country suffix (part after the hyphen)
  const parts = marketCode.split('-');
  const countrySuffix = parts.length > 1 ? parts[1].toUpperCase() : parts[0].toUpperCase();

  // Look up in mapping
  if (COUNTRY_SUFFIX_TO_ISO[countrySuffix]) {
    return COUNTRY_SUFFIX_TO_ISO[countrySuffix];
  }

  // Fallback: if it's a 2-letter code, assume it's already ISO and use lowercase
  return countrySuffix.length === 2 ? countrySuffix.toLowerCase() : null;
};

// Circle flags CDN for circular flag SVGs
const getFlagUrl = (marketCode) => {
  const countryCode = getCountryCode(marketCode);
  return countryCode ? `https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg` : null;
};

// Get logo URL using Clearbit Logo API or Google favicon service as fallback
const getLogoUrl = (entityName) => {
  if (!entityName) return null;
  // Clean entity name - remove common suffixes and special characters
  const cleanName = entityName.toLowerCase()
    .replace(/\s+(inc|corp|ltd|llc|co|company|group|international)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '');
  // Use Google's favicon service which is more reliable
  return `https://www.google.com/s2/favicons?domain=${cleanName}.com&sz=128`;
};

/**
 * EntityTrendsChart Component
 * Shows SOV or Average Position trends for all entities with hover tooltip
 * Supports per-market breakdown when in multi-market master mode
 */
export default function EntityTrendsChart({
  rankings = [],
  brandFamilyRanking = [],
  entity,
  showBrandFamilies: externalShowBrandFamilies,
  onToggleBrandFamilies,
  perMarketData = null,
  markets = null
}) {
  const [activeTab, setActiveTab] = useState('sov'); // 'sov' or 'position'
  const [internalShowBrandFamilies, setInternalShowBrandFamilies] = useState(true);
  const [marketView, setMarketView] = useState('all'); // 'all' or 'by-market'
  const chartRef = useRef(null);
  const customMarkersRef = useRef([]);

  // Use external state if provided, otherwise use internal state
  const showBrandFamilies = externalShowBrandFamilies !== undefined ? externalShowBrandFamilies : internalShowBrandFamilies;
  const hasBrandFamilies = brandFamilyRanking && brandFamilyRanking.length > 0;
  const hasMultiMarket = perMarketData && perMarketData.length > 1 && markets && markets.length > 1;

  // Determine which rankings to display
  const displayRankings = (showBrandFamilies && hasBrandFamilies) ? brandFamilyRanking : rankings;

  const handleToggleBrandFamilies = () => {
    if (onToggleBrandFamilies) {
      onToggleBrandFamilies(!showBrandFamilies);
    } else {
      setInternalShowBrandFamilies(!internalShowBrandFamilies);
    }
  };

  // Generate trend data - either aggregated or per-market
  const trendData = useMemo(() => {
    const months = [
      { key: 'jan', label: 'Jan', fullLabel: 'January 2025' },
      { key: 'feb', label: 'Feb', fullLabel: 'February 2025' },
      { key: 'mar', label: 'Mar', fullLabel: 'March 2025' },
      { key: 'apr', label: 'Apr', fullLabel: 'April 2025' },
      { key: 'may', label: 'May', fullLabel: 'May 2025' },
      { key: 'jun', label: 'Jun', fullLabel: 'June 2025' },
    ];

    // Per-market view: show each entity with separate lines per market
    if (marketView === 'by-market' && hasMultiMarket) {
      const entities = [];

      // Get top 3 entities to show across markets
      const topEntities = displayRankings.slice(0, 3);

      // Create an entity color map for consistency
      const entityColorMap = new Map();
      topEntities.forEach((ranking, idx) => {
        entityColorMap.set(ranking.name?.toLowerCase(), BRAND_COLORS[idx % BRAND_COLORS.length]);
      });

      topEntities.forEach((ranking, entityIndex) => {
        const entityName = ranking.name;
        const entityColor = BRAND_COLORS[entityIndex % BRAND_COLORS.length];

        // Create a line for each market for this entity
        perMarketData.forEach((marketItem) => {
          const marketRankings = showBrandFamilies && marketItem.data.brand_family_ranking?.length > 0
            ? marketItem.data.brand_family_ranking
            : marketItem.data.entities_ranking || [];

          // Find this entity in the market's rankings
          const marketEntityData = marketRankings.find(r =>
            r.name?.toLowerCase() === entityName?.toLowerCase()
          );

          if (marketEntityData) {
            const currentSov = (marketEntityData.sov || 0) * 100;
            const currentPosition = marketEntityData.average_rank || 3;

            // Generate placeholder historical data
            const sovData = months.map((month, monthIdx) => {
              if (monthIdx === months.length - 1) {
                return currentSov;
              }
              const variation = (Math.random() - 0.5) * 15;
              return Math.max(0, Math.min(100, currentSov + variation * (monthIdx / months.length)));
            });

            const positionData = months.map((month, monthIdx) => {
              if (monthIdx === months.length - 1) {
                return currentPosition;
              }
              const variation = (Math.random() - 0.5) * 1.5;
              return Math.max(1, currentPosition + variation);
            });

            entities.push({
              name: `${entityName} (${marketItem.marketCountry})`,
              entityName,
              marketCode: marketItem.marketCode,
              marketCountry: marketItem.marketCountry,
              color: entityColor, // Use entity color, not market color
              flagUrl: getFlagUrl(marketItem.marketCode),
              logoUrl: getLogoUrl(entityName),
              sovData,
              positionData,
              currentSov,
              currentPosition,
              dashStyle: 'Solid',
            });
          }
        });
      });

      return { months, entities, isPerMarket: true };
    }

    // Standard aggregated view
    const entities = displayRankings.slice(0, 5).map((ranking, index) => {
      const currentSov = (ranking.sov || 0) * 100;
      const currentPosition = ranking.average_rank || 3;

      const sovData = months.map((month, monthIdx) => {
        if (monthIdx === months.length - 1) {
          return currentSov;
        }
        const variation = (Math.random() - 0.5) * 20;
        return Math.max(0, Math.min(100, currentSov + variation * (monthIdx / months.length)));
      });

      const positionData = months.map((month, monthIdx) => {
        if (monthIdx === months.length - 1) {
          return currentPosition;
        }
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

    return { months, entities, isPerMarket: false };
  }, [displayRankings, marketView, hasMultiMarket, perMarketData, showBrandFamilies]);

  // Chart configuration
  const chartOptions = useMemo(() => {
    const isSOV = activeTab === 'sov';
    const isPerMarket = trendData.isPerMarket;

    // Store entity data for the load callback
    const entityData = trendData.entities;

    return {
      chart: {
        type: 'spline',
        height: isPerMarket ? 320 : 280,
        backgroundColor: 'transparent',
        style: {
          fontFamily: 'inherit'
        },
        spacing: [20, 20, 20, 20],
        events: {
          load: function() {
            // Only add custom markers for per-market line charts
            if (!isPerMarket) return;

            const chart = this;

            // Clear existing custom markers
            if (customMarkersRef.current) {
              customMarkersRef.current.forEach(el => el.destroy && el.destroy());
            }
            customMarkersRef.current = [];

            // Add custom logo+flag markers at the end of each line
            chart.series.forEach((series, seriesIndex) => {
              const ent = entityData[seriesIndex];
              if (!ent || !ent.logoUrl || !ent.flagUrl) return;

              const lastPoint = series.points[series.points.length - 1];
              if (!lastPoint) return;

              const x = lastPoint.plotX + chart.plotLeft;
              const y = lastPoint.plotY + chart.plotTop;

              // Sizes for the logo+flag badge
              const logoSize = 28;
              const flagSize = 14;

              // Create a group for the marker
              const group = chart.renderer.g('custom-marker').add();
              customMarkersRef.current.push(group);

              // White background circle for logo
              const bgCircle = chart.renderer.circle(x, y, logoSize / 2 + 2)
                .attr({
                  fill: '#ffffff',
                  stroke: '#E0E0E0',
                  'stroke-width': 1,
                })
                .add(group);
              customMarkersRef.current.push(bgCircle);

              // Logo image (clipped to circle via CSS)
              const logoImg = chart.renderer.image(
                ent.logoUrl,
                x - logoSize / 2,
                y - logoSize / 2,
                logoSize,
                logoSize
              )
                .attr({
                  'clip-path': 'circle(50%)',
                })
                .css({
                  'clip-path': 'circle(50%)',
                  'border-radius': '50%',
                })
                .add(group);
              customMarkersRef.current.push(logoImg);

              // Flag badge (bottom-right)
              const flagX = x + logoSize / 2 - flagSize / 2 - 2;
              const flagY = y + logoSize / 2 - flagSize / 2 - 2;

              // White background for flag badge
              const flagBg = chart.renderer.circle(flagX + flagSize / 2, flagY + flagSize / 2, flagSize / 2 + 2)
                .attr({
                  fill: '#1a1a2e',
                })
                .add(group);
              customMarkersRef.current.push(flagBg);

              // Flag image
              const flagImg = chart.renderer.image(
                ent.flagUrl,
                flagX,
                flagY,
                flagSize,
                flagSize
              )
                .css({
                  'clip-path': 'circle(50%)',
                  'border-radius': '50%',
                })
                .add(group);
              customMarkersRef.current.push(flagImg);

              // Move the entire group to front
              group.toFront();
            });
          },
          redraw: function() {
            // Re-draw markers on redraw
            if (!isPerMarket) return;

            const chart = this;

            // Clear existing custom markers
            if (customMarkersRef.current) {
              customMarkersRef.current.forEach(el => el.destroy && el.destroy());
            }
            customMarkersRef.current = [];

            // Re-add custom markers
            chart.series.forEach((series, seriesIndex) => {
              const ent = entityData[seriesIndex];
              if (!ent || !ent.logoUrl || !ent.flagUrl) return;

              const lastPoint = series.points[series.points.length - 1];
              if (!lastPoint) return;

              const x = lastPoint.plotX + chart.plotLeft;
              const y = lastPoint.plotY + chart.plotTop;

              const logoSize = 28;
              const flagSize = 14;

              const group = chart.renderer.g('custom-marker').add();
              customMarkersRef.current.push(group);

              const bgCircle = chart.renderer.circle(x, y, logoSize / 2 + 2)
                .attr({
                  fill: '#ffffff',
                  stroke: '#E0E0E0',
                  'stroke-width': 1,
                })
                .add(group);
              customMarkersRef.current.push(bgCircle);

              const logoImg = chart.renderer.image(
                ent.logoUrl,
                x - logoSize / 2,
                y - logoSize / 2,
                logoSize,
                logoSize
              )
                .css({ 'clip-path': 'circle(50%)', 'border-radius': '50%' })
                .add(group);
              customMarkersRef.current.push(logoImg);

              const flagX = x + logoSize / 2 - flagSize / 2 - 2;
              const flagY = y + logoSize / 2 - flagSize / 2 - 2;

              const flagBg = chart.renderer.circle(flagX + flagSize / 2, flagY + flagSize / 2, flagSize / 2 + 2)
                .attr({ fill: '#1a1a2e' })
                .add(group);
              customMarkersRef.current.push(flagBg);

              const flagImg = chart.renderer.image(
                ent.flagUrl,
                flagX,
                flagY,
                flagSize,
                flagSize
              )
                .css({ 'clip-path': 'circle(50%)', 'border-radius': '50%' })
                .add(group);
              customMarkersRef.current.push(flagImg);

              // Move the entire group to front
              group.toFront();
            });
          }
        }
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
        softMax: isSOV ? undefined : 5,
        reversed: !isSOV,
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
      },
      series: trendData.entities.map((ent) => {
        const dataArr = isSOV ? ent.sovData : ent.positionData;

        // For per-market view, hide the default marker on the last point (we draw custom logo+flag)
        const dataWithMarkers = isPerMarket && ent.logoUrl && ent.flagUrl
          ? dataArr.map((value, idx) => {
              if (idx === dataArr.length - 1) {
                // Last point - hide default marker (custom marker drawn via renderer)
                return {
                  y: value,
                  marker: {
                    enabled: false,
                  }
                };
              }
              return value;
            })
          : dataArr;

        return {
          name: ent.name,
          data: dataWithMarkers,
          color: ent.color,
          dashStyle: ent.dashStyle || 'Solid',
        };
      }),
      credits: { enabled: false },
    };
  }, [trendData, activeTab]);

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
          {/* Market View toggle - only show in multi-market master mode */}
          {hasMultiMarket && (
            <div className="inline-flex bg-[#F5F5F5] rounded-full p-1">
              <button
                onClick={() => setMarketView('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  marketView === 'all'
                    ? 'bg-white text-[#212121] shadow-sm'
                    : 'text-[#757575] hover:text-[#212121]'
                }`}
              >
                All Markets
              </button>
              <button
                onClick={() => setMarketView('by-market')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  marketView === 'by-market'
                    ? 'bg-white text-[#212121] shadow-sm'
                    : 'text-[#757575] hover:text-[#212121]'
                }`}
              >
                <Globe className="w-3 h-3" />
                By Market
              </button>
            </div>
          )}

          {/* Brand Families toggle */}
          {hasBrandFamilies && marketView === 'all' && (
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

        </div>
      </div>

      {/* Chart */}
      <HighchartsReact highcharts={Highcharts} options={chartOptions} />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-[#F5F5F5]">
        {trendData.isPerMarket ? (
          // Per-market legend: show logo with flag badge
          <>
            {trendData.entities.map((ent, index) => {
              const isTarget = ent.entityName?.toLowerCase() === entity?.toLowerCase();
              return (
                <div
                  key={index}
                  className={`flex items-center gap-2 ${isTarget ? 'font-medium' : ''}`}
                >
                  {/* Color indicator */}
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: ent.color }}
                  />
                  {/* Logo with flag badge */}
                  <div className="relative w-6 h-6">
                    {ent.logoUrl && (
                      <img
                        src={ent.logoUrl}
                        alt={ent.entityName}
                        className="w-6 h-6 rounded-full bg-white border border-gray-200 object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    {ent.flagUrl && (
                      <img
                        src={ent.flagUrl}
                        alt={ent.marketCountry}
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-[#1a1a2e]"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                  </div>
                  <span className={`text-sm ${isTarget ? 'text-[#212121]' : 'text-[#757575]'}`}>
                    {ent.name}
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          // Standard legend
          trendData.entities.map((ent, index) => {
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
          })
        )}
      </div>
    </div>
  );
}
