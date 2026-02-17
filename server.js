const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const PaccoolScraper = require('./src/scraper/paccoolScraper');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'paccool-temp-monitor-v2-secret-key-change-in-production';

// Cookie-based credential encryption (survives server restarts)
const COOKIE_KEY = crypto.scryptSync(SESSION_SECRET, 'paccool-salt', 32);
function encryptCreds(email, password) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', COOKIE_KEY, iv);
  let enc = cipher.update(JSON.stringify({ email, password }), 'utf8', 'hex');
  enc += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
}
function decryptCreds(token) {
  try {
    const [ivHex, enc] = token.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', COOKIE_KEY, Buffer.from(ivHex, 'hex'));
    let dec = decipher.update(enc, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return JSON.parse(dec);
  } catch { return null; }
}

// Middleware
const cookieParser = require('cookie-parser');
app.use(cookieParser());
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

function getScraper(req) {
  if (!global.scrapers) global.scrapers = {};
  if (!global.scrapers[req.sessionID]) {
    global.scrapers[req.sessionID] = new PaccoolScraper();
  }
  return global.scrapers[req.sessionID];
}

// Helper: auto re-login with stored credentials from cookie
async function tryAutoRelogin(req, scraper) {
  const token = req.cookies && req.cookies.remember_token;
  if (!token) return false;
  const creds = decryptCreds(token);
  if (creds) {
    console.log('[API] Remember cookie found, re-logging in...');
    const loginResult = await scraper.login(creds.email, creds.password);
    if (loginResult.success) {
      req.session.isAuthenticated = true;
      req.session.isDealer = loginResult.isDealer || false;
      return true;
    }
  }
  return false;
}

// === Keep-alive: self-ping every 14 min to prevent Render free tier spin-down ===

app.get('/api/ping', (req, res) => res.json({ status: 'ok' }));

// === Pages ===

app.get('/', async (req, res) => {
  // Auto-login if remember cookie exists and no active session
  if (!req.session.isAuthenticated && req.cookies && req.cookies.remember_token) {
    const creds = decryptCreds(req.cookies.remember_token);
    if (creds) {
      const scraper = getScraper(req);
      const loginResult = await scraper.login(creds.email, creds.password);
      if (loginResult.success) {
        req.session.isAuthenticated = true;
        req.session.isDealer = loginResult.isDealer || false;
        return req.session.save(() => {
          res.redirect(loginResult.isDealer ? '/farms' : '/status');
        });
      }
    }
    // Invalid cookie - clear it
    res.clearCookie('remember_token');
  }
  res.sendFile(path.join(__dirname, 'renderer', 'login.html'));
});

app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'status.html'));
});

app.get('/graphs', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'graphs.html'));
});

app.get('/farms', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'farms.html'));
});

// === API: Auth ===

app.post('/api/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;
  console.log('[API] Login request for:', email);

  const scraper = getScraper(req);
  const result = await scraper.login(email, password);

  if (result.success) {
    req.session.isAuthenticated = true;
    req.session.isDealer = result.isDealer || false;

    if (rememberMe) {
      const token = encryptCreds(email, password);
      res.cookie('remember_token', token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
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
  res.clearCookie('remember_token');
  req.session.destroy((err) => {
    res.json(err ? { success: false, error: err.message } : { success: true });
  });
});

// === API: Farms (dealer mode) ===

app.get('/api/farms', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.json({ success: false, error: 'Not authenticated', sessionExpired: true });
  }

  const scraper = getScraper(req);
  if (!scraper.isDealer()) {
    return res.json({ success: false, error: 'Not a dealer account' });
  }

  const farms = scraper.getFarms();
  res.json({
    success: true,
    farms: farms.map(f => ({
      name: f.name,
      userId: f.userId,
      tankCount: f.tankCount,
      serials: f.serials
    }))
  });
});

// === API: Temperature (multi-tank) ===

app.get('/api/temperature', async (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.json({ success: false, error: 'Not authenticated', sessionExpired: true });
  }

  const scraper = getScraper(req);
  const userId = req.query.userId;

  let result;

  // Dealer viewing a specific farm
  if (userId && scraper.isDealer()) {
    result = await scraper.getFarmTanksData(userId);
  } else {
    result = await scraper.getAllTanksData();
  }

  // Auto re-login on session expire
  if (result.sessionExpired) {
    const relogged = await tryAutoRelogin(req, scraper);
    if (relogged) {
      if (userId && scraper.isDealer()) {
        result = await scraper.getFarmTanksData(userId);
      } else {
        result = await scraper.getAllTanksData();
      }
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
    const relogged = await tryAutoRelogin(req, scraper);
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
  const userId = req.query.userId;

  const scraper = getScraper(req);
  let result;

  // Dealer viewing a specific farm's graphs
  if (userId && scraper.isDealer()) {
    result = await scraper.getFarmGraphData(userId, date);
  } else {
    result = await scraper.getAllTanksGraphData(date);
  }

  if (result.sessionExpired) {
    const relogged = await tryAutoRelogin(req, scraper);
    if (relogged) {
      if (userId && scraper.isDealer()) {
        result = await scraper.getFarmGraphData(userId, date);
      } else {
        result = await scraper.getAllTanksGraphData(date);
      }
    }
  }

  res.json(result);
});

// === API: Credentials ===

app.get('/api/credentials', (req, res) => {
  const token = req.cookies && req.cookies.remember_token;
  if (token) {
    const creds = decryptCreds(token);
    if (creds) {
      return res.json({ success: true, credentials: { email: creds.email } });
    }
  }
  res.json({ success: false, credentials: null });
});

app.delete('/api/credentials', (req, res) => {
  res.clearCookie('remember_token');
  res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('PACCOOL Temperature Monitor V2 - Web App');
  console.log('='.repeat(60));
  console.log(`\n✓ Server running at: http://localhost:${PORT}`);
  console.log('\nFeatures: Multi-tank support, Graph view, Dealer mode');
  console.log('Press Ctrl+C to stop the server');
  console.log('='.repeat(60));

  // Keep-alive: ping ourselves every 14 minutes to prevent Render spin-down
  const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    const mod = KEEP_ALIVE_URL.startsWith('https') ? require('https') : require('http');
    mod.get(`${KEEP_ALIVE_URL}/api/ping`, () => {}).on('error', () => {});
  }, 14 * 60 * 1000);
});
