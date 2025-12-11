import { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Trophy, AlertCircle, Check, X } from 'lucide-react';
import SourceAnalysis from './SourceAnalysis';

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
 * Generate Brandfetch logo URL for LLM providers
 */
function getLLMLogoUrl(llm) {
  const clientId = import.meta.env.VITE_LOGO_API_KEY;
  if (!clientId) return null;

  const domain = llm === 'gemini' ? 'google.com' : 'openai.com';
  return `https://cdn.brandfetch.io/${domain}?c=${clientId}`;
}

/**
 * CompetitiveAnalysis Component
 * Displays competitive positioning analysis with:
 * 1. Share of Voice by LLM (donut chart)
 * 2. Pros and Cons by Brand (table)
 * 3. Questions Where Brand is Chosen
 * 4. Questions Where Brand is Not Chosen
 * 5. Source Analysis (via SourceAnalysis component)
 */
export default function CompetitiveAnalysis({ data, category, entity, competitors, allSources = [], selectedLLMs = ['gemini', 'openai'] }) {
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

  // Calculate SOV per entity from question data based on selected LLMs
  const filteredSovData = useMemo(() => {
    const allQuestions = [...rankedFirst, ...notRankedFirst];
    // Use lowercase key for aggregation, but track the display name (most common casing)
    const entityCounts = new Map(); // lowercase -> { count, displayNames: Map<original, count> }
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
      // Get top brand from each selected LLM
      if (showGemini && item.llm_responses?.gemini) {
        addBrand(item.llm_responses.gemini.top_brand);
      }
      if (showOpenai && item.llm_responses?.openai) {
        addBrand(item.llm_responses.openai.top_brand);
      }
    });

    // Convert to array and calculate percentages, using the most common display name
    const sovArray = Array.from(entityCounts.entries())
      .map(([key, { count, displayNames }]) => {
        // Find the most frequently used display name
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
      .sort((a, b) => b.sov - a.sov)
      .slice(0, 8);

    return { entities: sovArray, totalChoices };
  }, [rankedFirst, notRankedFirst, showGemini, showOpenai]);

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
        <div className="mb-4">
          <h3 className="text-lg font-medium text-[#212121] mb-1">Share of Voice</h3>
          <p className="text-sm text-[#757575]">Brand selection distribution across AI engines</p>
        </div>

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

      {/* Source Analysis with AI Citation Sources */}
      {((sourceAnalysis && Object.keys(sourceAnalysis).length > 0) || data.full_sources_list || allSources.length > 0) && (
        <SourceAnalysis
          sourceAnalysis={sourceAnalysis}
          sources={data.full_sources_list || allSources}
        />
      )}

      {/* Row 4: Questions Where Brand is Chosen */}
      {(() => {
        // Combine all questions and categorize by LLM agreement
        const allQuestions = [...rankedFirst, ...notRankedFirst];
        const chosenEntries = [];
        const filterPlaceholder = (text) => text && text !== 'Brand not mentioned in this response' && text !== 'Not selected as top choice' ? text : null;

        allQuestions.forEach((item, qIndex) => {
          // Only include LLM data if that LLM is selected in the filter
          const geminiData = showGemini ? item.llm_responses?.gemini : null;
          const openaiData = showOpenai ? item.llm_responses?.openai : null;

          // Skip questions with no data from selected LLMs
          if (!geminiData && !openaiData) return;

          const geminiChoseTarget = geminiData && geminiData.rank === 1;
          const openaiChoseTarget = openaiData && openaiData.rank === 1;

          // Both selected LLMs chose target - one card with both responses
          if (geminiChoseTarget && openaiChoseTarget) {
            const geminiComment = filterPlaceholder(geminiData?.target_comment) || filterPlaceholder(geminiData?.rawResponse) || filterPlaceholder(geminiData?.top_brand_comment);
            const openaiComment = filterPlaceholder(openaiData?.target_comment) || filterPlaceholder(openaiData?.rawResponse) || filterPlaceholder(openaiData?.top_brand_comment);
            if (geminiComment || openaiComment) {
              chosenEntries.push({
                key: `both-${qIndex}`,
                question: item.question,
                bothAgree: true,
                gemini: geminiComment ? { comment: geminiComment, sources: geminiData?.sources || [] } : null,
                openai: openaiComment ? { comment: openaiComment, sources: openaiData?.sources || [] } : null
              });
            }
          }
          // Only Gemini chose target
          else if (geminiChoseTarget && !openaiChoseTarget) {
            const geminiComment = filterPlaceholder(geminiData?.target_comment) || filterPlaceholder(geminiData?.rawResponse) || filterPlaceholder(geminiData?.top_brand_comment);
            if (geminiComment) {
              chosenEntries.push({
                key: `gemini-${qIndex}`,
                question: item.question,
                bothAgree: false,
                llm: 'gemini',
                comment: geminiComment,
                sources: geminiData?.sources || []
              });
            }
          }
          // Only OpenAI chose target
          else if (!geminiChoseTarget && openaiChoseTarget) {
            const openaiComment = filterPlaceholder(openaiData?.target_comment) || filterPlaceholder(openaiData?.rawResponse) || filterPlaceholder(openaiData?.top_brand_comment);
            if (openaiComment) {
              chosenEntries.push({
                key: `openai-${qIndex}`,
                question: item.question,
                bothAgree: false,
                llm: 'openai',
                comment: openaiComment,
                sources: openaiData?.sources || []
              });
            }
          }
        });

        return (
          <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-[#212121] mb-1">Questions Where {entity} is Chosen</h3>
              <p className="text-sm text-[#757575]">Scenarios where {entity} was selected as the top choice by LLMs ({chosenEntries.length} questions)</p>
            </div>

            {chosenEntries.length > 0 ? (
              <div className="space-y-4">
                {chosenEntries.map((entry) => (
                  <div key={entry.key} className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-medium text-[#212121]">{entry.question}</h4>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                        <span>Chosen:</span>
                        <img
                          src={generateBrandLogoUrl(entity)}
                          alt=""
                          className="w-5 h-5 rounded object-contain"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <span>{entity}</span>
                      </div>
                    </div>

                    {/* Both LLMs agree - show both responses */}
                    {entry.bothAgree ? (
                      <div className="space-y-3">
                        {entry.gemini && (
                          <div className="bg-white border-l-4 border-green-500 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <img
                                src={getLLMLogoUrl('gemini')}
                                alt="Gemini"
                                className="w-5 h-5 rounded object-contain"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                              <span className="text-sm font-medium text-[#212121]">Gemini</span>
                              <span className="text-xs text-[#757575]">— Why {entity} was chosen:</span>
                            </div>
                            <p className="text-sm text-[#212121]">{entry.gemini.comment}</p>
                            {entry.gemini.sources.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-[#757575] mb-1">Associated Sources:</p>
                                {entry.gemini.sources.slice(0, 2).map((source, idx) => (
                                  <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#2196F3] hover:underline">
                                    → {source.title || source.url}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {entry.openai && (
                          <div className="bg-white border-l-4 border-green-500 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <img
                                src={getLLMLogoUrl('openai')}
                                alt="ChatGPT"
                                className="w-5 h-5 rounded object-contain"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                              <span className="text-sm font-medium text-[#212121]">ChatGPT</span>
                              <span className="text-xs text-[#757575]">— Why {entity} was chosen:</span>
                            </div>
                            <p className="text-sm text-[#212121]">{entry.openai.comment}</p>
                            {entry.openai.sources.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-[#757575] mb-1">Associated Sources:</p>
                                {entry.openai.sources.slice(0, 2).map((source, idx) => (
                                  <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#2196F3] hover:underline">
                                    → {source.title || source.url}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Single LLM chose target (disagreement) - show only that LLM's response */
                      <div className="bg-white border-l-4 border-green-500 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={getLLMLogoUrl(entry.llm)}
                            alt={entry.llm === 'gemini' ? 'Gemini' : 'ChatGPT'}
                            className="w-5 h-5 rounded object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span className="text-sm font-medium text-[#212121]">{entry.llm === 'gemini' ? 'Gemini' : 'ChatGPT'}</span>
                          <span className="text-xs text-[#757575]">— Why {entity} was chosen:</span>
                        </div>
                        <p className="text-sm text-[#212121]">{entry.comment}</p>
                        {entry.sources.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-[#757575] mb-1">Associated Sources:</p>
                            {entry.sources.slice(0, 2).map((source, idx) => (
                              <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#2196F3] hover:underline">
                                → {source.title || source.url}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[#757575]">
                No data available for questions where {entity} was chosen.
              </div>
            )}
          </div>
        );
      })()}

      {/* Row 5: Questions Where Brand is Not Chosen */}
      {(() => {
        // Combine all questions and categorize by LLM agreement
        const allQuestions = [...rankedFirst, ...notRankedFirst];
        const notChosenEntries = [];
        const filterPlaceholder = (text) => text && text !== 'Brand not mentioned in this response' && text !== 'Not selected as top choice' ? text : null;

        allQuestions.forEach((item, qIndex) => {
          // Only include LLM data if that LLM is selected in the filter
          const geminiData = showGemini ? item.llm_responses?.gemini : null;
          const openaiData = showOpenai ? item.llm_responses?.openai : null;

          // Skip questions with no data from selected LLMs
          if (!geminiData && !openaiData) return;

          const geminiChoseTarget = geminiData && geminiData.rank === 1;
          const openaiChoseTarget = openaiData && openaiData.rank === 1;
          const geminiChoseCompetitor = geminiData && geminiData.rank !== 1;
          const openaiChoseCompetitor = openaiData && openaiData.rank !== 1;

          // Both selected LLMs chose competitor - one card with both responses
          if (geminiChoseCompetitor && openaiChoseCompetitor) {
            const geminiComment = filterPlaceholder(geminiData?.top_brand_comment) || filterPlaceholder(geminiData?.rawResponse) || filterPlaceholder(geminiData?.target_comment);
            const openaiComment = filterPlaceholder(openaiData?.top_brand_comment) || filterPlaceholder(openaiData?.rawResponse) || filterPlaceholder(openaiData?.target_comment);
            if (geminiComment || openaiComment) {
              notChosenEntries.push({
                key: `both-${qIndex}`,
                question: item.question,
                bothAgree: true,
                gemini: geminiComment ? {
                  comment: geminiComment,
                  chosenBrand: geminiData?.top_brand || 'Competitor',
                  sources: geminiData?.sources || []
                } : null,
                openai: openaiComment ? {
                  comment: openaiComment,
                  chosenBrand: openaiData?.top_brand || 'Competitor',
                  sources: openaiData?.sources || []
                } : null
              });
            }
          }
          // Only Gemini chose competitor
          else if (geminiChoseCompetitor && !openaiChoseCompetitor) {
            const geminiComment = filterPlaceholder(geminiData?.top_brand_comment) || filterPlaceholder(geminiData?.rawResponse) || filterPlaceholder(geminiData?.target_comment);
            if (geminiComment) {
              notChosenEntries.push({
                key: `gemini-${qIndex}`,
                question: item.question,
                bothAgree: false,
                llm: 'gemini',
                chosenBrand: geminiData?.top_brand || 'Competitor',
                comment: geminiComment,
                sources: geminiData?.sources || []
              });
            }
          }
          // Only OpenAI chose competitor
          else if (openaiChoseCompetitor && !geminiChoseCompetitor) {
            const openaiComment = filterPlaceholder(openaiData?.top_brand_comment) || filterPlaceholder(openaiData?.rawResponse) || filterPlaceholder(openaiData?.target_comment);
            if (openaiComment) {
              notChosenEntries.push({
                key: `openai-${qIndex}`,
                question: item.question,
                bothAgree: false,
                llm: 'openai',
                chosenBrand: openaiData?.top_brand || 'Competitor',
                comment: openaiComment,
                sources: openaiData?.sources || []
              });
            }
          }
        });

        return (
          <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-[#212121] mb-1">Questions Where {entity} is Not Chosen</h3>
              <p className="text-sm text-[#757575]">
                Opportunities where competitors were selected by LLMs ({notChosenEntries.length} questions)
              </p>
            </div>

            {notChosenEntries.length > 0 ? (
              <div className="space-y-4">
                {notChosenEntries.map((entry) => (
                  <div key={entry.key} className="bg-white border border-[#E0E0E0] rounded-lg p-5">
                    <div className="flex items-start justify-between mb-4">
                      <h4 className="text-base font-medium text-[#212121] flex-1 pr-4">{entry.question}</h4>
                      {entry.bothAgree ? (
                        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 bg-[#F5F5F5] rounded text-sm font-medium text-[#212121]">
                          <span>Chosen:</span>
                          <img
                            src={generateBrandLogoUrl(entry.gemini?.chosenBrand || entry.openai?.chosenBrand)}
                            alt=""
                            className="w-5 h-5 rounded object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span>{entry.gemini?.chosenBrand || entry.openai?.chosenBrand}</span>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 bg-[#F5F5F5] rounded text-sm font-medium text-[#212121]">
                          <span>Chosen:</span>
                          <img
                            src={generateBrandLogoUrl(entry.chosenBrand)}
                            alt=""
                            className="w-5 h-5 rounded object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span>{entry.chosenBrand}</span>
                        </div>
                      )}
                    </div>

                    {/* Both LLMs agree - show both responses */}
                    {entry.bothAgree ? (
                      <div className="space-y-3">
                        {entry.gemini && (
                          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <img
                                src={getLLMLogoUrl('gemini')}
                                alt="Gemini"
                                className="w-5 h-5 rounded object-contain"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                              <span className="text-sm font-medium text-[#212121]">Gemini</span>
                              <span className="text-xs text-[#757575]">— Why {entry.gemini.chosenBrand} was chosen:</span>
                            </div>
                            <p className="text-sm text-[#212121]">{entry.gemini.comment}</p>
                            {entry.gemini.sources.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-[#757575] mb-1">Associated Sources:</p>
                                {entry.gemini.sources.slice(0, 2).map((source, idx) => (
                                  <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#2196F3] hover:underline">
                                    → {source.title || source.url}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {entry.openai && (
                          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <img
                                src={getLLMLogoUrl('openai')}
                                alt="ChatGPT"
                                className="w-5 h-5 rounded object-contain"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                              <span className="text-sm font-medium text-[#212121]">ChatGPT</span>
                              <span className="text-xs text-[#757575]">— Why {entry.openai.chosenBrand} was chosen:</span>
                            </div>
                            <p className="text-sm text-[#212121]">{entry.openai.comment}</p>
                            {entry.openai.sources.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-[#757575] mb-1">Associated Sources:</p>
                                {entry.openai.sources.slice(0, 2).map((source, idx) => (
                                  <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#2196F3] hover:underline">
                                    → {source.title || source.url}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Single LLM chose competitor (disagreement) - show only that LLM's response */
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={getLLMLogoUrl(entry.llm)}
                            alt={entry.llm === 'gemini' ? 'Gemini' : 'ChatGPT'}
                            className="w-5 h-5 rounded object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span className="text-sm font-medium text-[#212121]">{entry.llm === 'gemini' ? 'Gemini' : 'ChatGPT'}</span>
                          <span className="text-xs text-[#757575]">— Why {entry.chosenBrand} was chosen:</span>
                        </div>
                        <p className="text-sm text-[#212121]">{entry.comment}</p>
                        {entry.sources.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-[#757575] mb-1">Associated Sources:</p>
                            {entry.sources.slice(0, 2).map((source, idx) => (
                              <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[#2196F3] hover:underline">
                                → {source.title || source.url}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[#757575]">
                No missed opportunities recorded.
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
