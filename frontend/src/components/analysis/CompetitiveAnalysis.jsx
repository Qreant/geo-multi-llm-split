import { useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Check, X, Globe } from 'lucide-react';
import SourceAnalysis from './SourceAnalysis';
import CompetitiveMatrixHeatmap from './CompetitiveMatrixHeatmap';

// Map country suffix to ISO codes for flag display
const COUNTRY_SUFFIX_TO_ISO = {
  'US': 'us', 'CA': 'ca', 'MX': 'mx', 'GB': 'gb', 'UK': 'gb', 'IE': 'ie', 'FR': 'fr',
  'DE': 'de', 'ES': 'es', 'IT': 'it', 'PT': 'pt', 'NL': 'nl', 'BE': 'be', 'AT': 'at',
  'CH': 'ch', 'LU': 'lu', 'SE': 'se', 'NO': 'no', 'DK': 'dk', 'FI': 'fi', 'IS': 'is',
  'PL': 'pl', 'CZ': 'cz', 'SK': 'sk', 'HU': 'hu', 'RO': 'ro', 'BG': 'bg', 'UA': 'ua',
  'RU': 'ru', 'GR': 'gr', 'HR': 'hr', 'SI': 'si', 'RS': 'rs', 'JP': 'jp', 'KR': 'kr',
  'CN': 'cn', 'TW': 'tw', 'HK': 'hk', 'SG': 'sg', 'AU': 'au', 'NZ': 'nz', 'TH': 'th',
  'VN': 'vn', 'ID': 'id', 'MY': 'my', 'PH': 'ph', 'IN': 'in', 'BD': 'bd', 'PK': 'pk',
  'SA': 'sa', 'AE': 'ae', 'EG': 'eg', 'IL': 'il', 'TR': 'tr', 'IR': 'ir', 'QA': 'qa',
  'BR': 'br', 'AR': 'ar', 'CL': 'cl', 'CO': 'co', 'PE': 'pe', 'ZA': 'za',
  'UN': 'us', 'GE': 'de', 'SP': 'es', 'SW': 'ch', 'NE': 'nl', 'PO': 'pt',
  'JA': 'jp', 'KO': 'kr', 'SO': 'kr', 'TA': 'tw', 'HO': 'hk', 'TU': 'tr', 'ME': 'mx'
};

function getCountryCode(marketCode) {
  if (!marketCode) return null;
  const parts = marketCode.split('-');
  const countrySuffix = parts.length > 1 ? parts[1].toUpperCase() : parts[0].toUpperCase();
  return COUNTRY_SUFFIX_TO_ISO[countrySuffix] || (countrySuffix.length === 2 ? countrySuffix.toLowerCase() : null);
}

function getFlagUrl(marketCode) {
  const countryCode = getCountryCode(marketCode);
  return countryCode ? `https://hatscripts.github.io/circle-flags/flags/${countryCode}.svg` : null;
}

/**
 * Generate Brandfetch logo URL from brand name
 * Uses the simple hotlinking format: https://cdn.brandfetch.io/:domain?c=CLIENT_ID
 */
function generateBrandLogoUrl(brandName) {
  const clientId = import.meta.env.VITE_LOGO_API_KEY;
  if (!clientId || !brandName) return null;

  // Convert brand name to likely domain
  const domain = brandName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .trim() + '.com';

  return `https://cdn.brandfetch.io/${domain}?c=${clientId}`;
}

/**
 * CompetitiveAnalysis Component
 * Displays competitive positioning analysis with:
 * 1. Share of Voice by LLM (donut chart)
 * 2. Pros and Cons by Brand (table)
 * 3. Competitive Questions Matrix (via CompetitiveMatrixHeatmap)
 * 4. Source Analysis (via SourceAnalysis component)
 */
