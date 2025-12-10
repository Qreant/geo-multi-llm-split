import React from 'react';
import { Check } from 'lucide-react';

export default function StepIndicator({ steps, currentStep, onStepClick }) {
  return (
    <div className="card-base">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = index <= currentStep;

          return (
            <React.Fragment key={step.id}>
              {/* Step */}
              <button
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                className={`flex flex-col items-center group ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                {/* Circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    text-sm font-medium transition-all duration-200
                    ${isCompleted
                      ? 'bg-[#10B981] text-white'
                      : isCurrent
                        ? 'bg-[#10B981] text-white ring-4 ring-[#10B981]/20'
                        : 'bg-[#E0E0E0] text-[#757575]'
                    }
                    ${isClickable && !isCurrent ? 'group-hover:ring-2 group-hover:ring-[#10B981]/30' : ''}
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Label */}
                <span
                  className={`
                    mt-2 text-xs font-medium transition-colors
                    ${isCurrent ? 'text-[#10B981]' : isCompleted ? 'text-[#212121]' : 'text-[#9E9E9E]'}
                  `}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-3">
                  <div
                    className={`
                      h-0.5 transition-colors duration-300
                      ${index < currentStep ? 'bg-[#10B981]' : 'bg-[#E0E0E0]'}
                    `}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
