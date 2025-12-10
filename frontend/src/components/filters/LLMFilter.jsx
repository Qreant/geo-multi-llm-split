import { Sparkles, MessageSquare } from 'lucide-react';

/**
 * LLMFilter Component
 * Allows users to filter analysis data by LLM provider (Gemini, ChatGPT)
 * Multiple selections allowed - clicking toggles each LLM
 */
export default function LLMFilter({ selectedLLMs, onToggle }) {
  const llms = [
    {
      id: 'gemini',
      name: 'Gemini',
      icon: Sparkles,
      color: '#4285F4',
      bgColor: '#E8F0FE'
    },
    {
      id: 'openai',
      name: 'ChatGPT',
      icon: MessageSquare,
      color: '#10A37F',
      bgColor: '#E6F4F1'
    }
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#757575] mr-1">Filter by:</span>
      {llms.map((llm) => {
        const isSelected = selectedLLMs.includes(llm.id);
        const Icon = llm.icon;

        return (
          <button
            key={llm.id}
            onClick={() => onToggle(llm.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isSelected
                ? 'shadow-sm'
                : 'opacity-40 hover:opacity-70'
            }`}
            style={{
              backgroundColor: isSelected ? llm.bgColor : '#F5F5F5',
              color: isSelected ? llm.color : '#9E9E9E'
            }}
            title={`${isSelected ? 'Hide' : 'Show'} ${llm.name} results`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{llm.name}</span>
          </button>
        );
      })}
    </div>
  );
}
