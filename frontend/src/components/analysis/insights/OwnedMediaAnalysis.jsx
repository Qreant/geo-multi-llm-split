import PropTypes from 'prop-types';
import { AlertTriangle, Building2, Users, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

/**
 * OwnedMediaAnalysis Component
 * Displays analysis of owned media vs competitor media citations by LLMs
 */
export default function OwnedMediaAnalysis({ analysis, entity }) {
  const [expanded, setExpanded] = useState(false);

  if (!analysis) return null;

  const { summary, competitor_breakdown, opportunity } = analysis;

  // Don't show if no significant gap
  if (!summary?.has_significant_gap && !opportunity) return null;

  const gapPercentage = Math.round(summary?.coverage_gap_percentage || 0);
  const ownedCount = summary?.owned_media_citations || 0;
  const competitorCount = summary?.competitor_media_citations || 0;
  const totalQuestions = summary?.total_questions_analyzed || 0;
  const questionsWithoutOwned = summary?.questions_without_owned_media || 0;

  // Determine severity
  const severity = gapPercentage >= 80 ? 'critical' : gapPercentage >= 50 ? 'warning' : 'info';
  const severityColors = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' }
  };
  const colors = severityColors[severity];

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-lg overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-opacity-80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${severity === 'critical' ? 'bg-red-100' : severity === 'warning' ? 'bg-amber-100' : 'bg-blue-100'}`}>
            <AlertTriangle className={`w-5 h-5 ${colors.icon}`} />
          </div>
          <div className="text-left">
            <h3 className={`font-semibold ${colors.text}`}>
              Owned Media Gap Detected
            </h3>
            <p className="text-sm text-gray-600">
              Your website is not being cited by AI in {gapPercentage}% of questions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={`text-2xl font-bold ${colors.text}`}>{questionsWithoutOwned}</div>
            <div className="text-xs text-gray-500">questions without your site</div>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-white bg-opacity-50">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-500">Your Media Citations</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{ownedCount}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-gray-500">Competitor Citations</span>
              </div>
              <div className="text-xl font-bold text-gray-900">{competitorCount}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-xs text-gray-500">Coverage Gap</span>
              </div>
              <div className="text-xl font-bold text-red-600">{gapPercentage}%</div>
            </div>
          </div>

          {/* Competitor Breakdown */}
          {competitor_breakdown && Object.keys(competitor_breakdown).length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Competitor Media Being Cited</h4>
              <div className="space-y-2">
                {Object.entries(competitor_breakdown)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([competitor, count]) => (
                    <div key={competitor} className="flex items-center justify-between bg-white rounded p-2 border border-gray-200">
                      <span className="text-sm text-gray-700">{competitor}</span>
                      <span className="text-sm font-medium text-orange-600">{count} citations</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Opportunity Action */}
          {opportunity && (
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">{opportunity.title}</h4>
              <p className="text-sm text-gray-600 mb-3">{opportunity.description}</p>

              {opportunity.recommended_actions && opportunity.recommended_actions.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Recommended Actions</h5>
                  <ul className="space-y-1">
                    {opportunity.recommended_actions.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5">•</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Questions Sample */}
          {analysis.questions_without_owned_media && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Sample Questions Missing Your Website ({totalQuestions} total analyzed)
              </h4>
              <div className="space-y-2">
                {[
                  ...(analysis.questions_without_owned_media.visibility || []).slice(0, 2),
                  ...(analysis.questions_without_owned_media.competitive || []).slice(0, 2)
                ].slice(0, 4).map((q, idx) => (
                  <div key={idx} className="bg-gray-50 rounded p-2 text-sm text-gray-600 italic">
                    "{q.question}"
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

OwnedMediaAnalysis.propTypes = {
  analysis: PropTypes.shape({
    summary: PropTypes.shape({
      owned_media_citations: PropTypes.number,
      competitor_media_citations: PropTypes.number,
      coverage_gap_percentage: PropTypes.number,
      total_questions_analyzed: PropTypes.number,
      questions_without_owned_media: PropTypes.number,
      has_significant_gap: PropTypes.bool
    }),
    competitor_breakdown: PropTypes.object,
    opportunity: PropTypes.shape({
      title: PropTypes.string,
      description: PropTypes.string,
      recommended_actions: PropTypes.arrayOf(PropTypes.string)
    }),
    questions_without_owned_media: PropTypes.shape({
      visibility: PropTypes.array,
      competitive: PropTypes.array
    })
  }),
  entity: PropTypes.string
};
