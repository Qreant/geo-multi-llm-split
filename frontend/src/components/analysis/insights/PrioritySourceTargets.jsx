import PropTypes from 'prop-types';
import { useState } from 'react';
import {
  Globe, ExternalLink, ChevronDown, ChevronUp,
  AlertCircle, Users, FileText, HelpCircle
} from 'lucide-react';

/**
 * Generate icon URL from domain using Google's favicon service
 */
function generateDomainIconUrl(domain) {
  if (!domain) return null;
  // Clean the domain
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
  return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;
}

/**
 * PrioritySourceTargets Component
 * Displays domain and URL-level priority targets for PR outreach
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

  const getPriorityColor = (score) => {
    // Distinct colors for each priority level
    if (score >= 70) return { bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', border: 'border-[#FEE2E2]' }; // Critical - red
    if (score >= 50) return { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]', border: 'border-[#FEF3C7]' }; // High - amber/orange
    if (score >= 30) return { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#DBEAFE]' }; // Medium - blue
    return { bg: 'bg-[#F8FAFC]', text: 'text-[#64748B]', border: 'border-[#F1F5F9]' }; // Low - gray
  };

  const getSourceTypeIcon = (sourceType) => {
    switch (sourceType) {
      case 'Journalism': return FileText;
      case 'Academic/Research': return Globe;
      case 'Government/NGO': return Users;
      default: return Globe;
    }
  };

  const DomainCard = ({ domain, showUrls = true }) => {
    const colors = getPriorityColor(domain.priority_score);
    const isExpanded = expandedDomains.has(domain.domain);
    const Icon = getSourceTypeIcon(domain.source_type);

    // Get LLM citation breakdown
    const geminiCitations = domain.llm_citations?.gemini || 0;
    const openaiCitations = domain.llm_citations?.openai || 0;
    const hasLlmBreakdown = geminiCitations > 0 || openaiCitations > 0;

    // Get breakdown scores
    const scores = domain.scores || {};
    const hasScores = scores.reputation_impact !== undefined || scores.visibility_gap !== undefined;

    return (
      <div className={`border ${colors.border} rounded-lg overflow-hidden`}>
        <div
          className={`${colors.bg} p-4 cursor-pointer`}
          onClick={() => toggleDomain(domain.domain)}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-1.5 rounded-lg ${colors.bg} flex items-center justify-center`}>
                {domain.icon_url || generateDomainIconUrl(domain.domain) ? (
                  <img
                    src={domain.icon_url || generateDomainIconUrl(domain.domain)}
                    alt=""
                    className="w-10 h-10 object-contain rounded"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'block';
                    }}
                  />
                ) : null}
                <Icon
                  className={`w-10 h-10 ${colors.text}`}
                  style={{ display: (domain.icon_url || generateDomainIconUrl(domain.domain)) ? 'none' : 'block' }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-[#212121]">{domain.domain}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} flex items-center gap-1`}>
                    Score: {domain.priority_score}
                    <span className="relative group overflow-visible">
                      <HelpCircle className="w-3 h-3 opacity-60 hover:opacity-100 cursor-help" />
                      <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-[#424242] text-white text-xs rounded-lg w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] shadow-lg pointer-events-none">
                        <span className="block">Calculated using a weighted mix of reputation impact, visibility gaps, competitive positioning, and domain authority.</span>
                        <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#424242]"></span>
                      </span>
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#757575] flex-wrap">
                  <span>{domain.source_type}</span>
                  <span>•</span>
                  <span>{domain.citation_count || domain.opportunity_count} citations</span>
                  {domain.reputation_impact_count > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-pink-600">{domain.reputation_impact_count} reputation impacts</span>
                    </>
                  )}
                  {domain.visibility_gap_count > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-orange-600">{domain.visibility_gap_count} visibility gaps</span>
                    </>
                  )}
                  {domain.competitive_loss_count > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-red-600">{domain.competitive_loss_count} competitive losses</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{domain.url_count} URLs</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {domain.is_high_authority && (
                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                  High Authority
                </span>
              )}
              {showUrls && (domain.urls?.length > 0 || domain.visibility_gap_questions?.length > 0 || domain.competitive_loss_questions?.length > 0) && (
                isExpanded ? <ChevronUp className="w-5 h-5 text-[#757575]" /> : <ChevronDown className="w-5 h-5 text-[#757575]" />
              )}
            </div>
          </div>

          {/* LLM Citation Breakdown */}
          {hasLlmBreakdown && (
            <div className="mt-3 flex items-center gap-4 text-xs">
              <span className="text-[#757575]">Cited by:</span>
              {geminiCitations > 0 && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Gemini ({geminiCitations})
                </span>
              )}
              {openaiCitations > 0 && (
                <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  ChatGPT ({openaiCitations})
                </span>
              )}
            </div>
          )}

          {/* Breakdown Scores */}
          {hasScores && (
            <div className="mt-3 flex flex-wrap gap-2">
              {scores.reputation_impact > 0 && (
                <div className="text-xs px-2 py-1 bg-pink-50 text-pink-700 rounded flex items-center gap-1">
                  <span className="font-medium">Rep:</span>
                  <span>{Math.round(scores.reputation_impact * 100)}%</span>
                </div>
              )}
              {scores.visibility_gap > 0 && (
                <div className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded flex items-center gap-1">
                  <span className="font-medium">Vis:</span>
                  <span>{Math.round(scores.visibility_gap * 100)}%</span>
                </div>
              )}
              {scores.competitive_loss > 0 && (
                <div className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded flex items-center gap-1">
                  <span className="font-medium">Comp:</span>
                  <span>{Math.round(scores.competitive_loss * 100)}%</span>
                </div>
              )}
              {scores.source_authority > 0 && (
                <div className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded flex items-center gap-1">
                  <span className="font-medium">Auth:</span>
                  <span>{Math.round(scores.source_authority * 100)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Negative Topics (Reputation) */}
          {domain.negative_topics?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              <span className="text-xs text-pink-700 font-medium">Negative topics:</span>
              {domain.negative_topics.slice(0, 3).map((topic, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-pink-50 text-pink-600 rounded">
                  {topic}
                </span>
              ))}
              {domain.negative_topics.length > 3 && (
                <span className="text-xs text-pink-500">+{domain.negative_topics.length - 3} more</span>
              )}
            </div>
          )}

          {/* Opportunity types and competitor context */}
          <div className="mt-3 flex flex-wrap gap-2">
            {domain.opportunity_types?.map((type, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-white bg-opacity-60 rounded text-[#424242]">
                {type}
              </span>
            ))}
            {domain.top_competitor && (
              <span className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Favoring {domain.top_competitor}
              </span>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="bg-white border-t border-[#E0E0E0]">
            {/* Visibility Gap Questions */}
            {domain.visibility_gap_questions?.length > 0 && (
              <div className="p-4 border-b border-[#E0E0E0]">
                <h5 className="text-xs font-medium text-orange-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  Visibility Gap Questions ({domain.visibility_gap_questions.length})
                </h5>
                <div className="space-y-3">
                  {domain.visibility_gap_questions.map((q, i) => (
                    <div key={i} className="bg-orange-50 rounded-lg p-3">
                      <p className="text-sm text-[#424242] font-medium">{q.question}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#757575]">
                        {q.current_rank && (
                          <span className="px-2 py-0.5 bg-white rounded">
                            Current rank: #{q.current_rank}
                          </span>
                        )}
                        {q.top_competitor && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                            #1: {q.top_competitor}
                          </span>
                        )}
                      </div>
                      {q.why_they_win && (
                        <p className="text-xs text-[#757575] mt-2 italic">
                          Why they rank: {q.why_they_win.length > 100 ? q.why_they_win.substring(0, 100) + '...' : q.why_they_win}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Competitive Loss Questions */}
            {domain.competitive_loss_questions?.length > 0 && (
              <div className="p-4 border-b border-[#E0E0E0]">
                <h5 className="text-xs font-medium text-red-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  Competitive Loss Questions ({domain.competitive_loss_questions.length})
                </h5>
                <div className="space-y-3">
                  {domain.competitive_loss_questions.map((q, i) => (
                    <div key={i} className="bg-red-50 rounded-lg p-3">
                      <p className="text-sm text-[#424242] font-medium">{q.question}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        {q.competitor_chosen && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded">
                            Lost to: {q.competitor_chosen}
                          </span>
                        )}
                      </div>
                      {q.why_chosen && (
                        <p className="text-xs text-[#757575] mt-2 italic">
                          Why: {q.why_chosen.length > 100 ? q.why_chosen.substring(0, 100) + '...' : q.why_chosen}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Specific URLs */}
            {domain.urls?.length > 0 && (
              <div className="p-4">
                <h5 className="text-xs font-medium text-[#757575] uppercase tracking-wider mb-3">
                  Specific Articles ({domain.urls.length})
                </h5>
                <div className="space-y-2">
                  {domain.urls.slice(0, 10).map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-[#1976D2] hover:text-[#1565C0] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{url}</span>
                    </a>
                  ))}
                  {domain.urls.length > 10 && (
                    <p className="text-xs text-[#9E9E9E]">+{domain.urls.length - 10} more URLs</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  DomainCard.propTypes = {
    domain: PropTypes.object.isRequired,
    showUrls: PropTypes.bool
  };

  const UrlCard = ({ urlData }) => {
    const colors = getPriorityColor(urlData.priority_score);

    return (
      <div className={`border ${colors.border} rounded-lg p-4 ${colors.bg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium flex items-center gap-1`}>
                Score: {urlData.priority_score}
                <span className="relative group overflow-visible">
                  <HelpCircle className="w-3 h-3 opacity-60 hover:opacity-100 cursor-help" />
                  <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-[#424242] text-white text-xs rounded-lg w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] shadow-lg pointer-events-none">
                    <span className="block">Calculated using a weighted mix of reputation impact, visibility gaps, competitive positioning, and domain authority.</span>
                    <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#424242]"></span>
                  </span>
                </span>
              </span>
              <span className="text-xs text-[#757575]">{urlData.source_type}</span>
            </div>
            <a
              href={urlData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#1976D2] hover:text-[#1565C0] hover:underline flex items-center gap-1"
            >
              <span className="truncate">{urlData.title || urlData.url}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
            <p className="text-xs text-[#757575] mt-1">{urlData.domain}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold text-[#212121]">{urlData.opportunity_count}</div>
            <div className="text-xs text-[#757575]">opportunities</div>
          </div>
        </div>
        {urlData.top_competitor && (
          <div className="mt-2 text-xs text-orange-700 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Currently favoring {urlData.top_competitor}
          </div>
        )}
      </div>
    );
  };

  UrlCard.propTypes = {
    urlData: PropTypes.object.isRequired
  };

  return (
    <div className="space-y-4">
      {/* Critical Targets */}
      {domain_targets?.critical?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[#DC2626] mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Critical Targets (Score 70+)
          </h4>
          <div className="space-y-3">
            {domain_targets.critical.map((domain, i) => (
              <DomainCard key={i} domain={domain} />
            ))}
          </div>
        </div>
      )}

      {/* High Priority */}
      {domain_targets?.high_priority?.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-[#D97706] mb-3">
            High Priority (Score 50-69)
          </h4>
          <div className="space-y-3">
            {domain_targets.high_priority.map((domain, i) => (
              <DomainCard key={i} domain={domain} />
            ))}
          </div>
        </div>
      )}

      {/* Medium Priority */}
      {domain_targets?.medium_priority?.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-[#2563EB] mb-3">
            Medium Priority (Score 30-49)
          </h4>
          <div className="space-y-3">
            {domain_targets.medium_priority.slice(0, 5).map((domain, i) => (
              <DomainCard key={i} domain={domain} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
