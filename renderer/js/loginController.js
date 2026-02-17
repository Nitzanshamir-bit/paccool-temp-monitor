// Login Controller - Handles login form submission and UI updates

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const rememberMeCheckbox = document.getElementById('rememberMe');
  const loginButton = document.getElementById('loginButton');
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  const loadingState = document.getElementById('loadingState');
  const quickLoginSection = document.getElementById('quickLoginSection');
  const forgetCredentialsBtn = document.getElementById('forgetCredentials');

  // Check if credentials are stored on page load
  checkStoredCredentials();

  // Handle form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleLogin();
  });

  // Handle forget credentials button
  forgetCredentialsBtn.addEventListener('click', async () => {
    console.log('Forget credentials clicked');
    await fetch('/api/credentials', {
      method: 'DELETE',
      credentials: 'include' // Include cookies in request
    });
    quickLoginSection.classList.add('hidden');
    usernameInput.value = '';
  });

  async function checkStoredCredentials() {
    try {
      const response = await fetch('/api/credentials', {
        credentials: 'include' // Include cookies in request
      });
      const result = await response.json();

      if (result.success && result.credentials) {
        // Show quick login option
        quickLoginSection.classList.remove('hidden');

        // Pre-fill email if available
        if (result.credentials.email) {
          usernameInput.value = result.credentials.email;
        }
      }
    } catch (error) {
      console.error('Error checking stored credentials:', error);
    }
  }

  async function handleLogin() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const rememberMe = rememberMeCheckbox.checked;

    // Validate inputs
    if (!username || !password) {
      showError('אנא הזן שם משתמש וסיסמה');
      return;
    }

    // Show loading state
    setLoadingState(true);
    hideError();

    try {
      // Call login API
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // IMPORTANT: Include cookies in request
        body: JSON.stringify({
          email: username,
          password: password,
          rememberMe: rememberMe
        })
      });

      const result = await response.json();

      if (result.success) {
        // Login successful - redirect based on account type
        window.location.href = result.isDealer ? '/farms' : '/status';
      } else {
        // Login failed - show error
        let errorMsg = result.error || 'ההתחברות נכשלה. אנא נסה שוב.';

        // Translate common errors to Hebrew
        if (errorMsg.includes('Invalid credentials') || errorMsg.includes('invalid credentials')) {
          errorMsg = 'שם משתמש או סיסמה שגויים';
        } else if (errorMsg.includes('Cannot connect') || errorMsg.includes('network')) {
          errorMsg = 'לא ניתן להתחבר לשרת PACCOOL. בדוק את חיבור האינטרנט.';
        }

        showError(errorMsg);
      }
    } catch (error) {
      console.error('Login error:', error);
      showError('לא ניתן להתחבר לשרת. אנא בדוק את חיבור האינטרנט.');
    } finally {
      setLoadingState(false);
    }
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      loginButton.classList.add('hidden');
      loadingState.classList.remove('hidden');
      usernameInput.disabled = true;
      passwordInput.disabled = true;
      rememberMeCheckbox.disabled = true;
    } else {
      loginButton.classList.remove('hidden');
      loadingState.classList.add('hidden');
      usernameInput.disabled = false;
      passwordInput.disabled = false;
      rememberMeCheckbox.disabled = false;
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
