import { useMemo, useState } from 'react';
import { X, Check, ExternalLink, ChevronRight, Lightbulb, Crown, DollarSign, Star, Leaf, Palette, Zap, Users } from 'lucide-react';

/**
 * Dimension configuration with keywords for attribute mapping
 * Keywords are ordered by specificity - more specific phrases first
 * The matching function uses multi-word phrases before single words
 */
const DIMENSION_CONFIG = {
  'Quality': {
    // Quality keywords - includes reliability, build quality, durability
    keywords: [
      'build quality', 'quality issues', 'quality concerns', 'unreliable', 'reliability', 'reliable',
      'durability', 'durable', 'craftsmanship', 'well-made', 'poorly made', 'defect', 'defects',
      'materials', 'construction', 'lasting', 'longevity', 'breakdown', 'repair', 'repairs',
      'maintenance', 'warranty claims', 'recalls', 'faulty'
    ],
    icon: Star,
    color: '#FF9800',
    proBadge: 'Quality Leader',
    conBadge: 'Quality Concerns'
  },
  'Innovation': {
    keywords: [
      'innovation', 'innovative', 'r&d', 'research and development', 'technology', 'technological',
      'cutting-edge', 'advanced', 'pioneer', 'pioneering', 'breakthrough', 'research', 'tech',
      'autopilot', 'autonomous', 'ai', 'software', 'electric', 'ev technology', 'battery tech'
    ],
    icon: Lightbulb,
    color: '#2196F3',
    proBadge: 'Innovation Leader',
    conBadge: 'Innovation Gap'
  },
  'Pricing': {
    // Pricing keywords - cost, value, affordability
    keywords: [
      'price point', 'pricing', 'overpriced', 'expensive', 'affordable', 'affordability',
      'value for money', 'cost-effective', 'budget', 'cheap', 'premium price', 'high cost',
      'insurance premium', 'insurance cost', 'total cost', 'ownership cost', 'resale value'
    ],
    icon: DollarSign,
    color: '#4CAF50',
    proBadge: 'Great Value',
    conBadge: 'Premium Priced'
  },
  'Market Position': {
    // Market position - market share, leadership, dominance
    keywords: [
      'market share', 'market leader', 'market position', 'dominant', 'dominance', 'leading',
      'leader in', 'top seller', 'best-selling', 'popular', 'popularity', 'sales volume',
      'growth', 'expansion', 'presence'
    ],
    icon: Crown,
    color: '#9C27B0',
    proBadge: 'Market Leader',
    conBadge: 'Market Challenger'
  },
  'Brand Reputation': {
    // Brand reputation - trust, perception, image (NOT market position)
    keywords: [
      'brand reputation', 'brand image', 'brand perception', 'trusted brand', 'brand trust',
      'prestige', 'prestigious', 'elite', 'exclusive', 'heritage', 'legacy', 'iconic',
      'controversy', 'controversial', 'public image', 'media coverage', 'sentiment'
    ],
    icon: Crown,
    color: '#673AB7',
    proBadge: 'Trusted Brand',
    conBadge: 'Reputation Concerns'
  },
  'Sustainability': {
    keywords: [
      'sustainable', 'sustainability', 'eco-friendly', 'environmentally', 'environment',
      'green', 'recycled', 'carbon footprint', 'carbon neutral', 'ethical', 'organic',
      'responsible', 'emissions', 'zero emission', 'renewable', 'clean energy'
    ],
    icon: Leaf,
    color: '#00BCD4',
    proBadge: 'Eco-Friendly',
    conBadge: 'Sustainability Gap'
  },
  'Design': {
    keywords: [
      'design', 'aesthetic', 'aesthetics', 'fashionable', 'trendy', 'stylish', 'style',
      'look', 'appearance', 'sleek', 'modern', 'attractive', 'beautiful', 'interior',
      'exterior', 'minimalist', 'futuristic'
    ],
    icon: Palette,
    color: '#E91E63',
    proBadge: 'Design Leader',
    conBadge: 'Design Issues'
  },
  'Performance': {
    keywords: [
      'performance', 'speed', 'acceleration', 'range', 'horsepower', 'torque', 'handling',
      'driving experience', 'comfort', 'ride quality', 'efficiency', 'fuel economy',
      'battery range', 'charging', 'fast charging', 'power'
    ],
    icon: Zap,
    color: '#F44336',
    proBadge: 'Performance Leader',
    conBadge: 'Performance Issues'
  },
  'Customer Experience': {
    keywords: [
      'customer service', 'customer support', 'service center', 'service network',
      'warranty', 'return policy', 'customer experience', 'responsive', 'helpful',
      'satisfaction', 'after-sales', 'dealership', 'buying experience'
    ],
    icon: Users,
    color: '#607D8B',
    proBadge: 'Great Service',
    conBadge: 'Service Issues'
  }
};

