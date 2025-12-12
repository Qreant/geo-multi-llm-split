import PropTypes from 'prop-types';
import { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import AnnotationsModule from 'highcharts/modules/annotations';

// Initialize the annotations module
if (typeof Highcharts === 'object') {
  AnnotationsModule(Highcharts);
}

/**
 * Format category name: replace underscores with spaces and capitalize each word
 */
const formatCategoryName = (name) => {
  if (!name) return '';
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Map country suffix (from market code) to ISO 3166-1 alpha-2 country codes for flags
 */
const COUNTRY_SUFFIX_TO_ISO = {
  // Standard ISO codes
  'US': 'US', 'CA': 'CA', 'MX': 'MX', 'GB': 'GB', 'UK': 'GB', 'IE': 'IE', 'FR': 'FR',
  'DE': 'DE', 'ES': 'ES', 'IT': 'IT', 'PT': 'PT', 'NL': 'NL', 'BE': 'BE', 'AT': 'AT',
  'CH': 'CH', 'LU': 'LU', 'SE': 'SE', 'NO': 'NO', 'DK': 'DK', 'FI': 'FI', 'IS': 'IS',
  'PL': 'PL', 'CZ': 'CZ', 'SK': 'SK', 'HU': 'HU', 'RO': 'RO', 'BG': 'BG', 'UA': 'UA',
  'RU': 'RU', 'GR': 'GR', 'HR': 'HR', 'SI': 'SI', 'RS': 'RS', 'JP': 'JP', 'KR': 'KR',
  'CN': 'CN', 'TW': 'TW', 'HK': 'HK', 'SG': 'SG', 'AU': 'AU', 'NZ': 'NZ', 'TH': 'TH',
  'VN': 'VN', 'ID': 'ID', 'MY': 'MY', 'PH': 'PH', 'IN': 'IN', 'BD': 'BD', 'PK': 'PK',
  'SA': 'SA', 'AE': 'AE', 'EG': 'EG', 'IL': 'IL', 'TR': 'TR', 'IR': 'IR', 'QA': 'QA',
  'KW': 'KW', 'BH': 'BH', 'OM': 'OM', 'JO': 'JO', 'LB': 'LB', 'BR': 'BR', 'AR': 'AR',
  'CL': 'CL', 'CO': 'CO', 'PE': 'PE', 'VE': 'VE', 'EC': 'EC', 'UY': 'UY', 'PY': 'PY',
  'BO': 'BO', 'ZA': 'ZA', 'NG': 'NG', 'KE': 'KE', 'MA': 'MA', 'SN': 'SN', 'GH': 'GH',
  'DZ': 'DZ', 'TN': 'TN',
  // Auto-generated codes from country names
  'UN': 'US', 'GE': 'DE', 'SP': 'ES', 'SW': 'CH', 'NE': 'NL', 'PO': 'PT',
  'JA': 'JP', 'KO': 'KR', 'SO': 'KR', 'TA': 'TW', 'HO': 'HK', 'TU': 'TR',
  'ME': 'MX', 'IR': 'IE', 'IS': 'IL',
};

/**
 * Convert ISO country code to flag emoji
 * Uses regional indicator symbols: A=🇦 (U+1F1E6), etc.
 */
const countryCodeToFlagEmoji = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 0x1F1E6 + char.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
};

/**
 * Extract country code from market code (e.g., 'en-US' -> 'US', 'fr-FR' -> 'FR')
 * Also handles market labels like "Electric Vehicles (United States)"
 */
const getCountryCodeFromMarket = (marketCode, marketLabel) => {
  // Try to extract from marketCode first (e.g., 'en-US')
  if (marketCode) {
    const parts = marketCode.split('-');
    const countrySuffix = parts.length > 1 ? parts[1].toUpperCase() : parts[0].toUpperCase();
    if (COUNTRY_SUFFIX_TO_ISO[countrySuffix]) {
      return COUNTRY_SUFFIX_TO_ISO[countrySuffix];
    }
    if (countrySuffix.length === 2) {
      return countrySuffix;
    }
  }

  // Try to extract from marketLabel parentheses (e.g., "Category (France)")
  if (marketLabel) {
    const match = marketLabel.match(/\(([^)]+)\)$/);
    if (match) {
      const countryName = match[1].trim().toLowerCase();
      // Map common country names to codes
      const nameToCode = {
        'united states': 'US', 'usa': 'US', 'america': 'US',
        'united kingdom': 'GB', 'uk': 'GB', 'britain': 'GB', 'england': 'GB',
        'france': 'FR', 'germany': 'DE', 'italy': 'IT', 'spain': 'ES',
        'portugal': 'PT', 'netherlands': 'NL', 'belgium': 'BE', 'austria': 'AT',
        'switzerland': 'CH', 'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK',
        'finland': 'FI', 'poland': 'PL', 'czech republic': 'CZ', 'czechia': 'CZ',
        'hungary': 'HU', 'romania': 'RO', 'bulgaria': 'BG', 'ukraine': 'UA',
        'russia': 'RU', 'greece': 'GR', 'croatia': 'HR', 'japan': 'JP',
        'south korea': 'KR', 'korea': 'KR', 'china': 'CN', 'taiwan': 'TW',
        'hong kong': 'HK', 'singapore': 'SG', 'australia': 'AU', 'new zealand': 'NZ',
        'thailand': 'TH', 'vietnam': 'VN', 'indonesia': 'ID', 'malaysia': 'MY',
        'philippines': 'PH', 'india': 'IN', 'pakistan': 'PK', 'saudi arabia': 'SA',
        'uae': 'AE', 'united arab emirates': 'AE', 'egypt': 'EG', 'israel': 'IL',
        'turkey': 'TR', 'brazil': 'BR', 'argentina': 'AR', 'chile': 'CL',
        'colombia': 'CO', 'peru': 'PE', 'mexico': 'MX', 'canada': 'CA',
        'south africa': 'ZA', 'nigeria': 'NG', 'kenya': 'KE', 'morocco': 'MA',
        'ireland': 'IE', 'luxembourg': 'LU', 'iceland': 'IS', 'slovakia': 'SK',
        'slovenia': 'SI', 'serbia': 'RS', 'bangladesh': 'BD', 'qatar': 'QA',
        'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM', 'jordan': 'JO',
        'lebanon': 'LB', 'iran': 'IR', 'venezuela': 'VE', 'ecuador': 'EC',
        'uruguay': 'UY', 'paraguay': 'PY', 'bolivia': 'BO', 'senegal': 'SN',
        'ghana': 'GH', 'algeria': 'DZ', 'tunisia': 'TN',
      };
      if (nameToCode[countryName]) {
        return nameToCode[countryName];
      }
    }
  }

  return null;
};

