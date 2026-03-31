(function() {
  async function loadWashingTemp() {
    try {
      const params = new URLSearchParams(window.location.search);
      const userId = params.get('userId');
      const url = userId ? `/api/last-washing?userId=${userId}` : '/api/last-washing';
      const resp = await fetch(url, { credentials: 'include' });
      const data = await resp.json();
      if (!data.success || !data.washingData || data.washingData.length === 0) return;

      const container = document.getElementById('washingWidget');
      if (!container) return;

      container.innerHTML = data.washingData.map(w => {
        const dateObj = new Date(w.date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
        const isHot = w.maxTemp >= 55;
        const bgColor = isHot ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300';
        const textColor = isHot ? 'text-green-700' : 'text-red-700';
        const labelColor = isHot ? 'text-green-600' : 'text-red-600';
        return `
          <div class="${bgColor} border rounded-lg px-3 py-1.5 flex items-center gap-2">
            <div>
              <div class="text-xs ${labelColor} font-medium">שטיפה אחרונה (${dateStr})</div>
              <div class="text-xl font-black ${textColor}">${w.maxTemp.toFixed(1)}°C</div>
            </div>
          </div>`;
      }).join('');
    } catch (e) {
      // silently fail
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWashingTemp);
  } else {
    loadWashingTemp();
  }
})();
