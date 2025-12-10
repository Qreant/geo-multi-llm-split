import { Sparkles } from 'lucide-react';

/**
 * InsightsPlaceholder Component
 * Placeholder for future AI-powered insights feature
 */
export default function InsightsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-20 h-20 rounded-full bg-[#E3F2FD] flex items-center justify-center mb-6">
        <Sparkles className="w-10 h-10 text-[#2196F3]" />
      </div>

      <h3 className="text-xl font-medium text-[#212121] mb-3">
        AI-Powered Insights Coming Soon
      </h3>

      <p className="text-[#757575] text-center max-w-md mb-6">
        This section will provide actionable insights, trend analysis, and strategic recommendations
        based on your brand's reputation, visibility, and competitive positioning.
      </p>

      <div className="ai-summary max-w-lg">
        <p className="text-sm text-[#757575] italic text-center">
          Future features will include sentiment trend analysis, opportunity prioritization,
          competitive gap identification, and automated strategic recommendations.
        </p>
      </div>
    </div>
  );
}
