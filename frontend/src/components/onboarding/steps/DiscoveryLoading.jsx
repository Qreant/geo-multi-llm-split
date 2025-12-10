import React from 'react';
import { Loader, Search, Link2, CheckCircle, AlertCircle, RefreshCw, X } from 'lucide-react';

export default function DiscoveryLoading({ entity, markets, progress, error, onRetry, onCancel }) {
  const { current, total, message } = progress;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const getMarketStatus = (index) => {
    if (index < current - 1) return 'completed';
    if (index === current - 1) return 'in-progress';
    return 'pending';
  };

  return (
    <div className="card-base">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-[#E3F2FD] rounded-full flex items-center justify-center">
          <Search className="w-8 h-8 text-[#2196F3]" />
        </div>
        <h2 className="text-xl font-bold text-[#212121] mb-2">Discovering Categories</h2>
        <p className="text-[#757575]">
          Analyzing what <span className="font-medium text-[#212121]">{entity}</span> is known for across your markets...
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#757575]">{message}</span>
          <span className="font-medium text-[#212121]">{percentage}%</span>
        </div>
        <div className="h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#10B981] transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Market Progress List */}
      <div className="space-y-2 mb-6">
        {markets.map((market, index) => {
          const status = getMarketStatus(index);

          return (
            <div
              key={market.code}
              className={`
                flex items-center justify-between p-3 rounded-lg border transition-all duration-300
                ${status === 'completed'
                  ? 'bg-[#E8F5E9] border-[#4CAF50]/30'
                  : status === 'in-progress'
                    ? 'bg-[#E3F2FD] border-[#2196F3]/30'
                    : 'bg-[#F4F6F8] border-[#E0E0E0]'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {status === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-[#4CAF50]" />
                ) : status === 'in-progress' ? (
                  <Loader className="w-5 h-5 text-[#2196F3] animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[#E0E0E0]" />
                )}

                <span className={`font-medium ${status === 'pending' ? 'text-[#9E9E9E]' : 'text-[#212121]'}`}>
                  {market.country}
                </span>
                <span className="text-[#757575]">·</span>
                <span className="text-[#757575]">{market.language}</span>
              </div>

              {status === 'completed' && (
                <span className="text-xs text-[#4CAF50] font-medium">Done</span>
              )}
              {status === 'in-progress' && (
                <span className="text-xs text-[#2196F3] font-medium">Querying...</span>
              )}
            </div>
          );
        })}

        {/* Linking Step */}
        <div
          className={`
            flex items-center justify-between p-3 rounded-lg border transition-all duration-300
            ${current > markets.length
              ? 'bg-[#E8F5E9] border-[#4CAF50]/30'
              : current === markets.length
                ? 'bg-[#E3F2FD] border-[#2196F3]/30'
                : 'bg-[#F4F6F8] border-[#E0E0E0]'
            }
          `}
        >
          <div className="flex items-center gap-3">
            {current > markets.length ? (
              <CheckCircle className="w-5 h-5 text-[#4CAF50]" />
            ) : current === markets.length ? (
              <Loader className="w-5 h-5 text-[#2196F3] animate-spin" />
            ) : (
              <Link2 className="w-5 h-5 text-[#9E9E9E]" />
            )}

            <span className={`font-medium ${current < markets.length ? 'text-[#9E9E9E]' : 'text-[#212121]'}`}>
              Matching categories across languages
            </span>
          </div>

          {current > markets.length && (
            <span className="text-xs text-[#4CAF50] font-medium">Done</span>
          )}
          {current === markets.length && (
            <span className="text-xs text-[#2196F3] font-medium">Linking...</span>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#EF5350] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[#EF5350] font-medium">Discovery failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-[#EF5350] rounded font-medium hover:bg-red-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 text-[#757575] hover:bg-[#F4F6F8] rounded font-medium transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      {!error && (
        <div className="text-center text-sm text-[#9E9E9E]">
          This typically takes 15-20 seconds
        </div>
      )}
    </div>
  );
}
