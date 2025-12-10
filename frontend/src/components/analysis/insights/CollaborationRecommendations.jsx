import PropTypes from 'prop-types';
import { Users, Globe, Target, FileText, ExternalLink } from 'lucide-react';

/**
 * CollaborationRecommendations Component
 * Displays AI-generated collaboration suggestions in a table format
 */
export default function CollaborationRecommendations({ recommendations }) {
  if (!recommendations || !recommendations.collaborations?.length) {
    return null;
  }

  const { collaborations, pitch_strategy, content_ideas } = recommendations;

  const getTargetIcon = (targetType) => {
    switch (targetType?.toLowerCase()) {
      case 'journalist': return FileText;
      case 'academic': return Globe;
      case 'influencer': return Users;
      default: return Target;
    }
  };

  return (
    <div className="space-y-6">
      {/* Collaboration Targets */}
      <div>
        <h4 className="text-sm font-medium text-[#212121] mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#1976D2]" />
          AI Collaboration Recommendations
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5F5F5] text-left">
                <th className="px-3 py-2 font-medium text-[#757575]">Target Type</th>
                <th className="px-3 py-2 font-medium text-[#757575]">Description</th>
                <th className="px-3 py-2 font-medium text-[#757575]">Pitch Angle</th>
                <th className="px-3 py-2 font-medium text-[#757575]">Domains</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {collaborations.map((collab, idx) => {
                const Icon = getTargetIcon(collab.target_type);

                return (
                  <tr key={idx} className="hover:bg-[#FAFAFA]">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[#757575]" />
                        <span className="font-medium text-[#212121]">
                          {collab.target_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[#757575] max-w-xs">
                      {collab.target_description}
                    </td>
                    <td className="px-3 py-3 text-[#424242] max-w-sm">
                      {collab.pitch_angle}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {collab.domains_to_target?.slice(0, 3).map((domain, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                          >
                            {domain}
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pitch Strategy */}
      {pitch_strategy && (
        <div className="bg-[#F9FAFB] rounded-lg p-4">
          <h5 className="text-sm font-medium text-[#212121] mb-3">
            Pitch Strategy
          </h5>

          {pitch_strategy.primary_narrative && (
            <div className="mb-3">
              <span className="text-xs font-medium text-[#757575] uppercase tracking-wider">
                Primary Narrative
              </span>
              <p className="text-sm text-[#424242] mt-1">
                {pitch_strategy.primary_narrative}
              </p>
            </div>
          )}

          {pitch_strategy.key_differentiators?.length > 0 && (
            <div className="mb-3">
              <span className="text-xs font-medium text-[#757575] uppercase tracking-wider">
                Key Differentiators
              </span>
              <ul className="mt-1 space-y-1">
                {pitch_strategy.key_differentiators.map((diff, i) => (
                  <li key={i} className="text-sm text-[#424242] flex items-start gap-2">
                    <span className="text-[#1976D2]">•</span>
                    {diff}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pitch_strategy.timing_recommendations && (
            <div>
              <span className="text-xs font-medium text-[#757575] uppercase tracking-wider">
                Timing
              </span>
              <p className="text-sm text-[#424242] mt-1">
                {pitch_strategy.timing_recommendations}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Content Ideas */}
      {content_ideas?.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-[#212121] mb-3">
            Content Ideas
          </h5>
          <div className="grid gap-3">
            {content_ideas.map((idea, idx) => (
              <div
                key={idx}
                className="border border-[#E0E0E0] rounded-lg p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="px-2 py-0.5 bg-[#E3F2FD] text-[#1976D2] text-xs font-medium rounded">
                    {idea.type}
                  </span>
                  <div className="flex-1">
                    <h6 className="font-medium text-[#212121] text-sm">
                      {idea.title_suggestion}
                    </h6>
                    {idea.target_publications?.length > 0 && (
                      <div className="mt-1 text-xs text-[#757575]">
                        Target: {idea.target_publications.join(', ')}
                      </div>
                    )}
                    {idea.key_takeaways?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {idea.key_takeaways.map((takeaway, i) => (
                          <li key={i} className="text-xs text-[#424242] flex items-start gap-1">
                            <span className="text-green-500">✓</span>
                            {takeaway}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

CollaborationRecommendations.propTypes = {
  recommendations: PropTypes.shape({
    collaborations: PropTypes.arrayOf(
      PropTypes.shape({
        target_type: PropTypes.string,
        target_description: PropTypes.string,
        pitch_angle: PropTypes.string,
        domains_to_target: PropTypes.arrayOf(PropTypes.string)
      })
    ),
    pitch_strategy: PropTypes.shape({
      primary_narrative: PropTypes.string,
      key_differentiators: PropTypes.arrayOf(PropTypes.string),
      timing_recommendations: PropTypes.string
    }),
    content_ideas: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string,
        title_suggestion: PropTypes.string,
        target_publications: PropTypes.arrayOf(PropTypes.string),
        key_takeaways: PropTypes.arrayOf(PropTypes.string)
      })
    )
  })
};
