/**
 * Food Rescue Dashboard – backend
 * Uses Excel as primary data store. Accepts Microsoft Forms (import Excel or Power Automate API).
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const multer = require('multer');

const {
  readEntriesFromExcel,
  writeEntriesToExcel,
  migrateJsonToExcel,
  parseUploadedExcel,
  EXCEL_FILE,
} = require('./excel-store');

const DATA_DIR = path.join(__dirname, 'data');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
const HOURS_NEAR_EXPIRY = 48;
const ALERT_CATEGORIES = ['frozen', 'produce'];

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readEntries() {
  return readEntriesFromExcel();
}

function writeEntries(entries) {
  writeEntriesToExcel(entries);
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

// Batch: accept multiple entries at once
app.post('/api/entries/batch', (req, res) => {
  const entries = readEntries();
  const body = req.body || {};
  const items = Array.isArray(body.entries) ? body.entries : [];
  const sharedVolunteer = body.volunteerName || '';
  const sharedDonor = body.donor || '';
  const created = [];
  for (const item of items) {
    const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const entry = {
      id,
      foodType: item.foodType || 'Other',
      itemName: item.itemName || '',
      quantity: item.quantity != null ? Number(item.quantity) : 0,
      unit: item.unit || 'lbs',
      expiryDate: item.expiryDate || null,
      donor: item.donor != null && item.donor !== '' ? item.donor : sharedDonor,
      volunteerName: sharedVolunteer,
      notes: item.notes || '',
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    created.push(entry);
  }
  if (created.length > 0) writeEntries(entries);
  res.status(201).json({ count: created.length, entries: created });
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

// —— Import from Excel (e.g. Microsoft Forms export) ——
app.post('/api/import/excel', upload.single('file'), (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No file uploaded. Use form field name: file' });
  }
  const replace = req.query.replace === '1' || req.query.replace === 'true';
  try {
    const rows = parseUploadedExcel(req.file.buffer);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No valid rows found. Ensure columns like Food Type, Item name, Quantity, Expiry date exist.' });
    }
    const newEntries = rows.map((r) => ({
      id: r.Id,
      foodType: r.FoodType,
      itemName: r.ItemName,
      quantity: r.Quantity,
      unit: r.Unit,
      expiryDate: r.ExpiryDate,
      donor: r.Donor,
      volunteerName: r.VolunteerName,
      notes: r.Notes,
      createdAt: r.CreatedAt,
    }));
    const merged = replace ? newEntries : [...newEntries, ...readEntries()];
    writeEntries(merged);
    res.status(200).json({ count: newEntries.length, message: replace ? `Replaced with ${newEntries.length} row(s).` : `Imported ${newEntries.length} row(s). Data saved to Excel.` });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Import failed' });
  }
});

// —— Export current data as Excel (review/edit in Excel) ——
app.get('/api/export/excel', (req, res) => {
  try {
    if (!fs.existsSync(EXCEL_FILE)) {
      return res.status(404).json({ error: 'No data yet. Add entries or import an Excel file first.' });
    }
    res.download(EXCEL_FILE, 'food_rescue_entries.xlsx', (err) => {
      if (err) res.status(500).json({ error: 'Download failed' });
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Export failed' });
  }
});

// —— Cron: every 2 hours ——
cron.schedule('0 */2 * * *', () => runExpiryCheck());
migrateJsonToExcel();
runExpiryCheck();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Food Rescue server running at http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/  |  Import Excel: http://localhost:${PORT}/import.html`);
  console.log(`Data is stored in Excel: data/food_rescue_entries.xlsx (review and edit there).`);
  console.log(`Expiry check runs every 2 hours.`);
});