export default function CompetitiveAnalysis({ data, category, entity, competitors, allSources = [], selectedLLMs = ['gemini', 'openai'], perMarketData = null, markets = null }) {
  const [marketView, setMarketView] = useState('all'); // 'all' or 'by-market'

  // Check if we have multi-market data
  const hasMultiMarket = perMarketData && perMarketData.length > 1 && markets && markets.length > 1;

  if (!data) {
    return (
      <div className="card-base p-8 text-center">
        <p className="text-[#757575]">No competitive data available for this category</p>
      </div>
    );
  }

  const rawEntitiesRanking = data.entities_ranking || [];
  const prosConsData = data.pros_cons || {};
  const sourceAnalysis = data.source_analysis || {};
  const rankedFirst = data.ranked_first_questions || [];
  const notRankedFirst = data.not_ranked_first_questions || [];
  const competitiveLlmPerformance = data.competitive_llm_performance || [];

  // Normalize entities_ranking to merge case-insensitive duplicates (e.g., "Nike" and "nike")
  const entitiesRanking = useMemo(() => {
    const merged = new Map(); // lowercase -> { sov, count, displayNames: Map }
    rawEntitiesRanking.forEach(item => {
      const key = item.name?.toLowerCase().trim();
      if (!key) return;
      if (!merged.has(key)) {
        merged.set(key, { sov: 0, count: 0, displayNames: new Map() });
      }
      const entry = merged.get(key);
      entry.sov += item.sov || 0;
      entry.count += item.count || 1;
      entry.displayNames.set(item.name, (entry.displayNames.get(item.name) || 0) + (item.count || 1));
    });

    return Array.from(merged.entries())
      .map(([key, { sov, count, displayNames }]) => {
        // Use most common display name
        let bestName = key;
        let maxCount = 0;
        displayNames.forEach((cnt, name) => {
          if (cnt > maxCount) {
            maxCount = cnt;
            bestName = name;
          }
        });
        return { name: bestName, sov, count };
      })
      .sort((a, b) => b.sov - a.sov);
  }, [rawEntitiesRanking]);

  // Check which LLMs are selected for filtering
  const showGemini = selectedLLMs.includes('gemini');
  const showOpenai = selectedLLMs.includes('openai');
  const bothSelected = showGemini && showOpenai;

  // Color palette for pie charts
  const CHART_COLORS = ['#4285F4', '#34A853', '#9C27B0', '#FF9800', '#EA4335', '#00BCD4', '#607D8B', '#E91E63'];

  // Filter competitive LLM performance by selected LLMs
  const filteredLlmPerformance = useMemo(() => {
    return competitiveLlmPerformance.filter(perf =>
      selectedLLMs.includes(perf.llm)
    );
  }, [competitiveLlmPerformance, selectedLLMs]);

  // 1. Share of Voice by LLM (Pie Chart) - use filtered data when only one LLM selected
  const sovPieData = useMemo(() => {
    let sourceData;

    // If both LLMs selected, use combined entities_ranking
    if (bothSelected) {
      sourceData = entitiesRanking;
    } else {
      // Otherwise, use recalculated SOV from questions (without the slice)
      const allQuestions = [...rankedFirst, ...notRankedFirst];
      const entityCounts = new Map();
      let totalChoices = 0;

      const addBrand = (brandName) => {
        if (!brandName) return;
        const key = brandName.toLowerCase().trim();
        if (!entityCounts.has(key)) {
          entityCounts.set(key, { count: 0, displayNames: new Map() });
        }
        const entry = entityCounts.get(key);
        entry.count++;
        entry.displayNames.set(brandName, (entry.displayNames.get(brandName) || 0) + 1);
        totalChoices++;
      };

      allQuestions.forEach(item => {
        if (showGemini && item.llm_responses?.gemini) {
          addBrand(item.llm_responses.gemini.top_brand);
        }
        if (showOpenai && item.llm_responses?.openai) {
          addBrand(item.llm_responses.openai.top_brand);
        }
      });

      sourceData = Array.from(entityCounts.entries())
        .map(([key, { count, displayNames }]) => {
          let bestName = key;
          let maxCount = 0;
          displayNames.forEach((cnt, name) => {
            if (cnt > maxCount) {
              maxCount = cnt;
              bestName = name;
            }
          });
          return {
            name: bestName,
            count,
            sov: totalChoices > 0 ? count / totalChoices : 0
          };
        })
        .sort((a, b) => b.sov - a.sov);
    }

    // Calculate total SOV to normalize to 100%
    const totalSov = sourceData.reduce((sum, comp) => sum + (comp.sov || 0), 0);
    const normalizeFactor = totalSov > 0 ? 1 / totalSov : 1;

    // Show top 7 brands, group rest as "Others"
    const MAX_BRANDS = 7;
    const result = [];

    sourceData.slice(0, MAX_BRANDS).forEach((comp, index) => {
      result.push({
        name: comp.name,
        y: (comp.sov || 0) * normalizeFactor * 100,
        color: CHART_COLORS[index % CHART_COLORS.length]
      });
    });

    // Group remaining brands as "Others"
    if (sourceData.length > MAX_BRANDS) {
      const othersSov = sourceData.slice(MAX_BRANDS).reduce((sum, comp) => sum + (comp.sov || 0), 0);
      if (othersSov > 0) {
        result.push({
          name: 'Others',
          y: othersSov * normalizeFactor * 100,
          color: '#9E9E9E' // Grey for "Others"
        });
      }
    }

    return result;
  }, [entitiesRanking, rankedFirst, notRankedFirst, showGemini, showOpenai, bothSelected]);

  // Build per-market SOV data for multi-market view
  const perMarketSovData = useMemo(() => {
    if (!hasMultiMarket) return [];

    return perMarketData.map(marketItem => {
      const marketCode = marketItem.marketCode;
      const marketCountry = marketItem.marketCountry;
      const marketData = marketItem.data;
      const marketRankings = marketData?.entities_ranking || [];

      // Calculate total SOV for normalization
      const totalSov = marketRankings.reduce((sum, comp) => sum + (comp.sov || 0), 0);
      const normalizeFactor = totalSov > 0 ? 1 / totalSov : 1;

      // Show top 5 brands for smaller donut charts
      const MAX_BRANDS = 5;
      const result = [];

      marketRankings.slice(0, MAX_BRANDS).forEach((comp, index) => {
        result.push({
          name: comp.name,
          y: (comp.sov || 0) * normalizeFactor * 100,
          color: CHART_COLORS[index % CHART_COLORS.length]
        });
      });

      // Group remaining as "Others"
      if (marketRankings.length > MAX_BRANDS) {
        const othersSov = marketRankings.slice(MAX_BRANDS).reduce((sum, comp) => sum + (comp.sov || 0), 0);
        if (othersSov > 0) {
          result.push({
            name: 'Others',
            y: othersSov * normalizeFactor * 100,
            color: '#9E9E9E'
          });
        }
      }

      // Find entity's SOV in this market
      const entitySov = marketRankings.find(r => r.name?.toLowerCase() === entity.toLowerCase());
      const entitySovPercent = entitySov ? ((entitySov.sov || 0) * normalizeFactor * 100).toFixed(0) : '0';

      return {
        marketCode,
        marketCountry,
        flagUrl: getFlagUrl(marketCode),
        data: result,
        entitySov: entitySovPercent
      };
    });
  }, [hasMultiMarket, perMarketData, entity]);

  // Donut chart configuration
  const sovDonutOptions = {
    chart: {
      type: 'pie',
      height: 350,
      backgroundColor: 'transparent'
    },
    title: { text: '' },
    credits: { enabled: false },
    plotOptions: {
      pie: {
        innerSize: '60%', // Makes it a donut
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: false
        },
        showInLegend: false,
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    },
    tooltip: {
      pointFormat: '<b>{point.percentage:.1f}%</b>',
      style: { fontSize: '13px' }
    },
    series: [{
      name: 'Share of Voice',
      colorByPoint: true,
      data: sovPieData
    }]
  }

  // 2. Group pros/cons by brand for table display
  const prosConsByBrand = useMemo(() => {
    const brandMap = new Map();

    // Process pros - group by entity
    (prosConsData.pros || []).forEach(pro => {
      const brand = pro.entity || entity;
      if (!brandMap.has(brand)) {
        brandMap.set(brand, { pros: [], cons: [] });
      }
      // Avoid duplicates
      if (!brandMap.get(brand).pros.includes(pro.attribute)) {
        brandMap.get(brand).pros.push(pro.attribute);
      }
    });

    // Process cons - group by entity
    (prosConsData.cons || []).forEach(con => {
      const brand = con.entity || entity;
      if (!brandMap.has(brand)) {
        brandMap.set(brand, { pros: [], cons: [] });
      }
      // Avoid duplicates
      if (!brandMap.get(brand).cons.includes(con.attribute)) {
        brandMap.get(brand).cons.push(con.attribute);
      }
    });

    // Sort entries so target entity comes first, then alphabetically
    const sortedEntries = Array.from(brandMap.entries()).sort((a, b) => {
      const isATarget = a[0].toLowerCase() === entity.toLowerCase();
      const isBTarget = b[0].toLowerCase() === entity.toLowerCase();
      if (isATarget && !isBTarget) return -1;
      if (!isATarget && isBTarget) return 1;
      return a[0].localeCompare(b[0]);
    });

    return new Map(sortedEntries);
  }, [prosConsData, entity]);

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xl font-medium text-[#212121] mb-2">Competitive Analysis</h2>
        <p className="text-sm text-[#757575]">
          Brand positioning in competitive comparisons for {category || 'this category'}
        </p>
      </div>

      {/* Share of Voice & LLM Performance - Combined Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-[#212121] mb-1">Share of Voice</h3>
            <p className="text-sm text-[#757575]">Brand selection distribution across AI engines</p>
          </div>
          {/* Market View Toggle */}
          {hasMultiMarket && (
            <div className="flex items-center gap-1 bg-[#F5F5F5] rounded-lg p-1">
              <button
                onClick={() => setMarketView('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  marketView === 'all'
                    ? 'bg-white text-[#212121] shadow-sm'
                    : 'text-[#757575] hover:text-[#212121]'
                }`}
              >
                All Markets
              </button>
              <button
                onClick={() => setMarketView('by-market')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  marketView === 'by-market'
                    ? 'bg-white text-[#212121] shadow-sm'
                    : 'text-[#757575] hover:text-[#212121]'
                }`}
              >
                <Globe className="w-4 h-4" />
                By Market
              </button>
            </div>
          )}
        </div>

        {/* All Markets View */}
        {marketView === 'all' && (
          <div className="flex gap-6">
            {/* Left: Donut Chart with Custom Legend */}
            <div className="flex-1 min-w-0">
              {sovPieData.length > 0 ? (
                <>
                  <HighchartsReact highcharts={Highcharts} options={sovDonutOptions} />
                  {/* Custom Legend with Brand Logos */}
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
                    {sovPieData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <img
                          src={generateBrandLogoUrl(item.name)}
                          alt=""
                          className="w-4 h-4 rounded object-contain"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span className="text-xs font-medium text-[#212121]">{item.name}</span>
                        <span className="text-xs text-[#757575]">{item.y.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-64 flex items-center justify-center text-[#757575]">
                  No data available
                </div>
              )}
            </div>

            {/* Right: LLM Performance Metrics */}
            {filteredLlmPerformance.length > 0 && (
              <div className="w-64 flex-shrink-0 flex flex-col gap-3 justify-center">
                <h4 className="text-xs font-medium text-[#9E9E9E] uppercase tracking-wide mb-1">
                  {entity} Choice Rate
                </h4>
                {filteredLlmPerformance.map((perf) => (
                  <div
                    key={perf.llm}
                    className={`p-3 rounded-lg ${
                      perf.llm === 'gemini'
                        ? 'bg-[#F8FAFF] border border-[#E8F0FE]'
                        : 'bg-[#F6FBF9] border border-[#E6F4F1]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={perf.llm === 'gemini'
                            ? `https://cdn.brandfetch.io/google.com?c=${import.meta.env.VITE_LOGO_API_KEY}`
                            : `https://cdn.brandfetch.io/openai.com?c=${import.meta.env.VITE_LOGO_API_KEY}`
                          }
                          alt={perf.llm === 'gemini' ? 'Gemini' : 'ChatGPT'}
                          className="w-5 h-5 rounded object-contain"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span className="text-sm font-medium text-[#212121]">
                          {perf.llm === 'gemini' ? 'Gemini' : 'ChatGPT'}
                        </span>
                      </div>
                      <span className={`text-xl font-bold ${
                        perf.llm === 'gemini' ? 'text-[#4285F4]' : 'text-[#10A37F]'
                      }`}>
                        {((perf.brandChoicePercent || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#757575]">
                        Won {perf.targetChosen || 0} of {perf.totalQuestions || 0}
                      </span>
                      {perf.topChoice && perf.topChoice.toLowerCase() !== entity.toLowerCase() && (
                        <span className="text-[#E65100] font-medium">
                          Top: {perf.topChoice}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* By Market View - Side by Side Donut Charts with Flags */}
        {marketView === 'by-market' && hasMultiMarket && (
          <div>
            {/* Grid of market donuts - centered and evenly distributed */}
            <div className="flex flex-wrap justify-evenly gap-y-8 py-4">
              {perMarketSovData.map((market) => (
                <div key={market.marketCode} className="flex flex-col items-center">
                  {/* Market donut with flag in center */}
                  <div className="relative">
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={{
                        chart: {
                          type: 'pie',
                          height: 160,
                          width: 160,
                          backgroundColor: 'transparent',
                          margin: [0, 0, 0, 0]
                        },
                        title: { text: '' },
                        credits: { enabled: false },
                        plotOptions: {
                          pie: {
                            innerSize: '65%',
                            dataLabels: { enabled: false },
                            showInLegend: false,
                            borderWidth: 2,
                            borderColor: '#ffffff',
                            states: { hover: { brightness: 0.1 } }
                          }
                        },
                        tooltip: {
                          pointFormat: '<b>{point.name}</b>: {point.percentage:.0f}%',
                          style: { fontSize: '11px' }
                        },
                        series: [{
                          name: 'SOV',
                          colorByPoint: true,
                          data: market.data
                        }]
                      }}
                    />
                    {/* Flag in center of donut */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      {market.flagUrl ? (
                        <img
                          src={market.flagUrl}
                          alt={market.marketCountry || market.marketCode}
                          className="w-12 h-12 rounded-full shadow-sm"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-12 h-12 rounded-full bg-[#F5F5F5] items-center justify-center text-sm font-medium text-[#757575] ${market.flagUrl ? 'hidden' : 'flex'}`}
                      >
                        {market.marketCode?.split('-')[1] || market.marketCode}
                      </div>
                    </div>
                  </div>
                  {/* Market label and entity SOV */}
                  <div className="mt-2 text-center">
                    <p className="text-sm font-medium text-[#212121]">
                      {market.marketCountry || market.marketCode}
                    </p>
                    <p className="text-xs text-[#757575]">
                      {entity}: <span className="font-medium text-[#4285F4]">{market.entitySov}%</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Shared Legend */}
            <div className="mt-6 pt-4 border-t border-[#E0E0E0]">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                {sovPieData.slice(0, 7).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <img
                      src={generateBrandLogoUrl(item.name)}
                      alt=""
                      className="w-4 h-4 rounded object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <span className="text-xs font-medium text-[#212121]">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 2: Pros and Cons by Brand Table */}
      {prosConsByBrand.size > 0 && (
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-[#212121] mb-1">Pros and Cons by Brand</h3>
            <p className="text-sm text-[#757575]">Comparative strengths and weaknesses</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E0E0E0]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#757575] w-32">Brand</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#757575]">Pros</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#757575]">Cons</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(prosConsByBrand.entries()).map(([brand, { pros, cons }], idx) => (
                  <tr key={brand} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'}>
                    <td className="py-4 px-4 align-top">
                      <span className={`text-sm font-medium ${brand.toLowerCase() === entity.toLowerCase() ? 'text-[#2196F3]' : 'text-[#212121]'}`}>
                        {brand}
                      </span>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2">
                        {pros.length > 0 ? pros.slice(0, 4).map((pro, proIdx) => (
                          <div key={proIdx} className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-[#4CAF50] flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-[#212121]">{pro}</span>
                          </div>
                        )) : (
                          <span className="text-sm text-[#9E9E9E] italic">No pros identified</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-2">
                        {cons.length > 0 ? cons.slice(0, 4).map((con, conIdx) => (
                          <div key={conIdx} className="flex items-start gap-2">
                            <X className="w-4 h-4 text-[#EF5350] flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-[#212121]">{con}</span>
                          </div>
                        )) : (
                          <span className="text-sm text-[#9E9E9E] italic">No cons identified</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Competitive Questions Matrix */}
      <CompetitiveMatrixHeatmap
        rankedFirst={rankedFirst}
        notRankedFirst={notRankedFirst}
        entity={entity}
        selectedLLMs={selectedLLMs}
        perMarketData={perMarketData}
        markets={markets}
      />

      {/* Source Analysis with AI Citation Sources */}
      {((sourceAnalysis && Object.keys(sourceAnalysis).length > 0) || data.full_sources_list || allSources.length > 0) && (
        <SourceAnalysis
          sourceAnalysis={sourceAnalysis}
          sources={data.full_sources_list || allSources}
        />
      )}
    </div>
  );
}