/**
 * Get flag emoji from market code or label
 */
const getFlagEmoji = (marketCode, marketLabel) => {
  const countryCode = getCountryCodeFromMarket(marketCode, marketLabel);
  return countryCode ? countryCodeToFlagEmoji(countryCode) : '';
};

/**
 * Get quadrant color based on position
 */
function getQuadrantColor(x, y) {
  const isHighVisibility = x >= 50;
  const isHighCompetitiveness = y >= 50;

  if (isHighVisibility && isHighCompetitiveness) {
    return { fill: '#22C55E', border: '#16A34A', name: 'Stars' };
  } else if (!isHighVisibility && isHighCompetitiveness) {
    return { fill: '#F59E0B', border: '#D97706', name: 'Opportunity' };
  } else if (isHighVisibility && !isHighCompetitiveness) {
    return { fill: '#EF4444', border: '#DC2626', name: 'At Risk' };
  } else {
    return { fill: '#94A3B8', border: '#64748B', name: 'Monitor' };
  }
}

/**
 * VisibilityCompetitivenessMatrix Component
 * Modern scatter plot showing categories by Visibility (X) vs Competitiveness/Win Rate (Y)
 */
export default function VisibilityCompetitivenessMatrix({ categoryMetrics = [], entity = '' }) {
  const hasCompetitiveData = categoryMetrics.some(cat => cat.winRate !== null && cat.winRate !== undefined);

  // Calculate quadrant counts
  const quadrantCounts = useMemo(() => {
    const counts = { stars: 0, opportunity: 0, atRisk: 0, monitor: 0 };
    categoryMetrics.forEach(cat => {
      if (cat.visibility === null || cat.visibility === undefined) return;
      const x = (cat.visibility || 0) * 100;
      const y = (cat.winRate || 0) * 100;
      const isHighVis = x >= 50;
      const isHighComp = y >= 50;
      if (isHighVis && isHighComp) counts.stars++;
      else if (!isHighVis && isHighComp) counts.opportunity++;
      else if (isHighVis && !isHighComp) counts.atRisk++;
      else counts.monitor++;
    });
    return counts;
  }, [categoryMetrics]);

  const chartOptions = useMemo(() => {
    // First pass: collect all points with their coordinates
    const points = categoryMetrics
      .filter(cat => cat.visibility !== null && cat.visibility !== undefined)
      .map(cat => ({
        cat,
        x: (cat.visibility || 0) * 100,
        y: (cat.winRate || 0) * 100
      }));

    // Sort by y descending, then x ascending to process top-right first
    points.sort((a, b) => b.y - a.y || a.x - b.x);

    // Track occupied label positions to avoid overlaps
    // Each entry: { x, y, labelY, labelAlign } representing where a label is placed
    const placedLabels = [];

    // Check if a proposed label position would overlap with existing labels
    const wouldOverlap = (px, py, labelY, labelAlign) => {
      // Approximate label dimensions (in axis units, roughly)
      const labelWidth = 12;  // ~12% of axis width
      const labelHeight = 8;  // ~8% of axis height

      for (const placed of placedLabels) {
        // Calculate label center positions
        const thisLabelCenterY = py + (labelY > 0 ? labelHeight / 2 : -labelHeight / 2);
        const placedLabelCenterY = placed.py + (placed.labelY > 0 ? labelHeight / 2 : -labelHeight / 2);

        // Horizontal overlap check depends on alignment
        let thisLabelLeft, thisLabelRight;
        if (labelAlign === 'right') {
          thisLabelRight = px + 2;
          thisLabelLeft = px - labelWidth;
        } else if (labelAlign === 'left') {
          thisLabelLeft = px - 2;
          thisLabelRight = px + labelWidth;
        } else {
          thisLabelLeft = px - labelWidth / 2;
          thisLabelRight = px + labelWidth / 2;
        }

        let placedLabelLeft, placedLabelRight;
        if (placed.labelAlign === 'right') {
          placedLabelRight = placed.px + 2;
          placedLabelLeft = placed.px - labelWidth;
        } else if (placed.labelAlign === 'left') {
          placedLabelLeft = placed.px - 2;
          placedLabelRight = placed.px + labelWidth;
        } else {
          placedLabelLeft = placed.px - labelWidth / 2;
          placedLabelRight = placed.px + labelWidth / 2;
        }

        // Check for overlap
        const horizontalOverlap = thisLabelLeft < placedLabelRight && thisLabelRight > placedLabelLeft;
        const verticalOverlap = Math.abs(thisLabelCenterY - placedLabelCenterY) < labelHeight;

        if (horizontalOverlap && verticalOverlap) {
          return true;
        }
      }
      return false;
    };

    const dataPoints = points.map(({ cat, x, y }) => {
      const quadrant = getQuadrantColor(x, y);

      // Hard edge constraints - NEVER violate these
      const isAtTop = y >= 90;        // At very top: MUST go below
      const isAtBottom = y <= 10;     // At very bottom: MUST go above
      const isAtRight = x >= 85;      // At very right: MUST align right
      const isAtLeft = x <= 15;       // At very left: MUST align left

      // Soft edge preferences
      const isNearTop = y >= 70;
      const isNearBottom = y <= 30;
      const isNearRight = x >= 70;
      const isNearLeft = x <= 30;

      // Define possible label positions to try (in priority order)
      // Format: [yOffset, align, xOffset]
      let positions = [];

      // Build position options based on location
      if (isNearTop) {
        // Near top: prefer below
        if (isNearRight) {
          positions.push([32, 'right', 10]);     // Below, right-aligned
          positions.push([32, 'center', 0]);     // Below, centered
          positions.push([32, 'left', -10]);     // Below, left-aligned
          positions.push([-28, 'right', 10]);    // Above, right-aligned
        } else if (isNearLeft) {
          positions.push([32, 'left', -10]);     // Below, left-aligned
          positions.push([32, 'center', 0]);     // Below, centered
          positions.push([32, 'right', 10]);     // Below, right-aligned
          positions.push([-28, 'left', -10]);    // Above, left-aligned
        } else {
          positions.push([32, 'center', 0]);     // Below, centered
          positions.push([32, 'right', 10]);     // Below, right-aligned
          positions.push([32, 'left', -10]);     // Below, left-aligned
          positions.push([-28, 'center', 0]);    // Above, centered
        }
      } else if (isNearBottom) {
        // Near bottom: prefer above
        if (isNearRight) {
          positions.push([-28, 'right', 10]);    // Above, right-aligned
          positions.push([-28, 'center', 0]);    // Above, centered
          positions.push([32, 'right', 10]);     // Below, right-aligned
        } else if (isNearLeft) {
          positions.push([-28, 'left', -10]);    // Above, left-aligned
          positions.push([-28, 'center', 0]);    // Above, centered
          positions.push([32, 'left', -10]);     // Below, left-aligned
        } else {
          positions.push([-28, 'center', 0]);    // Above, centered
          positions.push([-28, 'right', 10]);    // Above, right
          positions.push([-28, 'left', -10]);    // Above, left
          positions.push([32, 'center', 0]);     // Below, centered
        }
      } else {
        // Middle of chart: try above first, then below
        if (isNearRight) {
          positions.push([-28, 'right', 10]);    // Above, right-aligned
          positions.push([32, 'right', 10]);     // Below, right-aligned
          positions.push([-28, 'center', 0]);    // Above, centered
          positions.push([32, 'center', 0]);     // Below, centered
        } else if (isNearLeft) {
          positions.push([-28, 'left', -10]);    // Above, left-aligned
          positions.push([32, 'left', -10]);     // Below, left-aligned
          positions.push([-28, 'center', 0]);    // Above, centered
          positions.push([32, 'center', 0]);     // Below, centered
        } else {
          positions.push([-28, 'center', 0]);    // Above, centered
          positions.push([32, 'center', 0]);     // Below, centered
          positions.push([-28, 'right', 10]);    // Above, right
          positions.push([-28, 'left', -10]);    // Above, left
          positions.push([32, 'right', 10]);     // Below, right
          positions.push([32, 'left', -10]);     // Below, left
        }
      }

      // Apply hard constraints - filter out invalid positions
      if (isAtTop) {
        // Remove all "above" positions (negative y offset)
        positions = positions.filter(([yOff]) => yOff > 0);
      }
      if (isAtBottom) {
        // Remove all "below" positions (positive y offset)
        positions = positions.filter(([yOff]) => yOff < 0);
      }
      if (isAtRight) {
        // Remove all non-right-aligned positions
        positions = positions.filter(([, align]) => align === 'right');
      }
      if (isAtLeft) {
        // Remove all non-left-aligned positions
        positions = positions.filter(([, align]) => align === 'left');
      }

      // Fallback if all positions were filtered (shouldn't happen)
      if (positions.length === 0) {
        positions.push([isAtTop ? 32 : -28, 'center', 0]);
      }

      // Find first non-overlapping position
      let labelY = positions[0][0];
      let labelAlign = positions[0][1];
      let labelX = positions[0][2];

      for (const [tryY, tryAlign, tryX] of positions) {
        if (!wouldOverlap(x, y, tryY, tryAlign)) {
          labelY = tryY;
          labelAlign = tryAlign;
          labelX = tryX;
          break;
        }
      }

      // Record this label's position
      placedLabels.push({ px: x, py: y, labelY, labelAlign });

      // Get flag emoji for this market
      const flagEmoji = getFlagEmoji(cat.marketCode, cat.marketLabel);

      return {
        x,
        y,
        name: cat.marketLabel || formatCategoryName(cat.categoryName),
        avgPosition: cat.avgPosition?.toFixed(1) || 'N/A',
        mentions: cat.mentions || 0,
        sov: (cat.sov || 0) * 100,
        winRate: (cat.winRate || 0) * 100,
        color: quadrant.fill,
        borderColor: quadrant.border,
        quadrantName: quadrant.name,
        flagEmoji: flagEmoji,
        marketCode: cat.marketCode,
        dataLabels: {
          y: labelY,
          x: labelX,
          align: labelAlign
        }
      };
    });

    return {
      chart: {
        type: 'scatter',
        height: 560,
        backgroundColor: 'transparent',
        spacing: [20, 40, 40, 20],
        style: {
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        },
        events: {
          render: function() {
            const chart = this;
            const xAxis = chart.xAxis[0];
            const yAxis = chart.yAxis[0];

            // Remove existing quadrant elements if they exist
            if (chart.quadrantGroup) {
              chart.quadrantGroup.destroy();
            }

            // Create a group for quadrant backgrounds
            chart.quadrantGroup = chart.renderer.g('quadrants').attr({ zIndex: 0 }).add();

            // Calculate pixel positions for the 50% threshold
            const x50 = xAxis.toPixels(50);
            const y50 = yAxis.toPixels(50);
            const xMin = xAxis.toPixels(0);
            const xMax = xAxis.toPixels(100);
            const yMin = yAxis.toPixels(100); // Note: yAxis is inverted in pixels
            const yMax = yAxis.toPixels(0);

            // Draw 4 quadrant rectangles
            const quadrants = [
              // Top-left: Opportunity (amber) - low visibility, high competitiveness
              { x: xMin, y: yMin, width: x50 - xMin, height: y50 - yMin, color: 'rgba(245, 158, 11, 0.08)' },
              // Top-right: Stars (green) - high visibility, high competitiveness
              { x: x50, y: yMin, width: xMax - x50, height: y50 - yMin, color: 'rgba(34, 197, 94, 0.08)' },
              // Bottom-left: Monitor (gray) - low visibility, low competitiveness
              { x: xMin, y: y50, width: x50 - xMin, height: yMax - y50, color: 'rgba(148, 163, 184, 0.08)' },
              // Bottom-right: At Risk (red) - high visibility, low competitiveness
              { x: x50, y: y50, width: xMax - x50, height: yMax - y50, color: 'rgba(239, 68, 68, 0.08)' }
            ];

            quadrants.forEach(q => {
              chart.renderer.rect(q.x, q.y, q.width, q.height)
                .attr({ fill: q.color, zIndex: 0 })
                .add(chart.quadrantGroup);
            });
          }
        }
      },
      title: {
        text: null
      },
      xAxis: {
        title: {
          text: 'VISIBILITY',
          style: {
            color: '#64748B',
            fontSize: '10px',
            fontWeight: '600',
            letterSpacing: '1px'
          },
          margin: 15
        },
        min: 0,
        max: 100,
        tickInterval: 25,
        gridLineWidth: 0,
        lineWidth: 0,
        tickWidth: 0,
        labels: {
          format: '{value}%',
          style: { color: '#94A3B8', fontSize: '11px' }
        },
        plotLines: [{
          color: '#CBD5E1',
          dashStyle: 'ShortDash',
          value: 50,
          width: 2,
          zIndex: 3
        }]
      },
      yAxis: {
        title: {
          text: 'COMPETITIVENESS',
          style: {
            color: '#64748B',
            fontSize: '10px',
            fontWeight: '600',
            letterSpacing: '1px'
          },
          margin: 15
        },
        min: 0,
        max: 100,
        tickInterval: 25,
        gridLineWidth: 0,
        lineWidth: 0,
        labels: {
          format: '{value}%',
          style: { color: '#94A3B8', fontSize: '11px' }
        },
        plotLines: [{
          color: '#CBD5E1',
          dashStyle: 'ShortDash',
          value: 50,
          width: 2,
          zIndex: 3
        }]
      },
      tooltip: {
        useHTML: true,
        backgroundColor: 'transparent',
        borderWidth: 0,
        shadow: false,
        padding: 0,
        formatter: function() {
          const point = this.point;
          return `
            <div style="
              background: white;
              border-radius: 16px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05);
              padding: 20px;
              min-width: 220px;
            ">
              <div style="
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid #F1F5F9;
              ">
                <div style="
                  width: 10px;
                  height: 10px;
                  border-radius: 50%;
                  background: ${point.color};
                  box-shadow: 0 0 0 3px ${point.color}20;
                "></div>
                <div style="font-weight: 600; font-size: 14px; color: #1E293B;">
                  ${point.name}
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div style="
                  background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
                  padding: 12px;
                  border-radius: 10px;
                ">
                  <div style="font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Visibility</div>
                  <div style="font-size: 18px; font-weight: 700; color: #1E293B;">${point.x.toFixed(0)}%</div>
                </div>
                <div style="
                  background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
                  padding: 12px;
                  border-radius: 10px;
                ">
                  <div style="font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Win Rate</div>
                  <div style="font-size: 18px; font-weight: 700; color: #1E293B;">${point.y.toFixed(0)}%</div>
                </div>
                <div style="
                  background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
                  padding: 12px;
                  border-radius: 10px;
                ">
                  <div style="font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">SOV</div>
                  <div style="font-size: 18px; font-weight: 700; color: #1E293B;">${point.sov.toFixed(0)}%</div>
                </div>
                <div style="
                  background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
                  padding: 12px;
                  border-radius: 10px;
                ">
                  <div style="font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Position</div>
                  <div style="font-size: 18px; font-weight: 700; color: #1E293B;">#${point.avgPosition}</div>
                </div>
              </div>
              <div style="
                margin-top: 12px;
                padding: 8px 12px;
                background: ${point.color}15;
                border-radius: 8px;
                display: flex;
                align-items: center;
                gap: 8px;
              ">
                <span style="font-size: 11px; font-weight: 500; color: ${point.borderColor};">${point.quadrantName}</span>
              </div>
            </div>
          `;
        }
      },
      plotOptions: {
        scatter: {
          marker: {
            enabled: false,  // Hide default markers - we use custom data labels with flag emoji
            symbol: 'circle',
            states: {
              hover: {
                enabled: true,
                radiusPlus: 4,
                lineWidthPlus: 1
              }
            }
          },
          dataLabels: {
            enabled: true,
            useHTML: true,
            formatter: function() {
              const point = this.point;
              const match = point.name.match(/^(.+?)\s*\(([^)]+)\)$/);
              let categoryName = point.name;

              if (match) {
                categoryName = match[1].trim();
              }

              const maxLen = 12;
              const truncatedCategory = categoryName.length > maxLen
                ? categoryName.substring(0, maxLen - 1) + '…'
                : categoryName;

              // Use flag emoji if available
              const flagEmoji = point.flagEmoji || '';

              return `
                <div style="
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 3px;
                  pointer-events: none;
                ">
                  <div style="
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    background: ${point.color};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 3px 8px rgba(0,0,0,0.25);
                  ">
                    ${flagEmoji ? `<span style="font-size: 13px; line-height: 1; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));">${flagEmoji}</span>` : ''}
                  </div>
                  <div style="
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(8px);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: 500;
                    color: white;
                    white-space: nowrap;
                    max-width: 80px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  ">
                    ${truncatedCategory}
                  </div>
                </div>
              `;
            },
            // Default positioning - per-point dataLabels override x, y, align
            overflow: 'allow',
            crop: false,
            allowOverlap: true,
            padding: 0,
            verticalAlign: 'middle'  // Use middle as anchor, y offset controls actual position
          }
        }
      },
      legend: {
        enabled: false
      },
      series: [{
        name: 'Categories',
        data: dataPoints,
        turboThreshold: 0
      }],
      credits: {
        enabled: false
      },
      // Quadrant labels positioned in corners
      annotations: [{
        draggable: '',
        labelOptions: {
          backgroundColor: 'transparent',
          borderWidth: 0,
          style: {
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '1.5px'
          }
        },
        labels: [
          {
            point: { x: 75, y: 96, xAxis: 0, yAxis: 0 },
            text: 'STARS',
            style: { color: '#16A34A' }
          },
          {
            point: { x: 25, y: 96, xAxis: 0, yAxis: 0 },
            text: 'OPPORTUNITY',
            style: { color: '#D97706' }
          },
          {
            point: { x: 75, y: 4, xAxis: 0, yAxis: 0 },
            text: 'AT RISK',
            style: { color: '#DC2626' }
          },
          {
            point: { x: 25, y: 4, xAxis: 0, yAxis: 0 },
            text: 'MONITOR',
            style: { color: '#64748B' }
          }
        ]
      }]
    };
  }, [categoryMetrics, entity]);

  if (categoryMetrics.length === 0 || !hasCompetitiveData) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      {/* Modern Header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Visibility vs Competitiveness</h3>
            <p className="text-sm text-slate-500 mt-0.5">Category positioning matrix for {entity}</p>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 rounded-full">
            <span className="text-xs font-medium text-slate-600">{categoryMetrics.filter(c => c.visibility != null).length} categories</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2">
        <HighchartsReact
          highcharts={Highcharts}
          options={chartOptions}
        />
      </div>

      {/* Modern Legend */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: 'stars', label: 'Stars', desc: 'High visibility, high competitiveness', color: '#22C55E', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
            { key: 'opportunity', label: 'Opportunity', desc: 'Low visibility, high competitiveness', color: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
            { key: 'atRisk', label: 'At Risk', desc: 'High visibility, low competitiveness', color: '#EF4444', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
            { key: 'monitor', label: 'Monitor', desc: 'Low visibility, low competitiveness', color: '#94A3B8', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }
          ].map(item => (
            <div key={item.key} className={`${item.bg} ${item.border} border rounded-xl p-4 transition-all hover:shadow-sm`}>
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 0 3px ${item.color}20` }}
                />
                <span className={`text-sm font-semibold ${item.text}`}>{item.label}</span>
                <span className={`ml-auto text-xs font-bold ${item.text} opacity-80`}>
                  {quadrantCounts[item.key]}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

VisibilityCompetitivenessMatrix.propTypes = {
  categoryMetrics: PropTypes.arrayOf(
    PropTypes.shape({
      categoryId: PropTypes.string,
      categoryName: PropTypes.string,
      marketCode: PropTypes.string,
      marketLabel: PropTypes.string,
      visibility: PropTypes.number,
      sov: PropTypes.number,
      avgPosition: PropTypes.number,
      mentions: PropTypes.number,
      winRate: PropTypes.number
    })
  ),
  entity: PropTypes.string
};
