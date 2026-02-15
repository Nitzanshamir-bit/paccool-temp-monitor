const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const PaccoolScraper = require('./src/scraper/paccoolScraper');
const CredentialStore = require('./src/storage/credentialStore');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'paccool-temp-monitor-secret-key-change-in-production';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration - using the working settings
app.use(session({
  secret: SESSION_SECRET,
  resave: true, // Force session save
  saveUninitialized: true, // Create session immediately
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: false, // Allow on HTTP and HTTPS
    httpOnly: false, // Allow JavaScript access for debugging
    sameSite: 'lax'
  }
}));

// Serve static files from renderer directory
app.use(express.static(path.join(__dirname, 'renderer')));
app.use('/js', express.static(path.join(__dirname, 'renderer', 'js')));

// Initialize scraper and credential store
const credentialStore = new CredentialStore();

// Ensure each session has its own scraper instance
function getScraper(req) {
  if (!req.session.scraper) {
    req.session.scraper = new PaccoolScraper();
  }
  // Note: We can't store the actual instance in session, so we'll use a singleton approach
  if (!global.scrapers) {
    global.scrapers = {};
  }
  if (!global.scrapers[req.sessionID]) {
    global.scrapers[req.sessionID] = new PaccoolScraper();
  }
  return global.scrapers[req.sessionID];
}

// Routes

// Serve login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'login.html'));
});

// Serve status page
app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'status.html'));
});

// API: Login
app.post('/api/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;

  console.log('[API] Login request for:', email);

  const scraper = getScraper(req);
  const result = await scraper.login(email, password);

  if (result.success) {
    req.session.isAuthenticated = true;
    console.log('[API] Login successful - Session ID:', req.sessionID);
    console.log('[API] Login successful - Session before save:', JSON.stringify(req.session));

    if (rememberMe) {
      credentialStore.saveCredentials(email, password);
    }

    // Save session before sending response to ensure it's persisted
    req.session.save((err) => {
      if (err) {
        console.error('[API] Session save error:', err);
        return res.json({ success: false, error: 'Session save failed' });
      }
      console.log('[API] Session saved successfully - ID:', req.sessionID);
      console.log('[API] Session after save:', JSON.stringify(req.session));
      res.json(result);
    });
  } else {
    res.json(result);
  }
});

// API: Get temperature data
app.get('/api/temperature', async (req, res) => {
  console.log('[API] Get temperature request');
  console.log('[API] Session ID:', req.sessionID);
  console.log('[API] Session data:', JSON.stringify(req.session));
  console.log('[API] Cookies:', req.headers.cookie);

  // Check if user is authenticated
  if (!req.session.isAuthenticated) {
    console.log('[API] Unauthorized temperature request - no session');
    console.log('[API] req.session.isAuthenticated:', req.session.isAuthenticated);
    return res.json({
      success: false,
      error: 'Not authenticated. Please login first',
      sessionExpired: true
    });
  }

  const scraper = getScraper(req);
  let result = await scraper.getTemperatureData();

  // If session expired, try to re-login with stored credentials
  if (result.sessionExpired) {
    console.log('[API] Session expired, attempting auto re-login...');

    const credResult = credentialStore.getCredentials();
    if (credResult.success && credResult.credentials) {
      console.log('[API] Stored credentials found, re-logging in...');

      const loginResult = await scraper.login(
        credResult.credentials.email,
        credResult.credentials.password
      );

      if (loginResult.success) {
        console.log('[API] Auto re-login successful, retrying temperature fetch...');
        result = await scraper.getTemperatureData();
      }
    }
  }

  res.json(result);
});

// API: Get stored credentials
app.get('/api/credentials', (req, res) => {
  console.log('[API] Get stored credentials request');
  const result = credentialStore.getCredentials();

  // Don't send password to frontend for security
  if (result.success && result.credentials) {
    res.json({
      success: true,
      credentials: {
        email: result.credentials.email
        // Password intentionally not included
      }
    });
  } else {
    res.json({ success: false, credentials: null });
  }
});

// API: Clear credentials
app.delete('/api/credentials', (req, res) => {
  console.log('[API] Clear credentials request');
  const result = credentialStore.clearCredentials();
  res.json(result);
});

// API: Logout
app.post('/api/logout', (req, res) => {
  console.log('[API] Logout request');

  // Clear session
  if (req.sessionID && global.scrapers && global.scrapers[req.sessionID]) {
    delete global.scrapers[req.sessionID];
  }

  req.session.destroy((err) => {
    if (err) {
      res.json({ success: false, error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('PACCOOL Temperature Monitor - Web App');
  console.log('='.repeat(60));
  console.log(`\n✓ Server running at: http://localhost:${PORT}`);
  console.log('\nTo use the app:');
  console.log('  1. Open your browser');
  console.log(`  2. Go to: http://localhost:${PORT}`);
  console.log('  3. Login with your PACCOOL credentials\n');
  console.log('Press Ctrl+C to stop the server');
  console.log('='.repeat(60));
});
