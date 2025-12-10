import { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Trophy, AlertCircle, Check, X, Sparkles, MessageSquare } from 'lucide-react';
import SourceAnalysis from './SourceAnalysis';

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

  const entitiesRanking = data.entities_ranking || [];
  const prosConsData = data.pros_cons || {};
  const sourceAnalysis = data.source_analysis || {};
  const rankedFirst = data.ranked_first_questions || [];
  const notRankedFirst = data.not_ranked_first_questions || [];
  const competitiveLlmPerformance = data.competitive_llm_performance || [];

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
    const entityCounts = new Map();
    let totalChoices = 0;

    allQuestions.forEach(item => {
      // Get top brand from each selected LLM
      if (showGemini && item.llm_responses?.gemini) {
        const topBrand = item.llm_responses.gemini.top_brand;
        if (topBrand) {
          entityCounts.set(topBrand, (entityCounts.get(topBrand) || 0) + 1);
          totalChoices++;
        }
      }
      if (showOpenai && item.llm_responses?.openai) {
        const topBrand = item.llm_responses.openai.top_brand;
        if (topBrand) {
          entityCounts.set(topBrand, (entityCounts.get(topBrand) || 0) + 1);
          totalChoices++;
        }
      }
    });

    // Convert to array and calculate percentages
    const sovArray = Array.from(entityCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        sov: totalChoices > 0 ? count / totalChoices : 0
      }))
      .sort((a, b) => b.sov - a.sov)
      .slice(0, 8);

    return { entities: sovArray, totalChoices };
  }, [rankedFirst, notRankedFirst, showGemini, showOpenai]);

  // 1. Share of Voice by LLM (Pie Chart) - use filtered data when only one LLM selected
  const sovPieData = useMemo(() => {
    // If both LLMs selected, use combined entities_ranking
    if (bothSelected) {
      return entitiesRanking.slice(0, 8).map((comp, index) => ({
        name: comp.name,
        y: (comp.sov || 0) * 100,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }));
    }

    // Otherwise, use recalculated SOV from questions
    return filteredSovData.entities.map((comp, index) => ({
      name: comp.name,
      y: (comp.sov || 0) * 100,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [entitiesRanking, filteredSovData, bothSelected]);

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
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.0f}%',
          style: {
            fontSize: '12px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: '500',
            textOutline: 'none'
          },
          distance: 20
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

      {/* Share of Voice by LLM - Donut Chart */}
      <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-[#212121] mb-1">Share of Voice by LLM</h3>
          <p className="text-sm text-[#757575]">Percentage of times each brand is chosen by LLMs</p>
        </div>
        {sovPieData.length > 0 ? (
          <HighchartsReact highcharts={Highcharts} options={sovDonutOptions} />
        ) : (
          <div className="h-64 flex items-center justify-center text-[#757575]">
            No data available
          </div>
        )}
      </div>

      {/* Choice by LLM - Per-LLM Performance Metrics */}
      {filteredLlmPerformance.length > 0 && (
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-[#212121] mb-1">Choice by LLM</h3>
            <p className="text-sm text-[#757575]">How often {entity} is chosen as top recommendation by each LLM</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {filteredLlmPerformance.map((perf) => (
              <div
                key={perf.llm}
                className={`p-4 rounded-lg border ${
                  perf.llm === 'gemini'
                    ? 'border-[#4285F4] bg-[#E8F0FE]'
                    : 'border-[#10A37F] bg-[#E6F4F1]'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {perf.llm === 'gemini' ? (
                    <div className="w-8 h-8 rounded bg-[#4285F4] flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded bg-[#10A37F] flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="font-medium text-[#212121]">{perf.displayName || (perf.llm === 'gemini' ? 'Gemini' : 'ChatGPT')}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#757575]">Choice Rate</span>
                    <span className="text-lg font-semibold text-[#212121]">
                      {((perf.brandChoicePercent || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[#757575]">Questions Won</span>
                    <span className="text-sm font-medium text-[#212121]">
                      {perf.targetChosen || 0} / {perf.totalQuestions || 0}
                    </span>
                  </div>
                  {perf.topChoice && perf.topChoice !== entity && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#757575]">Top Choice</span>
                      <span className="text-sm font-medium text-[#E65100]">
                        {perf.topChoice}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <div key={entry.key} className="bg-[#E8F5E9] border border-[#4CAF50] rounded-lg p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#4CAF50] flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-medium text-[#212121]">{entry.question}</h4>
                      </div>
                      <div className="text-sm font-medium text-[#4CAF50]">
                        Chosen: {entity}
                      </div>
                    </div>

                    {/* Both LLMs agree - show both responses */}
                    {entry.bothAgree ? (
                      <div className="space-y-3">
                        {entry.gemini && (
                          <div className="bg-white border-l-4 border-[#4CAF50] p-4 rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded bg-[#4285F4] flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                              </div>
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
                          <div className="bg-white border-l-4 border-[#4CAF50] p-4 rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded bg-[#10A37F] flex items-center justify-center">
                                <MessageSquare className="w-3.5 h-3.5 text-white" />
                              </div>
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
                      <div className="bg-white border-l-4 border-[#4CAF50] p-4 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          {entry.llm === 'gemini' ? (
                            <div className="w-6 h-6 rounded bg-[#4285F4] flex items-center justify-center">
                              <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded bg-[#10A37F] flex items-center justify-center">
                              <MessageSquare className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
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
                        <div className="flex-shrink-0 px-3 py-1 bg-[#F5F5F5] rounded text-sm font-medium text-[#212121]">
                          Chosen: {entry.gemini?.chosenBrand || entry.openai?.chosenBrand}
                        </div>
                      ) : (
                        <div className="flex-shrink-0 px-3 py-1 bg-[#F5F5F5] rounded text-sm font-medium text-[#212121]">
                          Chosen: {entry.chosenBrand}
                        </div>
                      )}
                    </div>

                    {/* Both LLMs agree - show both responses */}
                    {entry.bothAgree ? (
                      <div className="space-y-3">
                        {entry.gemini && (
                          <div className="bg-[#FFEBEE] border-l-4 border-[#EF5350] p-4 rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded bg-[#4285F4] flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                              </div>
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
                          <div className="bg-[#FFEBEE] border-l-4 border-[#EF5350] p-4 rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded bg-[#10A37F] flex items-center justify-center">
                                <MessageSquare className="w-3.5 h-3.5 text-white" />
                              </div>
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
                      <div className="bg-[#FFEBEE] border-l-4 border-[#EF5350] p-4 rounded">
                        <div className="flex items-center gap-2 mb-2">
                          {entry.llm === 'gemini' ? (
                            <div className="w-6 h-6 rounded bg-[#4285F4] flex items-center justify-center">
                              <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded bg-[#10A37F] flex items-center justify-center">
                              <MessageSquare className="w-3.5 h-3.5 text-white" />
                            </div>
                          )}
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
