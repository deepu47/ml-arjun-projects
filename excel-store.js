/**
 * Excel as primary store for food rescue entries.
 * Sheet: "Entries" with columns Id, FoodType, ItemName, Quantity, Unit, ExpiryDate, Donor, VolunteerName, Notes, CreatedAt
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_DIR = path.join(__dirname, 'data');
const EXCEL_FILE = path.join(DATA_DIR, 'food_rescue_entries.xlsx');
const ENTRIES_FILE = path.join(DATA_DIR, 'entries.json');
const SHEET_NAME = 'Entries';
const HEADERS = ['Id', 'FoodType', 'ItemName', 'Quantity', 'Unit', 'ExpiryDate', 'Donor', 'VolunteerName', 'Notes', 'CreatedAt'];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function rowToEntry(row) {
  const qty = row.Quantity;
  return {
    id: row.Id || '',
    foodType: row.FoodType || 'Other',
    itemName: row.ItemName || '',
    quantity: qty != null && qty !== '' ? Number(qty) : 0,
    unit: row.Unit || 'lbs',
    expiryDate: row.ExpiryDate != null && row.ExpiryDate !== '' ? String(row.ExpiryDate).slice(0, 10) : null,
    donor: row.Donor || '',
    volunteerName: row.VolunteerName || '',
    notes: row.Notes || '',
    createdAt: row.CreatedAt || new Date().toISOString(),
  };
}

function entryToRow(entry) {
  return {
    Id: entry.id,
    FoodType: entry.foodType,
    ItemName: entry.itemName,
    Quantity: entry.quantity,
    Unit: entry.unit,
    ExpiryDate: entry.expiryDate,
    Donor: entry.donor,
    VolunteerName: entry.volunteerName,
    Notes: entry.notes,
    CreatedAt: typeof entry.createdAt === 'string' ? entry.createdAt.slice(0, 19) : (entry.createdAt || ''),
  };
}

function readEntriesFromExcel() {
  ensureDataDir();
  if (!fs.existsSync(EXCEL_FILE)) return [];
  try {
    const wb = XLSX.readFile(EXCEL_FILE);
    const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return data.map(rowToEntry).filter((e) => e.id || e.itemName);
  } catch (err) {
    console.warn('Excel read failed:', err.message);
    return [];
  }
}

function writeEntriesToExcel(entries) {
  ensureDataDir();
  const rows = [HEADERS, ...(entries || []).map(entryToRow)];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  XLSX.writeFile(wb, EXCEL_FILE);
}

/** Migrate from JSON to Excel if Excel doesn't exist and JSON does */
function migrateJsonToExcel() {
  if (fs.existsSync(EXCEL_FILE)) return;
  if (!fs.existsSync(ENTRIES_FILE)) return;
  try {
    const entries = JSON.parse(fs.readFileSync(ENTRIES_FILE, 'utf8'));
    if (entries.length > 0) {
      writeEntriesToExcel(entries);
      console.log('Migrated', entries.length, 'entries from JSON to Excel.');
    }
  } catch (_) {}
}

/** Map Microsoft Forms / generic Excel columns to our row */
function mapImportedRow(rawRow) {
  const key = (k) => {
    const lower = (v) => String(v || '').toLowerCase().trim();
    const keys = Object.keys(rawRow || {}).filter((kk) => lower(kk).includes(lower(k)));
    return keys[0] ? rawRow[keys[0]] : undefined;
  };
  const first = (arr) => (Array.isArray(arr) ? arr.find((x) => x) : arr);
  const num = (v) => (v !== undefined && v !== null && v !== '' ? Number(v) : 0);
  const str = (v) => (v !== undefined && v !== null ? String(v).trim() : '');
  const dateStr = (v) => {
    if (v == null || v === '') return null;
    if (typeof v === 'number' && v > 0) {
      const d = new Date((v - 25569) * 86400 * 1000);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    const s = String(v).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s || null;
  };
  const foodTypeAliases = ['food type', 'foodtype', 'type', 'category'];
  const itemNameAliases = ['item name', 'itemname', 'item', 'description', 'food item'];
  const quantityAliases = ['quantity', 'qty', 'amount'];
  const unitAliases = ['unit', 'units'];
  const expiryAliases = ['expiry', 'expiry date', 'expirydate', 'use by', 'use-by'];
  const donorAliases = ['donor', 'source', 'store'];
  const volunteerAliases = ['volunteer', 'volunteer name', 'your name', 'name'];
  const notesAliases = ['notes', 'note'];
  const findCol = (aliases) => {
    const lower = (v) => String(v || '').toLowerCase().trim();
    for (const a of aliases) {
      const k = Object.keys(rawRow || {}).find((kk) => lower(kk) === a || lower(kk).includes(a));
      if (k != null && rawRow[k] !== undefined && rawRow[k] !== '') return rawRow[k];
    }
    return undefined;
  };
  return {
    Id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    FoodType: str(findCol(foodTypeAliases)) || 'Other',
    ItemName: str(findCol(itemNameAliases)),
    Quantity: num(findCol(quantityAliases)),
    Unit: str(findCol(unitAliases)) || 'lbs',
    ExpiryDate: dateStr(findCol(expiryAliases)),
    Donor: str(findCol(donorAliases)),
    VolunteerName: str(findCol(volunteerAliases)),
    Notes: str(findCol(notesAliases)),
    CreatedAt: new Date().toISOString(),
  };
}

function parseUploadedExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows.map(mapImportedRow).filter((r) => r.ItemName);
}

module.exports = {
  readEntriesFromExcel,
  writeEntriesToExcel,
  migrateJsonToExcel,
  parseUploadedExcel,
  entryToRow,
  HEADERS,
  EXCEL_FILE,
  SHEET_NAME,
};
