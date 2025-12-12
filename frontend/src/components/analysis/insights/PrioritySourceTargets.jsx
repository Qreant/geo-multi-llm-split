import PropTypes from 'prop-types';
import { useState } from 'react';
import {
  ChevronDown, Eye, Flag, MessageSquare, Layers, Link, ExternalLink
} from 'lucide-react';

/**
 * Generate icon URL from domain using Google's favicon service
 */
function generateDomainIconUrl(domain) {
  if (!domain) return null;
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
  return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;
}

/**
 * Get initials from domain name
 */
function getDomainInitials(domain) {
  if (!domain) return '??';
  const parts = domain.replace(/\.(com|org|net|io|co|fr|it|de|uk|es).*$/, '').split('.');
  const name = parts[parts.length - 1] || parts[0];
  return name.substring(0, 2).toUpperCase();
}

/**
 * PrioritySourceTargets Component
 * Displays domain-centric priority targets with expandable details
 */
export default function PrioritySourceTargets({ sourceTargets }) {
  const [expandedDomains, setExpandedDomains] = useState(new Set());

  if (!sourceTargets) return null;

  const { domain_targets } = sourceTargets;

  const toggleDomain = (domain) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  const getPriorityBarColor = (score) => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 50) return 'bg-amber-500';
    if (score >= 30) return 'bg-blue-500';
    return 'bg-slate-400';
  };

  // Flatten all domains into a single sorted array
  const allDomains = [
    ...(domain_targets?.critical || []),
    ...(domain_targets?.high_priority || []),
    ...(domain_targets?.medium_priority || [])
  ].sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

  if (allDomains.length === 0) {
    return (
      <div className="bg-slate-50 rounded-lg p-8 text-center">
        <p className="text-slate-500">No priority source targets identified</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header Row */}
      <div className="grid grid-cols-[1fr_140px_100px_200px_40px] gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
        <span>Domain</span>
        <span className="text-center">Priority</span>
        <span className="text-center">Citations</span>
        <span>Impact Areas</span>
        <span></span>
      </div>

      {/* Domain Rows */}
      <div className="divide-y divide-slate-100">
        {allDomains.map((domain, idx) => {
          const isExpanded = expandedDomains.has(domain.domain);
          const visGaps = domain.visibility_gap_count || 0;
          const compLosses = domain.competitive_loss_count || 0;
          const repIssues = domain.reputation_impact_count || domain.negative_topics?.length || 0;
          const geminiCitations = domain.llm_citations?.gemini || 0;
          const openaiCitations = domain.llm_citations?.openai || 0;
          const isJournalism = domain.source_type === 'Journalism';

          return (
            <div key={idx}>
              {/* Collapsed Row */}
              <div
                className={`grid grid-cols-[1fr_140px_100px_200px_40px] gap-4 px-4 py-3 items-center cursor-pointer transition-colors ${
                  isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'
                }`}
                onClick={() => toggleDomain(domain.domain)}
              >
                {/* Domain Info */}
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold border ${
                    isJournalism
                      ? 'bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 border-blue-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    <img
                      src={generateDomainIconUrl(domain.domain)}
                      alt=""
                      className="w-5 h-5 object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerText = getDomainInitials(domain.domain);
                      }}
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{domain.domain}</div>
                    <div className="text-xs text-slate-500">
                      {domain.source_type}
                      {domain.is_high_authority && ' • High Authority'}
                    </div>
                  </div>
                </div>

                {/* Priority Score Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getPriorityBarColor(domain.priority_score)}`}
                      style={{ width: `${Math.min(domain.priority_score || 0, 100)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-700 w-7 text-right">
                    {domain.priority_score || 0}
                  </span>
                </div>

                {/* Citations */}
                <div className="text-center">
                  <div className="font-mono text-base font-semibold text-slate-800">
                    {domain.citation_count || domain.opportunity_count || 0}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">Citations</div>
                </div>

                {/* Impact Badges */}
                <div className="flex gap-1 flex-wrap">
                  {visGaps > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-violet-100 text-violet-700">
                      <Eye className="w-3 h-3" />
                      {visGaps}
                    </span>
                  )}
                  {compLosses > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700">
                      <Flag className="w-3 h-3" />
                      {compLosses}
                    </span>
                  )}
                  {repIssues > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
                      <MessageSquare className="w-3 h-3" />
                      {repIssues}
                    </span>
                  )}
                  {visGaps === 0 && compLosses === 0 && repIssues === 0 && (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>

                {/* Expand Button */}
                <button className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Expanded Detail Panel */}
              {isExpanded && (
                <div className="bg-slate-50 px-4 py-4 border-t border-slate-200">
                  {/* Top Row: 3 columns for issues + LLM citations */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    {/* Visibility Gaps */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-violet-100 text-violet-600">
                          <Eye className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                          Visibility Gaps
                        </span>
                        <span className="ml-auto font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          {visGaps}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {domain.visibility_gap_questions?.length > 0 ? (
                          domain.visibility_gap_questions.slice(0, 4).map((q, i) => (
                            <div key={i} className="bg-slate-50 rounded-md p-2 border-l-[3px] border-violet-500 text-xs text-slate-700">
                              <div className="line-clamp-2">{q.question}</div>
                              <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
                                {q.market && <span>{q.market}</span>}
                                {q.current_rank && <span>Rank #{q.current_rank}</span>}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 py-2">No visibility gaps</div>
                        )}
                      </div>
                    </div>

                    {/* Competitive Losses */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-amber-100 text-amber-600">
                          <Flag className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                          Competitive Losses
                        </span>
                        <span className="ml-auto font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          {compLosses}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {domain.competitive_loss_questions?.length > 0 ? (
                          domain.competitive_loss_questions.slice(0, 4).map((q, i) => (
                            <div key={i} className="bg-slate-50 rounded-md p-2 border-l-[3px] border-amber-500 text-xs text-slate-700">
                              <div className="line-clamp-2">{q.question}</div>
                              <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
                                {q.market && <span>{q.market}</span>}
                                {q.competitor_chosen && <span>Winner: {q.competitor_chosen}</span>}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 py-2">No competitive losses</div>
                        )}
                      </div>
                    </div>

                    {/* Reputation Issues */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-red-100 text-red-600">
                          <MessageSquare className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                          Reputation Issues
                        </span>
                        <span className="ml-auto font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          {repIssues}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-36 overflow-y-auto">
                        {domain.negative_topics?.length > 0 ? (
                          domain.negative_topics.slice(0, 4).map((topic, i) => (
                            <div key={i} className="bg-slate-50 rounded-md p-2 border-l-[3px] border-red-500 text-xs text-slate-700">
                              <div className="line-clamp-2">{topic}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-slate-400 py-2">No reputation issues</div>
                        )}
                      </div>
                    </div>

                    {/* LLM Citations */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-emerald-100 text-emerald-600">
                          <Layers className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                          LLM Citations
                        </span>
                      </div>
                      <div className="space-y-2">
                        {/* Gemini */}
                        <div className="flex items-center gap-3 bg-slate-50 rounded-md p-2">
                          <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center text-[9px] font-bold text-white">
                            G
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-medium text-slate-800">Gemini</div>
                          </div>
                          <span className="font-mono text-xs font-semibold text-slate-700">{geminiCitations}</span>
                        </div>
                        {/* OpenAI */}
                        <div className="flex items-center gap-3 bg-slate-50 rounded-md p-2">
                          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-[9px] font-bold text-white">
                            O
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-medium text-slate-800">OpenAI</div>
                          </div>
                          <span className="font-mono text-xs font-semibold text-slate-700">{openaiCitations}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Full-width URLs section */}
                  <div className="bg-white rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                      <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-100 text-blue-600">
                        <Link className="w-3 h-3" />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                        Cited URLs
                      </span>
                      <span className="ml-auto font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                        {domain.urls?.length || domain.url_count || 0}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {domain.urls?.length > 0 ? (
                        domain.urls.slice(0, 20).map((urlItem, i) => {
                          // Handle both old format (string) and new format (object with url, title, citation_count)
                          const url = typeof urlItem === 'string' ? urlItem : urlItem.url;
                          const title = typeof urlItem === 'object' ? urlItem.title : null;
                          const citationCount = typeof urlItem === 'object' ? urlItem.citation_count : 1;

                          // Extract path for display
                          let displayPath = url;
                          try {
                            const urlObj = new URL(url);
                            displayPath = urlObj.pathname + urlObj.search;
                            if (displayPath.length > 60) displayPath = displayPath.substring(0, 57) + '...';
                          } catch {
                            displayPath = url.substring(0, 60);
                          }

                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-start gap-2 bg-slate-50 hover:bg-blue-50 rounded-md p-2 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500" />
                              <div className="flex-1 min-w-0">
                                {title && (
                                  <div className="text-xs font-medium text-slate-700 group-hover:text-blue-700 truncate">
                                    {title}
                                  </div>
                                )}
                                <div className="text-[10px] text-slate-500 truncate">
                                  {displayPath}
                                </div>
                              </div>
                              {citationCount > 1 && (
                                <span className="flex-shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  ×{citationCount}
                                </span>
                              )}
                            </a>
                          );
                        })
                      ) : (
                        <div className="col-span-2 text-xs text-slate-400 py-2">No URLs recorded</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Get flag emoji for market code
 */
function getMarketFlag(market) {
  const flags = {
    'fr-FR': '🇫🇷',
    'it-IT': '🇮🇹',
    'en-US': '🇺🇸',
    'en-GB': '🇬🇧',
    'de-DE': '🇩🇪',
    'es-ES': '🇪🇸',
    'pt-BR': '🇧🇷',
    'ja-JP': '🇯🇵',
    'ko-KR': '🇰🇷',
    'zh-CN': '🇨🇳'
  };
  return flags[market] || '🌍';
}

PrioritySourceTargets.propTypes = {
  sourceTargets: PropTypes.shape({
    summary: PropTypes.shape({
      total_domains: PropTypes.number,
      total_urls: PropTypes.number,
      total_citations: PropTypes.number,
      critical_targets: PropTypes.number,
      high_priority_targets: PropTypes.number,
      high_authority_targets: PropTypes.number,
      multi_opportunity_domains: PropTypes.number,
      reputation_impact_domains: PropTypes.number,
      visibility_gap_domains: PropTypes.number,
      competitive_loss_domains: PropTypes.number
    }),
    domain_targets: PropTypes.shape({
      critical: PropTypes.array,
      high_priority: PropTypes.array,
      medium_priority: PropTypes.array
    }),
    url_targets: PropTypes.shape({
      top_priority: PropTypes.array
    }),
    high_authority_targets: PropTypes.array,
    outreach_recommendations: PropTypes.array
  })
};
