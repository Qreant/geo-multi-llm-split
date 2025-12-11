import React, { useState } from 'react';
import { Plus, X, Star, Globe, ArrowRight, HelpCircle } from 'lucide-react';

const COUNTRIES = [
  { value: 'United States', label: 'United States', flag: '🇺🇸' },
  { value: 'United Kingdom', label: 'United Kingdom', flag: '🇬🇧' },
  { value: 'Canada', label: 'Canada', flag: '🇨🇦' },
  { value: 'Australia', label: 'Australia', flag: '🇦🇺' },
  { value: 'France', label: 'France', flag: '🇫🇷' },
  { value: 'Germany', label: 'Germany', flag: '🇩🇪' },
  { value: 'Spain', label: 'Spain', flag: '🇪🇸' },
  { value: 'Italy', label: 'Italy', flag: '🇮🇹' },
  { value: 'Netherlands', label: 'Netherlands', flag: '🇳🇱' },
  { value: 'Belgium', label: 'Belgium', flag: '🇧🇪' },
  { value: 'Switzerland', label: 'Switzerland', flag: '🇨🇭' },
  { value: 'Austria', label: 'Austria', flag: '🇦🇹' },
  { value: 'Sweden', label: 'Sweden', flag: '🇸🇪' },
  { value: 'Norway', label: 'Norway', flag: '🇳🇴' },
  { value: 'Denmark', label: 'Denmark', flag: '🇩🇰' },
  { value: 'Finland', label: 'Finland', flag: '🇫🇮' },
  { value: 'Poland', label: 'Poland', flag: '🇵🇱' },
  { value: 'Portugal', label: 'Portugal', flag: '🇵🇹' },
  { value: 'Japan', label: 'Japan', flag: '🇯🇵' },
  { value: 'South Korea', label: 'South Korea', flag: '🇰🇷' },
  { value: 'China', label: 'China', flag: '🇨🇳' },
  { value: 'India', label: 'India', flag: '🇮🇳' },
  { value: 'Singapore', label: 'Singapore', flag: '🇸🇬' },
  { value: 'Brazil', label: 'Brazil', flag: '🇧🇷' },
  { value: 'Mexico', label: 'Mexico', flag: '🇲🇽' },
  { value: 'South Africa', label: 'South Africa', flag: '🇿🇦' },
  { value: 'UAE', label: 'UAE', flag: '🇦🇪' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia', flag: '🇸🇦' },
];

const LANGUAGES = [
  { value: 'English', label: 'English' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Dutch', label: 'Dutch' },
  { value: 'Swedish', label: 'Swedish' },
  { value: 'Norwegian', label: 'Norwegian' },
  { value: 'Danish', label: 'Danish' },
  { value: 'Finnish', label: 'Finnish' },
  { value: 'Polish', label: 'Polish' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Chinese', label: 'Chinese (Mandarin)' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Arabic', label: 'Arabic' },
];

function generateMarketCode(country, language) {
  const langCode = language.toLowerCase().slice(0, 2);
  const countryCode = country.replace(/\s+/g, '').slice(0, 2).toUpperCase();
  return `${langCode}-${countryCode}`;
}

export default function BrandMarketsStep({ entity: initialEntity, markets: initialMarkets, onComplete }) {
  const [entity, setEntity] = useState(initialEntity || '');
  const [markets, setMarkets] = useState(
    initialMarkets.length > 0
      ? initialMarkets
      : [] // Start with empty markets - user must add at least one
  );
  const [showAddMarket, setShowAddMarket] = useState(initialMarkets.length === 0); // Show add form by default if no markets
  const [newMarket, setNewMarket] = useState({ country: '', language: '' });

  const addMarket = () => {
    if (!newMarket.country || !newMarket.language) return;

    const code = generateMarketCode(newMarket.country, newMarket.language);

    // Check for duplicate
    if (markets.some(m => m.code === code)) {
      alert('This market already exists');
      return;
    }

    setMarkets(prev => [
      ...prev,
      {
        country: newMarket.country,
        language: newMarket.language,
        code,
        isPrimary: prev.length === 0
      }
    ]);
    setNewMarket({ country: '', language: '' });
    setShowAddMarket(false);
  };

  const removeMarket = (index) => {
    const removedWasPrimary = markets[index].isPrimary;
    const newMarkets = markets.filter((_, i) => i !== index);

    // If we removed the primary, make the first one primary
    if (removedWasPrimary && newMarkets.length > 0) {
      newMarkets[0].isPrimary = true;
    }

    setMarkets(newMarkets);

    // Show add form if no markets left
    if (newMarkets.length === 0) {
      setShowAddMarket(true);
    }
  };

  const setPrimaryMarket = (index) => {
    setMarkets(prev =>
      prev.map((m, i) => ({
        ...m,
        isPrimary: i === index
      }))
    );
  };

  const getCountryFlag = (countryName) => {
    const country = COUNTRIES.find(c => c.value === countryName);
    return country?.flag || '🌍';
  };

  const isValid = entity.trim() && markets.length > 0;

  return (
    <div className="space-y-6">
      {/* Entity Input */}
      <div className="card-base">
        <h3 className="text-lg font-bold text-[#212121] mb-4">What brand are you analyzing?</h3>
        <input
          type="text"
          className="w-full px-4 py-3 border border-[#E0E0E0] rounded-lg bg-white text-[#212121] text-base focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition"
          placeholder="e.g., Tesla, Nike, Airbnb"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          autoFocus
        />
      </div>

      {/* Markets */}
      <div className="card-base">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#212121]">Which markets do you want to analyze?</h3>
            <p className="text-sm text-[#757575] mt-1">Add country-language combinations for your analysis</p>
          </div>
          <Globe className="w-6 h-6 text-[#2196F3]" />
        </div>

        {/* Market List */}
        <div className="space-y-2 mb-4">
          {markets.map((market, index) => (
            <div
              key={market.code}
              className="flex items-center justify-between p-3 bg-[#F4F6F8] rounded-lg border border-[#E0E0E0]"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getCountryFlag(market.country)}</span>
                <div>
                  <span className="font-medium text-[#212121]">{market.country}</span>
                  <span className="text-[#757575] mx-2">·</span>
                  <span className="text-[#757575]">{market.language}</span>
                </div>
                {market.isPrimary && markets.length > 1 && (
                  <div className="relative group">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-[#FFF8E1] text-[#F57C00] text-xs font-medium rounded-full cursor-help">
                      <Star className="w-3 h-3" />
                      Primary
                      <HelpCircle className="w-3 h-3 opacity-60" />
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#212121] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-10">
                      Categories and competitors are entered in this language first, then translated to other markets
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#212121]"></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!market.isPrimary && markets.length > 1 && (
                  <button
                    onClick={() => setPrimaryMarket(index)}
                    className="p-1.5 text-[#757575] hover:text-[#F57C00] hover:bg-[#FFF8E1] rounded transition-colors"
                    title="Set as primary market"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => removeMarket(index)}
                  className="p-1.5 text-[#757575] hover:text-[#EF5350] hover:bg-red-50 rounded transition-colors"
                  title="Remove market"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Market */}
        {showAddMarket ? (
          <div className="p-4 bg-[#F4F6F8] rounded-lg border border-dashed border-[#E0E0E0]">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <select
                value={newMarket.country}
                onChange={(e) => setNewMarket(prev => ({ ...prev, country: e.target.value }))}
                className="px-3 py-2 border border-[#E0E0E0] rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
              >
                <option value="">Select country...</option>
                {COUNTRIES.map(c => (
                  <option key={c.value} value={c.value}>{c.flag} {c.label}</option>
                ))}
              </select>

              <select
                value={newMarket.language}
                onChange={(e) => setNewMarket(prev => ({ ...prev, language: e.target.value }))}
                className="px-3 py-2 border border-[#E0E0E0] rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
              >
                <option value="">Select language...</option>
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={addMarket}
                disabled={!newMarket.country || !newMarket.language}
                className="px-4 py-2 bg-[#10B981] text-white text-sm font-medium rounded hover:bg-[#059669] disabled:bg-[#E0E0E0] disabled:text-[#9E9E9E] transition-colors"
              >
                Add Market
              </button>
              <button
                onClick={() => {
                  setShowAddMarket(false);
                  setNewMarket({ country: '', language: '' });
                }}
                className="px-4 py-2 text-[#757575] text-sm font-medium hover:bg-white rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddMarket(true)}
            className="w-full p-3 border border-dashed border-[#E0E0E0] rounded-lg text-[#757575] hover:border-[#10B981] hover:text-[#10B981] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Market
          </button>
        )}
      </div>

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          onClick={() => onComplete(entity.trim(), markets)}
          disabled={!isValid}
          className="px-6 py-3 bg-[#10B981] text-white font-medium rounded-lg hover:bg-[#059669] disabled:bg-[#E0E0E0] disabled:text-[#9E9E9E] disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          Discover Categories
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
