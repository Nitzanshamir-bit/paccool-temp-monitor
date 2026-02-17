// Farms Controller - Farm selection page for dealer/manager users

document.addEventListener('DOMContentLoaded', async () => {
  const farmsContainer = document.getElementById('farmsContainer');
  const logoutBtn = document.getElementById('logoutBtn');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');

  await loadFarms();

  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    } catch (error) {
      window.location.href = '/';
    }
  });

  async function loadFarms() {
    try {
      const response = await fetch('/api/farms', { credentials: 'include' });
      const result = await response.json();

      if (result.success && result.farms) {
        renderFarms(result.farms);
      } else if (result.sessionExpired) {
        showError('ההתחברות פגה. מעביר לדף התחברות...');
        setTimeout(() => { window.location.href = '/'; }, 2000);
      } else {
        showError(result.error || 'שגיאה בטעינת רשימת הרפתות');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('שגיאה בחיבור לשרת.');
    }
  }

  function renderFarms(farms) {
    if (!farms || farms.length === 0) {
      farmsContainer.innerHTML = '<p class="text-center text-gray-500 py-8">לא נמצאו רפתות</p>';
      return;
    }

    const gridClass = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';

    farmsContainer.innerHTML = `<div class="${gridClass}">${farms.map(f => createFarmCard(f)).join('')}</div>`;
  }

  function createFarmCard(farm) {
    const name = translateFarmName(farm.name);
    const tankCount = farm.tankCount || farm.serials.length;
    const serials = farm.serials.join(', ');

    return `
      <a href="/status?userId=${farm.userId}&farmName=${encodeURIComponent(farm.name)}"
         class="bg-white rounded-2xl shadow-lg p-6 text-center hover:shadow-xl hover:scale-105 transition-all cursor-pointer block">
        <div class="text-3xl mb-3">🐄</div>
        <h3 class="text-lg font-bold text-gray-800 mb-2">${name}</h3>
        <p class="text-sm text-gray-500">${tankCount} טנק${tankCount > 1 ? 'ים' : ''}</p>
        <p class="text-xs text-gray-400 mt-1">${serials}</p>
      </a>
    `;
  }

  function translateFarmName(name) {
    if (!name) return 'לא ידוע';
    // Already Hebrew
    if (/[\u0590-\u05FF]/.test(name)) return 'רפת ' + name;
    // English farm names
    const cleaned = name.replace(/dairy\s*farm/i, '').trim();
    const farmNames = {
      'Maanit': 'מענית',
      'Navi': 'נווה',
      'DOR DAVID': 'דור דוד',
      'Reffet Nahall oz': 'נחל עוז'
    };
    const translated = farmNames[cleaned] || cleaned;
    return 'רפת ' + translated;
  }

  function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
  }
});
