const axios = require('axios');
const cheerio = require('cheerio');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const fs = require('fs');
const path = require('path');

class AuthManager {
  constructor() {
    this.jar = new CookieJar();
    this.client = wrapper(axios.create({
      jar: this.jar,
      maxRedirects: 5,
      validateStatus: (status) => status < 500 // Accept redirects and client errors
    }));

    // Load config
    const configPath = path.join(__dirname, '..', '..', 'config', 'selectors.json');
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  async login(email, password) {
    try {
      console.log('[AuthManager] Starting login process...');

      // Step 1: Get login page to extract CSRF token
      console.log('[AuthManager] Fetching login page for CSRF token...');
      const loginPageResponse = await this.client.get(this.config.loginUrl);

      const $ = cheerio.load(loginPageResponse.data);

      // Try different CSRF token selectors
      let csrfToken = null;
      for (const selector of this.config.csrfTokenSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          csrfToken = element.val() || element.attr('content');
          if (csrfToken) {
            console.log(`[AuthManager] CSRF token found using selector: ${selector}`);
            break;
          }
        }
      }

      if (!csrfToken) {
        console.warn('[AuthManager] No CSRF token found, proceeding without it');
      }

      // Step 2: POST credentials
      console.log('[AuthManager] Submitting login credentials...');
      const loginData = {
        email: email,
        password: password
      };

      if (csrfToken) {
        loginData._token = csrfToken;
      }

      const loginResponse = await this.client.post(
        this.config.loginUrl,
        loginData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': this.config.loginUrl
          }
        }
      );

      // Step 3: Validate login success
      const finalUrl = loginResponse.request.res.responseUrl || loginResponse.config.url;
      console.log('[AuthManager] Final URL after login:', finalUrl);

      // Check if we're still on login page (login failed)
      const isLoginPage = finalUrl.includes('/auth/login') ||
                          loginResponse.data.includes('Login') ||
                          loginResponse.data.includes('login');

      if (isLoginPage) {
        // Look for error message
        const $login = cheerio.load(loginResponse.data);
        const errorMsg = $login('.alert, .error, .danger, [class*="error"]').text().trim();

        console.error('[AuthManager] Login failed - still on login page');
        return {
          success: false,
          error: errorMsg || 'Invalid credentials. Please check your username and password.'
        };
      }

      // Login successful
      console.log('[AuthManager] Login successful!');
      this.dashboardUrl = finalUrl;

      return {
        success: true,
        dashboardUrl: finalUrl
      };

    } catch (error) {
      console.error('[AuthManager] Login error:', error.message);
      return {
        success: false,
        error: 'Cannot connect to PACCOOL. Please check your internet connection.'
      };
    }
  }

  async validateSession() {
    try {
      if (!this.dashboardUrl) {
        return false;
      }

      // Try to access dashboard
      const response = await this.client.get(this.dashboardUrl);
      const finalUrl = response.request.res.responseUrl || response.config.url;

      // If redirected to login, session is invalid
      return !finalUrl.includes('/auth/login');

    } catch (error) {
      console.error('[AuthManager] Session validation error:', error.message);
      return false;
    }
  }

  getClient() {
    return this.client;
  }

  getDashboardUrl() {
    return this.dashboardUrl;
  }
}

module.exports = AuthManager;