/**
 * Generate logo URL from brand name using Google's favicon service
 */
function generateBrandLogoUrl(brandName) {
  if (!brandName) return null;

  const domain = brandName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .trim() + '.com';

  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

/**
 * Map a free-form attribute to a dimension using keyword matching
 * Prioritizes multi-word phrases (more specific) over single words
 */
function mapAttributeToDimension(attribute) {
  const lowerAttr = attribute.toLowerCase();

  // First pass: look for multi-word phrases (more specific)
  for (const [dimension, config] of Object.entries(DIMENSION_CONFIG)) {
    for (const keyword of config.keywords) {
      if (keyword.includes(' ') && lowerAttr.includes(keyword)) {
        return dimension;
      }
    }
  }

  // Second pass: look for single words
  for (const [dimension, config] of Object.entries(DIMENSION_CONFIG)) {
    for (const keyword of config.keywords) {
      if (!keyword.includes(' ') && lowerAttr.includes(keyword)) {
        return dimension;
      }
    }
  }

  return null;
}

/**
 * Get score color based on value (-100 to +100 scale)
 */
function getScoreColor(score) {
  if (score >= 50) return { bg: 'bg-green-50', text: 'text-green-700', fill: 'bg-green-500', border: 'border-green-200' };
  if (score >= 0) return { bg: 'bg-amber-50', text: 'text-amber-700', fill: 'bg-amber-500', border: 'border-amber-200' };
  return { bg: 'bg-red-50', text: 'text-red-700', fill: 'bg-red-500', border: 'border-red-200' };
}

/**
 * Get source type icon
 */
function getSourceIcon(sourceType) {
  const icons = {
    'Journalism': '📰',
    'Corporate Blogs & Content': '🏢',
    'Review Sites': '⭐',
    'Social/UGC': '💬',
    'Aggregator/Encyclopedic': '📚',
    'Academic/Research': '🎓',
    'Government/NGO': '🏛️',
    'Press Release': '📣'
  };
  return icons[sourceType] || '🔗';
}

/**
 * Process pros_cons data and group by brand and dimension
 */
function processProsCons(prosConsData, entities) {
  const brandData = {};

  // Initialize brand data structure
  entities.forEach(entity => {
    brandData[entity] = {
      dimensions: {},
      unmapped: { pros: [], cons: [] }
    };

    Object.keys(DIMENSION_CONFIG).forEach(dim => {
      brandData[entity].dimensions[dim] = {
        pros: [],
        cons: [],
        score: null,
        allSources: []
      };
    });
  });

  // Process pros - use AI-classified dimension from backend if available, otherwise fallback to local mapping
  (prosConsData.pros || []).forEach(pro => {
    const entity = pro.entity;
    if (!brandData[entity]) return;

    // Use backend dimension if available, fallback to local mapping
    const dimension = pro.dimension && DIMENSION_CONFIG[pro.dimension]
      ? pro.dimension
      : mapAttributeToDimension(pro.attribute);

    if (dimension && brandData[entity].dimensions[dimension]) {
      brandData[entity].dimensions[dimension].pros.push(pro);
      brandData[entity].dimensions[dimension].allSources.push(...(pro.sources || []));
    } else {
      brandData[entity].unmapped.pros.push(pro);
    }
  });

  // Process cons - use AI-classified dimension from backend if available, otherwise fallback to local mapping
  (prosConsData.cons || []).forEach(con => {
    const entity = con.entity;
    if (!brandData[entity]) return;

    // Use backend dimension if available, fallback to local mapping
    const dimension = con.dimension && DIMENSION_CONFIG[con.dimension]
      ? con.dimension
      : mapAttributeToDimension(con.attribute);

    if (dimension && brandData[entity].dimensions[dimension]) {
      brandData[entity].dimensions[dimension].cons.push(con);
      brandData[entity].dimensions[dimension].allSources.push(...(con.sources || []));
    } else {
      brandData[entity].unmapped.cons.push(con);
    }
  });

  // Calculate scores for each dimension
  // Score range: -100 (all cons, high volume) to +100 (all pros, high volume)
  // Volume matters: more mentions = stronger signal
  entities.forEach(entity => {
    Object.keys(brandData[entity].dimensions).forEach(dim => {
      const dimData = brandData[entity].dimensions[dim];

      if (dimData.pros.length === 0 && dimData.cons.length === 0) {
        dimData.score = null;
        return;
      }

      const prosCount = dimData.pros.length;
      const consCount = dimData.cons.length;
      const totalMentions = prosCount + consCount;

      // Calculate weighted scores (frequency * count gives volume weight)
      let prosWeight = 0;
      let consWeight = 0;

      dimData.pros.forEach(p => {
        prosWeight += (p.frequency || 0.5);
      });

      dimData.cons.forEach(c => {
        consWeight += (c.frequency || 0.5);
      });

      // Net sentiment: positive contributions minus negative contributions
      // Scale to -100 to +100 range
      const totalWeight = prosWeight + consWeight;

      if (totalWeight === 0) {
        // Fallback: use count ratio
        dimData.score = Math.round(((prosCount - consCount) / totalMentions) * 100);
      } else {
        // Net score based on weighted balance
        // prosWeight contributes positively, consWeight contributes negatively
        const netScore = ((prosWeight - consWeight) / totalWeight) * 100;
        dimData.score = Math.round(netScore);
      }

      // Clamp to -100 to 100
      dimData.score = Math.max(-100, Math.min(100, dimData.score));

      // Dedupe sources
      const seenUrls = new Set();
      dimData.allSources = dimData.allSources.filter(s => {
        if (!s?.url || seenUrls.has(s.url)) return false;
        seenUrls.add(s.url);
        return true;
      });
    });
  });

  return brandData;
}

/**
 * Calculate overall score for a brand
 */
function calculateOverallScore(dimensions) {
  const scores = Object.values(dimensions)
    .filter(d => d.score !== null)
    .map(d => d.score);

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

/**
 * Get balanced display dimensions: top 3 strengths + bottom 2 weaknesses
 * This ensures both pros and cons are visible on the card
 */
function getDisplayDimensions(dimensions) {
  const active = Object.entries(dimensions)
    .filter(([_, data]) => data.score !== null);

  if (active.length <= 5) {
    // If 5 or fewer, show all sorted by score
    return active.sort((a, b) => b[1].score - a[1].score);
  }

  // Sort by score descending
  const sorted = [...active].sort((a, b) => b[1].score - a[1].score);

  // Take top 3 (strengths) and bottom 2 (weaknesses)
  const top3 = sorted.slice(0, 3);
  const bottom2 = sorted.slice(-2);

  // Combine and dedupe (in case there's overlap with small datasets)
  const combined = new Map();
  top3.forEach(([name, data]) => combined.set(name, data));
  bottom2.forEach(([name, data]) => combined.set(name, data));

  // Return sorted by score for display
  return Array.from(combined.entries()).sort((a, b) => b[1].score - a[1].score);
}

/**
 * Get best pro badge and worst con badge for a brand
 * Only considers dimensions that are displayed
 */
function getBrandBadges(displayedDimensions) {
  let bestPro = null;
  let bestProScore = -1;
  let worstCon = null;
  let worstConScore = 101;

  displayedDimensions.forEach(([dimName, dimData]) => {
    const config = DIMENSION_CONFIG[dimName];

    // Find best pro: highest score with pros
    if (dimData.pros.length > 0 && dimData.score > bestProScore) {
      bestProScore = dimData.score;
      bestPro = { dimension: dimName, badge: config.proBadge, score: dimData.score };
    }

    // Find worst con: lowest score with cons
    if (dimData.cons.length > 0 && dimData.score < worstConScore) {
      worstConScore = dimData.score;
      worstCon = { dimension: dimName, badge: config.conBadge, score: dimData.score };
    }
  });

  return { proBadge: bestPro, conBadge: worstCon };
}

/**
 * Drawer component for dimension details
 */
function DimensionDrawer({ isOpen, onClose, entity, dimension, dimData, config }) {
  const [activeTab, setActiveTab] = useState('sources');

  if (!isOpen || !dimData) return null;

  const scoreColor = getScoreColor(dimData.score);
  const avgProsFreq = dimData.pros.length > 0
    ? dimData.pros.reduce((sum, p) => sum + (p.frequency || 0.5), 0) / dimData.pros.length
    : 0;
  const avgConsFreq = dimData.cons.length > 0
    ? dimData.cons.reduce((sum, c) => sum + (c.frequency || 0.5), 0) / dimData.cons.length
    : 0;

  // Source type breakdown
  const sourceTypes = {};
  dimData.allSources.forEach(s => {
    const type = s.source_type || 'Unknown';
    sourceTypes[type] = (sourceTypes[type] || 0) + 1;
  });

  const IconComponent = config?.icon || Star;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 bottom-0 w-[480px] max-w-[90vw] bg-white shadow-xl z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'} overflow-y-auto`}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E0E0E0] p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config?.color}20` }}>
              <IconComponent className="w-5 h-5" style={{ color: config?.color }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#212121]">{dimension}</h2>
              <p className="text-sm text-[#757575]">{entity}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#757575]" />
          </button>
        </div>

        <div className="p-4">
          {/* Score Overview */}
          <div className={`mb-6 p-4 rounded-lg ${scoreColor.bg} ${scoreColor.border} border`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className={`text-3xl font-bold ${scoreColor.text}`}>{dimData.score}</div>
                <div className="text-sm text-[#757575]">Dimension Score</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-green-700">{dimData.pros.length} Pros</div>
                <div className="text-lg font-semibold text-red-700">{dimData.cons.length} Cons</div>
              </div>
            </div>
            {/* Centered progress bar: negative goes left, positive goes right */}
            <div className="h-2 bg-[#E0E0E0] rounded-full overflow-hidden relative">
              {/* Center line indicator */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#BDBDBD]" />
              {/* Score bar */}
              <div
                className={`absolute top-0 bottom-0 ${dimData.score < 0 ? 'bg-red-500' : 'bg-green-500'} rounded-full transition-all duration-500`}
                style={{
                  width: `${Math.abs(dimData.score) / 2}%`,
                  left: dimData.score < 0 ? `${50 - Math.abs(dimData.score) / 2}%` : '50%',
                }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-[#9E9E9E]">
              <span>Negative (-100)</span>
              <span>Neutral (0)</span>
              <span>Positive (+100)</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-[#F5F5F5] rounded-lg p-1">
            {['sources', 'attributes', 'metrics'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-white text-[#212121] shadow-sm'
                    : 'text-[#757575] hover:text-[#212121]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Sources Tab */}
          {activeTab === 'sources' && (
            <div className="space-y-3">
              {dimData.allSources.length === 0 ? (
                <p className="text-sm text-[#9E9E9E] text-center py-8">No sources available for this dimension</p>
              ) : (
                dimData.allSources.map((source, idx) => (
                  <div key={idx} className="p-3 border border-[#E0E0E0] rounded-lg hover:border-[#BDBDBD] transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded bg-[#F5F5F5] flex items-center justify-center text-sm flex-shrink-0">
                        {getSourceIcon(source.source_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[#1976D2] hover:underline line-clamp-1 flex items-center gap-1"
                        >
                          {source.title || source.domain}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[#757575]">{source.domain}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[#F5F5F5] text-[#616161]">
                            {source.source_type || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Attributes Tab */}
          {activeTab === 'attributes' && (
            <div className="space-y-4">
              {dimData.pros.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-green-700 mb-2">Positive Attributes</h4>
                  <div className="space-y-2">
                    {dimData.pros.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-[#212121]">{p.attribute}</p>
                          <p className="text-xs text-[#757575] mt-1">
                            Frequency: {((p.frequency || 0.5) * 100).toFixed(0)}% | {p.sources?.length || 0} sources
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dimData.cons.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 mb-2">Negative Attributes</h4>
                  <div className="space-y-2">
                    {dimData.cons.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                        <X className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-[#212121]">{c.attribute}</p>
                          <p className="text-xs text-[#757575] mt-1">
                            Frequency: {((c.frequency || 0.5) * 100).toFixed(0)}% | {c.sources?.length || 0} sources
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dimData.pros.length === 0 && dimData.cons.length === 0 && (
                <p className="text-sm text-[#9E9E9E] text-center py-8">No attributes mapped to this dimension</p>
              )}
            </div>
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && (
            <div className="space-y-4">
              {/* Score Breakdown */}
              <div className="p-4 bg-[#F5F5F5] rounded-lg">
                <h4 className="text-sm font-medium text-[#424242] mb-3">Score Calculation</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#757575]">Positive mentions</span>
                    <span className="font-medium text-[#212121]">{dimData.pros.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#757575]">Avg. positive frequency</span>
                    <span className="font-medium text-[#212121]">{(avgProsFreq * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#757575]">Negative mentions</span>
                    <span className="font-medium text-[#212121]">{dimData.cons.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#757575]">Avg. negative frequency</span>
                    <span className="font-medium text-[#212121]">{(avgConsFreq * 100).toFixed(1)}%</span>
                  </div>
                  <div className="border-t border-[#E0E0E0] pt-2 mt-2 flex justify-between">
                    <span className="font-medium text-[#424242]">Final Score</span>
                    <span className={`font-bold text-lg ${scoreColor.text}`}>{dimData.score}</span>
                  </div>
                </div>
              </div>

              {/* Source Distribution */}
              {Object.keys(sourceTypes).length > 0 && (
                <div className="p-4 bg-[#F5F5F5] rounded-lg">
                  <h4 className="text-sm font-medium text-[#424242] mb-3">Source Distribution</h4>
                  <div className="space-y-2">
                    {Object.entries(sourceTypes).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm text-[#757575]">{type}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-[#E0E0E0] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#1976D2] rounded-full"
                              style={{ width: `${(count / dimData.allSources.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-[#424242] w-6 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formula */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Score Formula</h4>
                <p className="text-xs text-blue-700 font-mono">
                  score = (avgProsFreq × prosWeight) + ((100 - avgConsFreq) × consWeight)
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Where weights = proportion of pros/cons out of total mentions
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Single Battle Card component
 */
function BattleCard({ entity, brandData, isTarget, onDimensionClick }) {
  const overallScore = calculateOverallScore(brandData.dimensions);
  const scoreColor = getScoreColor(overallScore);

  // Get balanced dimensions (top 3 strengths + bottom 2 weaknesses)
  const displayDimensions = getDisplayDimensions(brandData.dimensions);
  const { proBadge, conBadge } = getBrandBadges(displayDimensions);

  const logoUrl = generateBrandLogoUrl(entity);

  return (
    <div className={`bg-white rounded-xl border-2 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
      isTarget ? 'border-[#1976D2] ring-2 ring-blue-100' : 'border-[#E0E0E0]'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-[#E0E0E0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={entity}
                className="w-10 h-10 rounded-lg object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div>
              <h3 className="text-lg font-semibold text-[#212121]">{entity}</h3>
              {isTarget && (
                <span className="text-xs text-[#1976D2] font-medium">Target Brand</span>
              )}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${scoreColor.bg} ${scoreColor.text} border ${scoreColor.border}`}>
            {overallScore}
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="p-4 space-y-3">
        {displayDimensions.map(([dimName, dimData]) => {
          const config = DIMENSION_CONFIG[dimName];
          const dimScoreColor = getScoreColor(dimData.score);
          const IconComponent = config.icon;

          // Calculate bar width - use absolute value, scaled to 50% max (half the bar)
          const barWidth = Math.abs(dimData.score) / 2;
          const isNegative = dimData.score < 0;

          return (
            <button
              key={dimName}
              onClick={() => onDimensionClick(entity, dimName, dimData, config)}
              className="w-full text-left p-2 -mx-2 rounded-lg hover:bg-[#F5F5F5] transition-colors group"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <IconComponent className="w-4 h-4" style={{ color: config.color }} />
                  <span className="text-sm font-medium text-[#424242]">{dimName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${dimScoreColor.text}`}>{dimData.score}</span>
                  <ChevronRight className="w-4 h-4 text-[#9E9E9E] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              {/* Centered progress bar: negative goes left, positive goes right */}
              <div className="h-1.5 bg-[#E0E0E0] rounded-full overflow-hidden relative">
                {/* Center line indicator */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#BDBDBD]" />
                {/* Score bar */}
                <div
                  className={`absolute top-0 bottom-0 ${isNegative ? 'bg-red-500' : 'bg-green-500'} rounded-full transition-all duration-300`}
                  style={{
                    width: `${barWidth}%`,
                    left: isNegative ? `${50 - barWidth}%` : '50%',
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-[#9E9E9E]">{dimData.pros.length} pros, {dimData.cons.length} cons</span>
                <span className="text-xs text-[#9E9E9E]">{dimData.allSources.length} sources</span>
              </div>
            </button>
          );
        })}

        {displayDimensions.length === 0 && (
          <p className="text-sm text-[#9E9E9E] text-center py-4">No dimension data available</p>
        )}
      </div>

      {/* Badges */}
      {(proBadge || conBadge) && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {proBadge && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                <Check className="w-3 h-3" />
                {proBadge.badge}
              </span>
            )}
            {conBadge && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                <X className="w-3 h-3" />
                {conBadge.badge}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * BattleCards Component
 * Displays competitive pros/cons as battle cards with dimension mapping
 */
export default function BattleCards({ prosConsData, entity, competitors = [] }) {
  const [drawerState, setDrawerState] = useState({
    isOpen: false,
    entity: null,
    dimension: null,
    dimData: null,
    config: null
  });

  // Get all entities (target + competitors)
  const allEntities = useMemo(() => {
    const entities = new Set([entity]);
    competitors.forEach(c => entities.add(c));

    // Also add entities from pros_cons data
    (prosConsData?.pros || []).forEach(p => entities.add(p.entity));
    (prosConsData?.cons || []).forEach(c => entities.add(c.entity));

    return Array.from(entities).filter(Boolean);
  }, [entity, competitors, prosConsData]);

  // Process data
  const processedData = useMemo(() => {
    if (!prosConsData) return {};
    return processProsCons(prosConsData, allEntities);
  }, [prosConsData, allEntities]);

  // Sort entities: target first, then by overall score
  const sortedEntities = useMemo(() => {
    return [...allEntities].sort((a, b) => {
      if (a === entity) return -1;
      if (b === entity) return 1;
      const scoreA = calculateOverallScore(processedData[a]?.dimensions || {});
      const scoreB = calculateOverallScore(processedData[b]?.dimensions || {});
      return scoreB - scoreA;
    });
  }, [allEntities, entity, processedData]);

  const handleDimensionClick = (entityName, dimension, dimData, config) => {
    setDrawerState({
      isOpen: true,
      entity: entityName,
      dimension,
      dimData,
      config
    });
  };

  const closeDrawer = () => {
    setDrawerState(prev => ({ ...prev, isOpen: false }));
  };

  if (!prosConsData || (prosConsData.pros?.length === 0 && prosConsData.cons?.length === 0)) {
    return null;
  }

  return (
    <div className="bg-white border border-[#E0E0E0] rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-[#212121] mb-1">Competitive Battle Cards</h3>
        <p className="text-sm text-[#757575]">Brand strengths and weaknesses by dimension. Click any dimension for details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedEntities.map(entityName => {
          const brandData = processedData[entityName];
          if (!brandData) return null;

          return (
            <BattleCard
              key={entityName}
              entity={entityName}
              brandData={brandData}
              isTarget={entityName === entity}
              onDimensionClick={handleDimensionClick}
            />
          );
        })}
      </div>

      {/* Dimension Drawer */}
      <DimensionDrawer
        isOpen={drawerState.isOpen}
        onClose={closeDrawer}
        entity={drawerState.entity}
        dimension={drawerState.dimension}
        dimData={drawerState.dimData}
        config={drawerState.config}
      />
    </div>
  );
}
