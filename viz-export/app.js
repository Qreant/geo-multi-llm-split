/**
 * FXTM Competitive Analysis Visualization
 * Minimal runnable example using Chart.js
 */

// Load data
async function loadData() {
  try {
    const response = await fetch('data.json');
    return await response.json();
  } catch (error) {
    console.error('Error loading data:', error);
    return null;
  }
}

// Render metric cards
function renderMetrics(data) {
  document.getElementById('visibility-value').textContent = `${data.visibility.visibility}%`;
  document.getElementById('sov-value').textContent = `${data.visibility.shareOfVoice}%`;
  document.getElementById('position-value').textContent = 
    data.visibility.averagePosition > 0 ? `#${data.visibility.averagePosition}` : '-';
  document.getElementById('mentions-value').textContent = data.visibility.mentions;
}

// Render pie chart for source types
function renderSourceTypePieChart(data) {
  const ctx = document.getElementById('sourceTypePieChart').getContext('2d');
  
  const chartData = {
    labels: data.sourceTypeSov.map(item => item.name),
    datasets: [{
      data: data.sourceTypeSov.map(item => item.value),
      backgroundColor: [
        '#3B82F6', // Chart 1 - Blue
        '#22C55E', // Chart 2 - Green
        '#F59E0B'  // Chart 3 - Amber
      ],
      borderWidth: 0,
      hoverOffset: 10
    }]
  };
  
  new Chart(ctx, {
    type: 'doughnut',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            font: { size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed}%`;
            }
          }
        }
      }
    }
  });
}

// Render bar chart for competitors
function renderCompetitorBarChart(data) {
  const ctx = document.getElementById('competitorBarChart').getContext('2d');
  
  // Sort by SOV and take top 10
  const sortedData = [...data.competitorsRanking].sort((a, b) => b.sov - a.sov).slice(0, 10);
  
  const chartData = {
    labels: sortedData.map(item => item.name),
    datasets: [{
      label: 'Share of Voice',
      data: sortedData.map(item => item.sov * 100),
      backgroundColor: sortedData.map(item => 
        item.name === 'FXTM' ? '#EF4444' : '#3B82F6'
      ),
      borderRadius: 4,
      barThickness: 24
    }]
  };
  
  new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `SOV: ${context.parsed.x.toFixed(1)}%`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 50,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          },
          grid: {
            color: '#E2E8F0'
          }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });
}

// Render competitors table
function renderCompetitorsTable(data) {
  const tbody = document.getElementById('competitors-table-body');
  
  const rows = data.competitorsRanking.map(item => `
    <tr>
      <td style="text-align: center">${item.rank}</td>
      <td><strong>${item.name}</strong></td>
      <td style="text-align: right">${(item.sov * 100).toFixed(1)}%</td>
      <td style="text-align: right">${(item.visibility * 100).toFixed(0)}%</td>
      <td style="text-align: right">${item.avgPosition.toFixed(2)}</td>
      <td style="text-align: center">${item.mentions}</td>
    </tr>
  `).join('');
  
  tbody.innerHTML = rows;
}

// Render sentiment analysis
function renderSentimentAnalysis(data) {
  const grid = document.getElementById('sentiment-grid');
  
  const items = data.reputationAnalysis.topConcepts.map(item => `
    <div class="sentiment-item">
      <div class="sentiment-header">
        <span class="sentiment-concept">${item.concept}</span>
        <span class="sentiment-badge ${item.sentiment}">${item.sentiment}</span>
      </div>
      <div class="sentiment-bar">
        <div class="sentiment-bar-fill ${item.sentiment}" style="width: ${item.value}%"></div>
      </div>
    </div>
  `).join('');
  
  grid.innerHTML = items;
}

// Initialize application
async function init() {
  const data = await loadData();
  
  if (!data) {
    console.error('Failed to load data');
    return;
  }
  
  renderMetrics(data);
  renderSourceTypePieChart(data);
  renderCompetitorBarChart(data);
  renderCompetitorsTable(data);
  renderSentimentAnalysis(data);
}

// Run on page load
document.addEventListener('DOMContentLoaded', init);
