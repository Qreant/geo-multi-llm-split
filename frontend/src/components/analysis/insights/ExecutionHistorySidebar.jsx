import PropTypes from 'prop-types';
import { X, CheckCircle, MessageSquare, RefreshCw, Clock } from 'lucide-react';

/**
 * ExecutionHistorySidebar Component
 * Slide-out panel showing execution history timeline
 */
export default function ExecutionHistorySidebar({ isOpen, onClose, history }) {
  if (!isOpen) return null;

  const getActionIcon = (actionType) => {
    switch (actionType?.toLowerCase()) {
      case 'implemented': return CheckCircle;
      case 'note': return MessageSquare;
      case 'update': return RefreshCw;
      default: return Clock;
    }
  };

  const getActionColor = (actionType) => {
    switch (actionType?.toLowerCase()) {
      case 'implemented': return 'text-green-500 bg-green-50';
      case 'note': return 'text-blue-500 bg-blue-50';
      case 'update': return 'text-orange-500 bg-orange-50';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 transform transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0]">
          <h2 className="text-lg font-medium text-[#212121]">
            Execution History
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#F5F5F5] rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[#757575]" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-full pb-20">
          {history && history.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-[#E0E0E0]" />

              {/* Timeline items */}
              <div className="space-y-1 p-4">
                {history.map((item, idx) => {
                  const Icon = getActionIcon(item.action_type);
                  const colorClass = getActionColor(item.action_type);

                  return (
                    <div key={idx} className="relative flex gap-4 pl-4">
                      {/* Icon */}
                      <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-[#F9FAFB] rounded-lg p-3 mb-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-medium text-[#757575] uppercase tracking-wider">
                              {item.action_type}
                            </span>
                            {item.opportunity_title && (
                              <h4 className="text-sm font-medium text-[#212121] mt-1">
                                {item.opportunity_title}
                              </h4>
                            )}
                          </div>
                          {item.priority_tier && (
                            <span className={`
                              text-xs px-2 py-0.5 rounded-full
                              ${item.priority_tier === 'Critical' ? 'bg-red-100 text-red-700' : ''}
                              ${item.priority_tier === 'Strategic' ? 'bg-orange-100 text-orange-700' : ''}
                              ${item.priority_tier === 'Quick Wins' ? 'bg-yellow-100 text-yellow-700' : ''}
                              ${item.priority_tier === 'Low Priority' ? 'bg-gray-100 text-gray-700' : ''}
                            `}>
                              {item.priority_tier}
                            </span>
                          )}
                        </div>

                        {item.action_description && (
                          <p className="text-sm text-[#424242] mt-2">
                            {item.action_description}
                          </p>
                        )}

                        {item.notes && (
                          <p className="text-sm text-[#757575] mt-2 italic">
                            Note: {item.notes}
                          </p>
                        )}

                        {item.outcome && (
                          <div className="mt-2">
                            <span className="text-xs font-medium text-[#757575]">Outcome: </span>
                            <span className="text-xs text-[#424242]">{item.outcome}</span>
                          </div>
                        )}

                        <div className="text-xs text-[#9E9E9E] mt-2">
                          {formatDate(item.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-[#757575]">
              <Clock className="w-12 h-12 text-[#E0E0E0] mb-4" />
              <p className="text-sm">No execution history yet</p>
              <p className="text-xs text-[#9E9E9E] mt-1">
                Actions taken on opportunities will appear here
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

ExecutionHistorySidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  history: PropTypes.arrayOf(
    PropTypes.shape({
      action_type: PropTypes.string,
      action_description: PropTypes.string,
      outcome: PropTypes.string,
      notes: PropTypes.string,
      opportunity_title: PropTypes.string,
      priority_tier: PropTypes.string,
      created_at: PropTypes.string
    })
  )
};
