// Graphs Controller - Dual-axis Chart.js charts for temperature + volume

document.addEventListener('DOMContentLoaded', async () => {
  const chartsContainer = document.getElementById('chartsContainer');
  const datePicker = document.getElementById('datePicker');
  const prevDayBtn = document.getElementById('prevDay');
  const nextDayBtn = document.getElementById('nextDay');
  const logoutBtn = document.getElementById('logoutBtn');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  // Track chart instances for cleanup
  let chartInstances = [];

  // Check if dealer is viewing a specific farm
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('userId');
  const farmName = params.get('farmName');

  // Add "back to farms" link and update nav if dealer viewing a farm
  if (userId) {
    const nav = document.querySelector('.flex.gap-1');
    if (nav) {
      const farmsTab = document.createElement('a');
      farmsTab.href = '/farms';
      farmsTab.className = 'px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md text-gray-600 hover:bg-gray-100';
      farmsTab.textContent = 'רפתות';
      nav.appendChild(farmsTab);
    }
    // Update status link to pass userId
    const statusLink = document.querySelector('a[href="/status"]');
    if (statusLink) {
      statusLink.href = `/status?userId=${userId}&farmName=${encodeURIComponent(farmName || '')}`;
    }
  }

  // Set default date to today
  const today = new Date();
  datePicker.value = formatDateForInput(today);
  datePicker.max = formatDateForInput(today);

  // Load initial data
  await loadGraphData();

  // Date navigation
  prevDayBtn.addEventListener('click', () => {
    const date = new Date(datePicker.value);
    date.setDate(date.getDate() - 1);
    datePicker.value = formatDateForInput(date);
    loadGraphData();
  });

  nextDayBtn.addEventListener('click', () => {
    const date = new Date(datePicker.value);
    date.setDate(date.getDate() + 1);
    if (date <= today) {
      datePicker.value = formatDateForInput(date);
      loadGraphData();
    }
  });

  datePicker.addEventListener('change', () => {
    loadGraphData();
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    } catch (e) {
      window.location.href = '/';
    }
  });

  async function loadGraphData() {
    hideError();
    showLoading();

    try {
      const date = datePicker.value;
      const apiUrl = userId ? `/api/graphs?date=${date}&userId=${userId}` : `/api/graphs?date=${date}`;
      const response = await fetch(apiUrl, { credentials: 'include' });
      const result = await response.json();

      if (result.success && result.tanks) {
        renderCharts(result.tanks, date);
      } else if (result.sessionExpired) {
        showError('ההתחברות פגה. מעביר לדף התחברות...');
        setTimeout(() => { window.location.href = '/'; }, 2000);
      } else {
        showError(result.error || 'שגיאה בטעינת נתוני הגרפים');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('שגיאה בחיבור לשרת.');
    }
  }

  function renderCharts(tanks, dateStr) {
    // Destroy existing charts
    chartInstances.forEach(c => c.destroy());
    chartInstances = [];

    if (!tanks || tanks.length === 0) {
      chartsContainer.innerHTML = '<p class="text-center text-gray-500 py-8">אין נתונים זמינים</p>';
      return;
    }

    const gridClass = tanks.length === 1
      ? 'flex justify-center'
      : 'grid grid-cols-1 lg:grid-cols-2 gap-6';

    chartsContainer.innerHTML = `<div class="${gridClass}">${tanks.map((t, i) => `
      <div class="w-full">
        <div class="bg-white sm:rounded-xl shadow-lg px-0 py-2 sm:p-6">
          <h3 class="text-base sm:text-lg font-bold text-gray-800 text-center mb-1 sm:mb-4">${t.name || t.serial}</h3>
          <div class="relative" style="height: 400px;">
            <canvas id="chart-${i}"></canvas>
          </div>
          <p class="text-xs text-gray-400 text-center mt-1">מספר סידורי: ${t.serial}</p>
        </div>
      </div>
    `).join('')}</div>`;

    // Create charts
    tanks.forEach((tank, i) => {
      const canvas = document.getElementById(`chart-${i}`);
      if (canvas) {
        const chart = createDualAxisChart(canvas, tank, dateStr);
        chartInstances.push(chart);
      }
    });
  }

  function createDualAxisChart(canvas, tank, dateStr) {
    const tempData = (tank.temps || []).map(d => ({
      x: new Date(d.timestamp),
      y: d.temperature
    }));

    const volumeData = (tank.volume || []).map(d => ({
      x: new Date(d.timestamp),
      y: d.volume
    }));

    const hasVolume = volumeData.length > 0;

    const datasets = [];

    // Volume dataset - BLUE filled area (added first so it renders behind)
    if (hasVolume) {
      datasets.push({
        label: 'נפח חלב (ליטר)',
        data: volumeData,
        borderColor: 'rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true,
        yAxisID: 'yVolume',
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.3,
        order: 2
      });
    }

    // Temperature dataset - GREEN line
    if (tempData.length > 0) {
      datasets.push({
        label: 'טמפרטורה (°C)',
        data: tempData,
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: false,
        yAxisID: 'yTemp',
        pointRadius: 0,
        borderWidth: 2.5,
        tension: 0.3,
        order: 1
      });
    }

    const isMobile = window.innerWidth < 640;

    const scales = {
      x: {
        type: 'time',
        time: {
          unit: 'hour',
          displayFormats: {
            hour: 'HH:mm'
          },
          tooltipFormat: 'dd/MM/yyyy HH:mm'
        },
        title: {
          display: false
        },
        ticks: {
          font: { family: 'Rubik', size: isMobile ? 9 : 12 },
          maxTicksLimit: isMobile ? 6 : 12
        }
      },
      yTemp: {
        type: 'linear',
        position: 'right',
        title: {
          display: !isMobile,
          text: 'טמפרטורה (°C)',
          color: 'rgba(34, 197, 94, 1)',
          font: { family: 'Rubik', weight: 'bold' }
        },
        ticks: {
          color: 'rgba(34, 197, 94, 1)',
          font: { family: 'Rubik', size: isMobile ? 9 : 12 },
          callback: (v) => isMobile ? v + '°' : v + '°C'
        },
        grid: {
          drawOnChartArea: !hasVolume
        }
      }
    };

    if (hasVolume) {
      scales.yVolume = {
        type: 'linear',
        position: 'left',
        title: {
          display: !isMobile,
          text: 'נפח חלב (ליטר)',
          color: 'rgba(59, 130, 246, 1)',
          font: { family: 'Rubik', weight: 'bold' }
        },
        ticks: {
          color: 'rgba(59, 130, 246, 1)',
          font: { family: 'Rubik', size: isMobile ? 9 : 12 },
          callback: (v) => isMobile ? v : v + ' L'
        },
        grid: {
          drawOnChartArea: true
        }
      };
    }

    return new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        layout: {
          padding: isMobile ? { left: 0, right: 0, top: 0, bottom: 0 } : {}
        },
        plugins: {
          title: {
            display: true,
            text: hasVolume ? 'טמפרטורה ונפח חלב' : 'טמפרטורה',
            font: { family: 'Rubik', size: isMobile ? 13 : 16, weight: 'bold' }
          },
          legend: {
            rtl: true,
            labels: {
              font: { family: 'Rubik', size: isMobile ? 10 : 12 },
              usePointStyle: true,
              boxWidth: isMobile ? 8 : 40
            }
          },
          tooltip: {
            rtl: true,
            callbacks: {
              title: (items) => {
                if (items.length > 0) {
                  const date = new Date(items[0].parsed.x);
                  return date.toLocaleString('he-IL', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  });
                }
                return '';
              },
              label: (context) => {
                const label = context.dataset.label || '';
                const value = context.parsed.y;
                if (label.includes('טמפרטורה')) return `${label}: ${value.toFixed(1)}°C`;
                if (label.includes('נפח')) return `${label}: ${value.toFixed(0)} ליטר`;
                return `${label}: ${value}`;
              }
            }
          }
        },
        scales
      }
    });
  }

  function formatDateForInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function showLoading() {
    chartsContainer.innerHTML = `
      <div class="text-center py-12">
        <svg class="animate-spin h-8 w-8 mx-auto mb-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-500">טוען גרפים...</p>
      </div>`;
  }

  function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
  }
});
