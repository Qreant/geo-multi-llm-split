import PropTypes from 'prop-types';
import { useState } from 'react';
import {
  ChevronDown, ChevronUp, CheckCircle, ExternalLink,
  AlertCircle, Target, Zap, Clock, TrendingUp
} from 'lucide-react';
import ExpectedImpactBadge from './ExpectedImpactBadge';
import CollaborationRecommendations from './CollaborationRecommendations';

/**
 * OpportunityCard Component
 * Expandable card displaying opportunity details
 */
export default function OpportunityCard({
  opportunity,
  isSelected,
  onSelect,
  onImplement
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getPriorityConfig = (tier) => {
    switch (tier) {
      case 'Critical':
        return {
          icon: AlertCircle,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-700',
          badgeColor: 'bg-red-100'
        };
      case 'Strategic':
        return {
          icon: Target,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-700',
          badgeColor: 'bg-orange-100'
        };
      case 'Quick Wins':
        return {
          icon: Zap,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-700',
          badgeColor: 'bg-yellow-100'
        };
      case 'Low Priority':
      default:
        return {
          icon: Clock,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-700',
          badgeColor: 'bg-gray-100'
        };
    }
  };

  const config = getPriorityConfig(opportunity.priority?.tier);
  const Icon = config.icon;

  const formatScore = (score) => {
    if (!score && score !== 0) return '-';
    return `${Math.round(score * 100)}%`;
  };

  return (
    <div
      className={`
        bg-white border-2 rounded-lg transition-all
        ${isSelected ? 'border-[#1976D2] shadow-md' : config.borderColor}
        ${opportunity.is_implemented ? 'opacity-60' : ''}
      `}
    >
      {/* Header */}
      <div
        className={`flex items-start gap-3 p-4 cursor-pointer ${config.bgColor}`}
        onClick={() => {
          onSelect(opportunity.id);
          setIsExpanded(!isExpanded);
        }}
      >
        {/* Priority Icon */}
        <div className={`p-2 rounded-lg ${config.badgeColor}`}>
          <Icon className={`w-5 h-5 ${config.textColor}`} />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium ${config.textColor} uppercase tracking-wider`}>
                  {opportunity.priority?.tier}
                </span>
              </div>
              <h4 className="font-medium text-[#212121] leading-tight">
                {opportunity.title}
              </h4>
            </div>

            {opportunity.is_implemented && (
              <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                <CheckCircle className="w-3 h-3" />
                Implemented
              </div>
            )}
          </div>

          {/* Description */}
          {opportunity.description && (
            <p className="text-sm text-[#757575] mt-2 line-clamp-2">
              {opportunity.description}
            </p>
          )}

          {/* Competitor being favored - shown for competitive gaps */}
          {opportunity.competitor_analysis?.top_ranked_entity && (
            <div className="flex items-center gap-1 mt-2">
              <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs text-orange-700">
                Favoring <span className="font-medium">{opportunity.competitor_analysis.top_ranked_entity}</span>
              </span>
            </div>
          )}

          {/* Scores */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-[#757575]">
                Impact: <span className="font-medium text-[#212121]">{formatScore(opportunity.scores?.impact_score)}</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-[#757575]">
                Effort: <span className="font-medium text-[#212121]">{formatScore(opportunity.scores?.effort_score)}</span>
              </span>
            </div>
          </div>

          {/* Expected Impact Badges */}
          <div className="mt-3">
            <ExpectedImpactBadge impact={opportunity.expected_impact} size="sm" />
          </div>
        </div>

        {/* Expand Button */}
        <button className="p-1 hover:bg-white hover:bg-opacity-50 rounded transition-colors">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[#757575]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#757575]" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 border-t border-[#E0E0E0] space-y-6">
          {/* Current State */}
          {opportunity.current_state && Object.keys(opportunity.current_state).length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-[#212121] mb-2">Current State</h5>
              <div className="bg-[#F9FAFB] rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {opportunity.current_state.metric && (
                    <div>
                      <span className="text-[#757575]">Metric: </span>
                      <span className="text-[#212121]">{opportunity.current_state.metric}</span>
                    </div>
                  )}
                  {opportunity.current_state.frequency && (
                    <div>
                      <span className="text-[#757575]">Frequency: </span>
                      <span className="text-[#212121]">{Math.round(opportunity.current_state.frequency * 100)}%</span>
                    </div>
                  )}
                  {opportunity.current_state.rank && (
                    <div>
                      <span className="text-[#757575]">Rank: </span>
                      <span className="text-[#212121]">#{opportunity.current_state.rank}</span>
                    </div>
                  )}
                  {opportunity.current_state.sentiment_score !== undefined && (
                    <div>
                      <span className="text-[#757575]">Sentiment: </span>
                      <span className="text-[#212121]">{opportunity.current_state.sentiment_score?.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Competitor Analysis */}
          {opportunity.competitor_analysis && (
            <div>
              <h5 className="text-sm font-medium text-[#212121] mb-2">Competitor Analysis</h5>
              <div className="bg-[#FFF3E0] rounded-lg p-3 text-sm">
                <div className="font-medium text-[#E65100]">
                  {opportunity.competitor_analysis.top_ranked_entity}
                </div>
                {opportunity.competitor_analysis.why_they_win && (
                  <p className="text-[#757575] mt-1">
                    {opportunity.competitor_analysis.why_they_win}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {opportunity.recommended_actions?.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-[#212121] mb-2">Recommended Actions</h5>
              <ul className="space-y-2">
                {opportunity.recommended_actions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-[#1976D2] font-bold">{idx + 1}.</span>
                    <span className="text-[#424242]">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence */}
          {opportunity.evidence?.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-[#212121] mb-2">Evidence</h5>
              <div className="space-y-2">
                {opportunity.evidence.slice(0, 3).map((ev, idx) => (
                  <div key={idx} className="bg-[#F5F5F5] rounded p-2 text-sm">
                    <span className="text-xs text-[#757575] uppercase">{ev.type}</span>
                    <p className="text-[#424242] mt-0.5">{ev.text}</p>
                    {ev.source_url && (
                      <a
                        href={ev.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#1976D2] hover:underline flex items-center gap-1 mt-1"
                      >
                        {ev.source_title || 'Source'}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Collaboration Recommendations */}
          {opportunity.ai_collaboration_recommendations && (
            <CollaborationRecommendations
              recommendations={opportunity.ai_collaboration_recommendations}
            />
          )}

          {/* Sources */}
          {opportunity.sources?.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-[#212121] mb-2">Sources</h5>
              <div className="flex flex-wrap gap-2">
                {opportunity.sources.slice(0, 5).map((source, idx) => (
                  <a
                    key={idx}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-[#E3F2FD] text-[#1976D2] text-xs rounded hover:bg-[#BBDEFB] transition-colors"
                  >
                    {source.domain || source.title || 'Source'}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          {!opportunity.is_implemented && (
            <div className="pt-4 border-t border-[#E0E0E0]">
              <button
                onClick={() => onImplement(opportunity.id)}
                className="w-full py-2 px-4 bg-[#1976D2] text-white text-sm font-medium rounded-lg hover:bg-[#1565C0] transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Implemented
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

OpportunityCard.propTypes = {
  opportunity: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    opportunity_type: PropTypes.string,
    theme_category: PropTypes.string,
    current_state: PropTypes.object,
    competitor_analysis: PropTypes.object,
    scores: PropTypes.shape({
      impact_score: PropTypes.number,
      effort_score: PropTypes.number
    }),
    priority: PropTypes.shape({
      tier: PropTypes.string
    }),
    recommended_actions: PropTypes.arrayOf(PropTypes.string),
    ai_collaboration_recommendations: PropTypes.object,
    evidence: PropTypes.arrayOf(PropTypes.object),
    sources: PropTypes.arrayOf(PropTypes.object),
    expected_impact: PropTypes.object,
    is_implemented: PropTypes.number
  }).isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onImplement: PropTypes.func.isRequired
};
