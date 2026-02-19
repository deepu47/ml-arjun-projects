"""
Food Rescue data layer – same logic as Node server.
Reads/writes data/entries.json and data/alerts.json.
"""
import json
import os
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
ENTRIES_FILE = os.path.join(DATA_DIR, "entries.json")
ALERTS_FILE = os.path.join(DATA_DIR, "alerts.json")
HOURS_NEAR_EXPIRY = 48
ALERT_CATEGORIES = ["frozen", "produce"]


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def read_entries():
    _ensure_data_dir()
    if not os.path.exists(ENTRIES_FILE):
        return []
    try:
        with open(ENTRIES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def write_entries(entries):
    _ensure_data_dir()
    with open(ENTRIES_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)


def read_alerts():
    _ensure_data_dir()
    if not os.path.exists(ALERTS_FILE):
        return []
    try:
        with open(ALERTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def write_alerts(alerts):
    _ensure_data_dir()
    with open(ALERTS_FILE, "w", encoding="utf-8") as f:
        json.dump(alerts, f, indent=2, ensure_ascii=False)


def add_entry(food_type, item_name, quantity, unit, expiry_date, donor="", volunteer_name="", notes=""):
    import time
    import random
    import string
    entries = read_entries()
    eid = f"entry-{int(time.time() * 1000)}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=7))}"
    entry = {
        "id": eid,
        "foodType": food_type or "Other",
        "itemName": item_name or "",
        "quantity": float(quantity) if quantity is not None else 0,
        "unit": unit or "lbs",
        "expiryDate": expiry_date or None,
        "donor": donor or "",
        "volunteerName": volunteer_name or "",
        "notes": notes or "",
        "createdAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    }
    entries.append(entry)
    write_entries(entries)
    return entry


def _parse_date(s):
    """Parse YYYY-MM-DD or ISO datetime to date."""
    if not s:
        return None
    s = str(s).strip()[:10]
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def get_near_expiry():
    """Items (frozen/produce) expiring within HOURS_NEAR_EXPIRY."""
    entries = read_entries()
    now = datetime.utcnow()
    now_date = now.date()
    threshold_date = (now + timedelta(hours=HOURS_NEAR_EXPIRY)).date()
    result = []
    for e in entries:
        cat = (e.get("foodType") or "").lower()
        if cat not in ALERT_CATEGORIES:
            continue
        exp_date = _parse_date(e.get("expiryDate"))
        if not exp_date:
            continue
        if now_date < exp_date <= threshold_date:
            result.append(e)
    return result


def run_expiry_check():
    """Find near-expiry frozen/produce, append to alerts (same as Node cron)."""
    entries = read_entries()
    now = datetime.utcnow()
    now_date = now.date()
    threshold_date = (now + timedelta(hours=HOURS_NEAR_EXPIRY)).date()
    alerts = read_alerts()
    new_alerts = []
    for e in entries:
        cat = (e.get("foodType") or "").lower()
        if cat not in ALERT_CATEGORIES:
            continue
        exp_date = _parse_date(e.get("expiryDate"))
        if not exp_date:
            continue
        if now_date < exp_date <= threshold_date:
            ed = e.get("expiryDate")
            new_alerts.append({
                    "id": f"alert-{int(now.timestamp() * 1000)}-{e.get('id', '')[-7:]}",
                    "entryId": e.get("id"),
                    "foodType": e.get("foodType"),
                    "itemName": e.get("itemName"),
                    "quantity": e.get("quantity"),
                    "unit": e.get("unit"),
                    "expiryDate": ed,
                    "donor": e.get("donor"),
                    "createdAt": now.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                    "message": f"Near expiry: {e.get('foodType')} – {e.get('itemName')} (expires {ed})",
                })
    if new_alerts:
        updated = (new_alerts + alerts)[:500]
        write_alerts(updated)
    return new_alerts


def dashboard_stats():
    """Aggregates for Operations dashboard (7-day rescues, etc.)."""
    entries = read_entries()
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)
    recent = []
    for e in entries:
        try:
            ct = (e.get("createdAt") or "")[:10]
            if ct and ct >= seven_days_ago.strftime("%Y-%m-%d"):
                recent.append(e)
        except (ValueError, TypeError):
            pass
    total_qty = sum(float(e.get("quantity") or 0) for e in recent)
    by_day = {}
    for i in range(7):
        d = seven_days_ago + timedelta(days=i)
        by_day[d.strftime("%Y-%m-%d")] = 0
    for e in recent:
        ct = (e.get("createdAt") or "")[:10]
        if ct in by_day:
            by_day[ct] += float(e.get("quantity") or 0)
    rescued_series = [by_day[k] for k in sorted(by_day)]
    return {
        "foodRescuedLbsPerDay": round(total_qty / 7) if recent else 0,
        "totalEntries": len(entries),
        "recentCount": len(recent),
        "rescuedSeries": rescued_series or [0] * 7,
    }
