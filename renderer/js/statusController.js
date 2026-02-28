// Status Controller V2 - Multi-tank support

document.addEventListener('DOMContentLoaded', async () => {
  const tanksContainer = document.getElementById('tanksContainer');
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshIcon = document.getElementById('refreshIcon');
  const refreshText = document.getElementById('refreshText');
  const logoutBtn = document.getElementById('logoutBtn');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

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
    // Update graphs link to pass userId
    const graphsLink = document.querySelector('a[href="/graphs"]');
    if (graphsLink) {
      graphsLink.href = `/graphs?userId=${userId}&farmName=${encodeURIComponent(farmName || '')}`;
    }
  }

  await loadTemperatureData();

  refreshBtn.addEventListener('click', async () => {
    await loadTemperatureData();
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    } catch (error) {
      window.location.href = '/';
    }
  });

  async function loadTemperatureData() {
    setLoadingState(true);
    hideError();

    try {
      const apiUrl = userId ? `/api/temperature?userId=${userId}` : '/api/temperature';
      const response = await fetch(apiUrl, { credentials: 'include' });
      const result = await response.json();

      if (result.success && result.tanks) {
        renderTanks(result.tanks);
      } else if (result.sessionExpired) {
        showError('ההתחברות פגה. מעביר לדף התחברות...');
        setTimeout(() => { window.location.href = '/'; }, 2000);
      } else {
        let msg = result.error || 'שגיאה בטעינת נתוני הטמפרטורה';
        if (msg.includes('Failed') || msg.includes('failed')) msg = 'שגיאה בטעינת נתונים';
        else if (msg.includes('network') || msg.includes('connect')) msg = 'בעיית חיבור לשרת';
        showError(msg);
      }
    } catch (error) {
      console.error('Error:', error);
      showError('שגיאה בחיבור לשרת. בדוק את חיבור האינטרנט.');
    } finally {
      setLoadingState(false);
    }
  }

  function renderTanks(tanks) {
    if (!tanks || tanks.length === 0) {
      tanksContainer.innerHTML = '<p class="text-center text-gray-500 py-8">לא נמצאו טנקים</p>';
      return;
    }

    // Grid: 1 tank = centered, 2+ tanks = side by side on desktop
    const gridClass = tanks.length === 1
      ? 'flex justify-center'
      : 'grid grid-cols-1 lg:grid-cols-2 gap-6';

    tanksContainer.innerHTML = `<div class="${gridClass}">${tanks.map(t => createTankCard(t, tanks.length)).join('')}</div>`;
  }

  function createTankCard(data, totalTanks) {
    const temp = formatTemperature(data.temperature);
    const volume = data.volume != null ? `${data.volume} L` : '';
    const status = translateStatus(data.status);
    const model = data.model === 'VM/DX' ? 'סילו VM/DX' : (data.model || '--');
    const message = translateMessage(data.message);
    const serial = data.serial || '';
    const tankName = translateTankName(data.tankName) || 'לא ידוע';
    const timestamp = data.timestamp ? data.timestamp.trim() : '--';
    const volTimestamp = data.volumeTimestamp ? data.volumeTimestamp.trim() : '';
    const lastUpdate = volTimestamp || timestamp;

    const maxWidth = totalTanks === 1 ? 'max-w-[600px] w-full' : 'w-full';

    return `
      <div class="${maxWidth}">
        <!-- Tank Header -->
        <div class="mb-3 text-center">
          <h2 class="text-xl sm:text-2xl font-bold text-gray-800">${tankName}</h2>
          <p class="text-xs sm:text-sm text-gray-500">${serial ? 'מספר סידורי: ' + serial : ''}</p>
        </div>

        <!-- Temperature + Volume Display -->
        <div class="flex flex-col gap-4 mb-4">
          <div class="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col items-center justify-center">
            <h3 class="text-sm sm:text-base font-semibold text-gray-600 mb-2">טמפרטורה נוכחית</h3>
            <div class="text-6xl sm:text-8xl font-black text-blue-600 leading-none">${temp}</div>
          </div>
          <div class="bg-white rounded-3xl shadow-2xl p-5 sm:p-8 flex flex-col items-center justify-center">
            <h3 class="text-sm sm:text-base font-semibold text-gray-600 mb-2">כמות חלב</h3>
            <div class="text-4xl sm:text-6xl font-black text-blue-600 leading-none" dir="ltr">${volume}</div>
          </div>
        </div>

        <!-- Last Update - single row -->
        <p class="text-xs sm:text-sm text-gray-500 text-center mb-4">עדכון: ${lastUpdate}</p>

        <!-- Info Cards -->
        <div class="grid grid-cols-3 gap-3 mb-6">
          <div class="bg-white rounded-lg shadow-lg p-4 text-center">
            <h4 class="text-sm font-semibold text-gray-700 mb-2">סטטוס</h4>
            <p class="text-lg font-medium text-gray-800">${status}</p>
          </div>
          <div class="bg-white rounded-lg shadow-lg p-4 text-center">
            <h4 class="text-sm font-semibold text-gray-700 mb-2">דגם</h4>
            <p class="text-lg font-medium text-gray-800">${model}</p>
          </div>
          <div class="bg-white rounded-lg shadow-lg p-4 text-center">
            <h4 class="text-sm font-semibold text-gray-700 mb-2">מצב מערכת</h4>
            <p class="text-base text-gray-800">${message}</p>
          </div>
        </div>
      </div>
    `;
  }

  function formatTemperature(tempString) {
    if (!tempString || tempString === '--') return '--';
    if (tempString.includes('°C')) return tempString;
    const match = tempString.match(/(\d+[.,]\d+)/);
    if (match) return `${match[1].replace(',', '.')}°C`;
    return tempString;
  }

  function translateStatus(status) {
    if (!status) return '--';
    const translations = {
      'STANDBY': 'המתנה',
      'CLEANING': 'המערכת בשטיפה',
      'COOLING': 'קירור',
      'AGITATING': 'ערבול',
      'DEFROST': 'הפשרה',
      'ALARM': 'אזעקה'
    };
    return translations[status.toUpperCase()] || status;
  }

  function translateTankName(name) {
    if (!name) return null;
    const farmNames = {
      'Maanit': 'מענית',
      'Hhrefet': 'חרפת'
    };
    const cleaned = name.replace(/dairy\s*farm/i, '').trim();
    const translated = farmNames[cleaned] || cleaned;
    return 'רפת ' + translated;
  }

  function translateMessage(msg) {
    if (!msg) return 'אין הודעה';
    if (msg.toLowerCase() === 'everything ok') return 'המערכת במצב תקין';
    return msg;
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      refreshBtn.disabled = true;
      refreshBtn.classList.add('opacity-50', 'cursor-not-allowed');
      refreshIcon.classList.add('animate-spin');
      refreshText.textContent = 'מרענן...';
    } else {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      refreshIcon.classList.remove('animate-spin');
      refreshText.textContent = 'רענן';
    }
  }

  function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  function hideError() {
    errorMessage.classList.add('hidden');
  }
});
