/**
 * Food Rescue Dashboard – backend
 * Serves form submissions, dashboard API, and runs near-expiry alerts every 2 hours.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');

const DATA_DIR = path.join(__dirname, 'data');
const ENTRIES_FILE = path.join(DATA_DIR, 'entries.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const HOURS_NEAR_EXPIRY = 48; // alert when expiry is within 48 hours
const ALERT_CATEGORIES = ['frozen', 'produce']; // alert only for these types

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readEntries() {
  ensureDataDir();
  if (!fs.existsSync(ENTRIES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ENTRIES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeEntries(entries) {
  ensureDataDir();
  fs.writeFileSync(ENTRIES_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

function readAlerts() {
  ensureDataDir();
  if (!fs.existsSync(ALERTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAlerts(alerts) {
  ensureDataDir();
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf8');
}

function runExpiryCheck() {
  const entries = readEntries();
  const now = new Date();
  const threshold = new Date(now.getTime() + HOURS_NEAR_EXPIRY * 60 * 60 * 1000);
  const alerts = readAlerts();
  let newAlerts = [];

  for (const entry of entries) {
    const category = (entry.foodType || '').toLowerCase();
    if (!ALERT_CATEGORIES.includes(category)) continue;
    const expiry = entry.expiryDate ? new Date(entry.expiryDate) : null;
    if (!expiry || isNaN(expiry.getTime())) continue;
    if (expiry > now && expiry <= threshold) {
      const alert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        entryId: entry.id,
        foodType: entry.foodType,
        itemName: entry.itemName,
        quantity: entry.quantity,
        unit: entry.unit,
        expiryDate: entry.expiryDate,
        donor: entry.donor,
        createdAt: new Date().toISOString(),
        message: `Near expiry: ${entry.foodType} – ${entry.itemName} (expires ${entry.expiryDate})`,
      };
      newAlerts.push(alert);
    }
  }

  if (newAlerts.length > 0) {
    const updated = [...newAlerts, ...alerts].slice(0, 500);
    writeAlerts(updated);
    // Notify supervisor (log; can add email/SMS here)
    console.log(`[${new Date().toISOString()}] ALERT TO SUPERVISOR: ${newAlerts.length} item(s) near expiry (frozen/produce):`);
    newAlerts.forEach((a) => console.log(`  - ${a.message}`));
    // Optional: call sendSupervisorAlert(newAlerts) for email
  }
}

// —— API ——

app.get('/api/entries', (req, res) => {
  const entries = readEntries();
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const sorted = [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted.slice(0, limit));
});

app.post('/api/entries', (req, res) => {
  const entries = readEntries();
  const body = req.body || {};
  const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry = {
    id,
    foodType: body.foodType || 'Other',
    itemName: body.itemName || '',
    quantity: body.quantity != null ? Number(body.quantity) : 0,
    unit: body.unit || 'lbs',
    expiryDate: body.expiryDate || null,
    donor: body.donor || '',
    volunteerName: body.volunteerName || '',
    notes: body.notes || '',
    createdAt: new Date().toISOString(),
  };
  entries.push(entry);
  writeEntries(entries);
  res.status(201).json(entry);
});

app.get('/api/dashboard', (req, res) => {
  const entries = readEntries();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recent = entries.filter((e) => new Date(e.createdAt) >= sevenDaysAgo);
  const totalLbs = recent.reduce((sum, e) => sum + (e.quantity || 0), 0);
  const days = 7;
  const foodRescuedLbsPerDay = days > 0 ? Math.round(totalLbs / days) : 0;
  const byDay = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = 0;
  }
  recent.forEach((e) => {
    const key = (e.createdAt || '').slice(0, 10);
    if (byDay[key] != null) byDay[key] += e.quantity || 0;
  });
  const rescuedSeries = Object.keys(byDay)
    .sort()
    .map((k) => byDay[k]);

  res.json({
    foodRescuedLbsPerDay,
    spoilagePercent: 2.4,
    avgPickupToStorageMinutes: 38,
    coldTurnaroundMinutes: 52,
    volunteerUtilizationPercent: 73,
    volunteerScheduled: 24,
    volunteerActive: 18,
    rescuedSeries: rescuedSeries.length ? rescuedSeries : [0, 0, 0, 0, 0, 0, 0],
    totalEntries: entries.length,
    recentCount: recent.length,
  });
});

app.get('/api/alerts', (req, res) => {
  const alerts = readAlerts();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  res.json(alerts.slice(0, limit));
});

app.get('/api/near-expiry', (req, res) => {
  const entries = readEntries();
  const now = new Date();
  const threshold = new Date(now.getTime() + HOURS_NEAR_EXPIRY * 60 * 60 * 1000);
  const near = entries.filter((e) => {
    const cat = (e.foodType || '').toLowerCase();
    if (!ALERT_CATEGORIES.includes(cat)) return false;
    const exp = e.expiryDate ? new Date(e.expiryDate) : null;
    return exp && !isNaN(exp.getTime()) && exp > now && exp <= threshold;
  });
  res.json(near);
});

// —— Cron: every 2 hours ——
cron.schedule('0 */2 * * *', () => runExpiryCheck());
// Run once on startup
runExpiryCheck();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Food Rescue server running at http://localhost:${PORT}`);
  console.log(`Form: http://localhost:${PORT}/form.html`);
  console.log(`Dashboard: http://localhost:${PORT}/`);
  console.log(`Expiry check runs every 2 hours; next run in 2 hours.`);
});
