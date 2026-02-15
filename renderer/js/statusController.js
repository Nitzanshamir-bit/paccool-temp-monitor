// Status Controller - Handles temperature display and refresh

document.addEventListener('DOMContentLoaded', async () => {
  const tankNameEl = document.getElementById('tankName');
  const tankSerialEl = document.getElementById('tankSerial');
  const temperatureEl = document.getElementById('temperature');
  const timestampEl = document.getElementById('timestamp');
  const statusEl = document.getElementById('status');
  const modelEl = document.getElementById('model');
  const messageEl = document.getElementById('message');
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshIcon = document.getElementById('refreshIcon');
  const refreshText = document.getElementById('refreshText');
  const logoutBtn = document.getElementById('logoutBtn');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  // Load temperature data on page load
  await loadTemperatureData();

  // Handle refresh button
  refreshBtn.addEventListener('click', async () => {
    await loadTemperatureData();
  });

  // Handle logout button
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include' // Include cookies in request
      });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  });

  async function loadTemperatureData() {
    setLoadingState(true);
    hideError();

    try {
      const response = await fetch('/api/temperature', {
        credentials: 'include' // IMPORTANT: Include cookies to send session
      });
      const result = await response.json();

      if (result.success && result.data) {
        updateDisplay(result.data);
      } else if (result.sessionExpired) {
        // Session expired, return to login
        showError('ההתחברות פגה. מעביר לדף התחברות...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        let errorMsg = result.error || 'שגיאה בטעינת נתוני הטמפרטורה';

        // Translate common errors
        if (errorMsg.includes('Failed to load') || errorMsg.includes('failed to fetch')) {
          errorMsg = 'שגיאה בטעינת נתונים';
        } else if (errorMsg.includes('network') || errorMsg.includes('connect')) {
          errorMsg = 'בעיית חיבור לשרת';
        }

        showError(errorMsg);
      }
    } catch (error) {
      console.error('Error loading temperature data:', error);
      showError('שגיאה בחיבור לשרת. בדוק את חיבור האינטרנט.');
    } finally {
      setLoadingState(false);
    }
  }

  function updateDisplay(data) {
    // Update tank name and serial (keep original English from PACCOOL)
    tankNameEl.textContent = data.tankName || 'לא ידוע';
    tankSerialEl.textContent = data.serial ? `מספר סידורי: ${data.serial}` : '';

    // Update temperature (ensure it has °C symbol)
    temperatureEl.textContent = formatTemperature(data.temperature);

    // Update timestamp
    timestampEl.textContent = `עדכון אחרון: ${formatTimestamp(data.timestamp)}`;

    // Update status - translate to Hebrew
    let status = data.status || '--';
    const statusTranslations = {
      'STANDBY': 'המתנה',
      'CLEANING': 'המערכת בשטיפה',
      'COOLING': 'קירור',
      'AGITATING': 'ערבול',
      'DEFROST': 'הפשרה',
      'ALARM': 'אזעקה'
    };
    statusEl.textContent = statusTranslations[status.toUpperCase()] || status;

    // Update model - add "סילו" for VM/DX
    let model = data.model || '--';
    if (model === 'VM/DX') {
      model = 'סילו VM/DX';
    }
    modelEl.textContent = model;

    // Update system message - translate "Everything ok" to Hebrew
    let systemMessage = data.message || 'אין הודעה';
    if (systemMessage.toLowerCase() === 'everything ok') {
      systemMessage = 'המערכת במצב תקין';
    }
    messageEl.textContent = systemMessage;

    console.log('Display updated with data:', data);
  }

  function formatTemperature(tempString) {
    if (!tempString) return '--';

    // Ensure the temperature has the °C symbol
    if (tempString.includes('°C')) {
      return tempString;
    }

    // Try to extract numeric value
    const match = tempString.match(/(\d+[.,]\d+)/);
    if (match) {
      const value = match[1].replace(',', '.');
      return `${value}°C`;
    }

    return tempString;
  }

  function formatTimestamp(timestamp) {
    if (!timestamp) return '--';

    // Timestamp is already in correct format: "2026-02-13 10:15:41"
    // Just clean it up
    return timestamp.trim();
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
