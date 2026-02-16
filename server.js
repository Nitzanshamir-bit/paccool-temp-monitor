const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const PaccoolScraper = require('./src/scraper/paccoolScraper');
const CredentialStore = require('./src/storage/credentialStore');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'paccool-temp-monitor-v2-secret-key-change-in-production';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: false,
    httpOnly: false,
    sameSite: 'lax'
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'renderer')));
app.use('/js', express.static(path.join(__dirname, 'renderer', 'js')));

const credentialStore = new CredentialStore();

function getScraper(req) {
  if (!global.scrapers) global.scrapers = {};
  if (!global.scrapers[req.sessionID]) {
    global.scrapers[req.sessionID] = new PaccoolScraper();
  }
  return global.scrapers[req.sessionID];
}

// Helper: auto re-login with stored credentials
async function tryAutoRelogin(scraper, credentialStore) {
  const credResult = credentialStore.getCredentials();
  if (credResult.success && credResult.credentials) {
    console.log('[API] Stored credentials found, re-logging in...');
    const loginResult = await scraper.login(
      credResult.credentials.email,
      credResult.credentials.password
    );
    return loginResult.success;
  }
  return false;
}

// === Pages ===

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'login.html'));
});

app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'status.html'));
});

app.get('/graphs', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'graphs.html'));
});

// === API: Auth ===

app.post('/api/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;
  console.log('[API] Login request for:', email);

  const scraper = getScraper(req);
  const result = await scraper.login(email, password);

  if (result.success) {
    req.session.isAuthenticated = true;

    if (rememberMe) {
      credentialStore.saveCredentials(email, password);
    }

    req.session.save((err) => {
      if (err) {
        return res.json({ success: false, error: 'Session save failed' });
      }
      res.json(result);
    });
  } else {
    res.json(result);
  }
});

app.post('/api/logout', (req, res) => {
  if (req.sessionID && global.scrapers && global.scrapers[req.sessionID]) {
    delete global.scrapers[req.sessionID];
  }
  req.session.destroy((err) => {
    res.json(err ? { success: false, error: err.message } : { success: true });
  });
});

// === API: Temperature (multi-tank) ===

app.get('/api/temperature', async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.json({ success: false, error: 'Not authenticated', sessionExpired: true });
  }

  const scraper = getScraper(req);
  let result = await scraper.getAllTanksData();

  // Auto re-login on session expire
  if (result.sessionExpired) {
    const relogged = await tryAutoRelogin(scraper, credentialStore);
    if (relogged) {
      result = await scraper.getAllTanksData();
    }
  }

  res.json(result);
});

// === API: Tanks list ===

app.get('/api/tanks', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.json({ success: false, error: 'Not authenticated', sessionExpired: true });
  }

  const scraper = getScraper(req);
  const tanks = scraper.getTanks();

  res.json({
    success: true,
    tanks: tanks.map(t => ({
      serial: t.serial,
      name: t.name || 'Unknown',
      model: t.model || '--',
      tankId: t.tankId
    }))
  });
});

// === API: Graph data ===

app.get('/api/graph/:serial', async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.json({ success: false, error: 'Not authenticated', sessionExpired: true });
  }

  const { serial } = req.params;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const scraper = getScraper(req);
  let result = await scraper.getGraphData(serial, date);

  if (result.sessionExpired) {
    const relogged = await tryAutoRelogin(scraper, credentialStore);
    if (relogged) {
      result = await scraper.getGraphData(serial, date);
    }
  }

  res.json(result);
});

app.get('/api/graphs', async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.json({ success: false, error: 'Not authenticated', sessionExpired: true });
  }

  const date = req.query.date || new Date().toISOString().split('T')[0];

  const scraper = getScraper(req);
  let result = await scraper.getAllTanksGraphData(date);

  if (result.sessionExpired) {
    const relogged = await tryAutoRelogin(scraper, credentialStore);
    if (relogged) {
      result = await scraper.getAllTanksGraphData(date);
    }
  }

  res.json(result);
});

// === API: Credentials ===

app.get('/api/credentials', (req, res) => {
  const result = credentialStore.getCredentials();
  if (result.success && result.credentials) {
    res.json({ success: true, credentials: { email: result.credentials.email } });
  } else {
    res.json({ success: false, credentials: null });
  }
});

app.delete('/api/credentials', (req, res) => {
  res.json(credentialStore.clearCredentials());
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('PACCOOL Temperature Monitor V2 - Web App');
  console.log('='.repeat(60));
  console.log(`\n✓ Server running at: http://localhost:${PORT}`);
  console.log('\nFeatures: Multi-tank support, Graph view');
  console.log('Press Ctrl+C to stop the server');
  console.log('='.repeat(60));
});
