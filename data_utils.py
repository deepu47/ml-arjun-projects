"""
Food Rescue data layer.
Uses Excel (food_rescue_entries.xlsx) when present, else entries.json.
Same schema as Node server so dashboard and Excel can be shared.
"""
import json
import os
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
ENTRIES_FILE = os.path.join(DATA_DIR, "entries.json")
EXCEL_FILE = os.path.join(DATA_DIR, "food_rescue_entries.xlsx")
ALERTS_FILE = os.path.join(DATA_DIR, "alerts.json")
HOURS_NEAR_EXPIRY = 48
ALERT_CATEGORIES = ["frozen", "produce"]


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _excel_to_entries():
    """Read entries from Excel file (same format as Node excel-store)."""
    try:
        import pandas as pd
        if not os.path.exists(EXCEL_FILE):
            return None
        df = pd.read_excel(EXCEL_FILE, sheet_name="Entries", engine="openpyxl")
        if df is None or df.empty:
            return []
        out = []
        for _, row in df.iterrows():
            e = row.to_dict()
            if not e.get("ItemName") and not e.get("Id"):
                continue
            def _str(v, date_only=False):
                if v is None or (isinstance(v, float) and (v != v or v == 0)): return ""
                if hasattr(v, "strftime"): return v.strftime("%Y-%m-%d") if date_only else str(v)[:19].replace(" ", "T")
                s = str(v).strip()
                return s[:10] if date_only and s else s[:19] if not date_only and s else s
            out.append({
                "id": str(e.get("Id", "")),
                "foodType": e.get("FoodType") or "Other",
                "itemName": str(e.get("ItemName", "")),
                "quantity": float(e.get("Quantity", 0)) if e.get("Quantity") not in (None, "") else 0,
                "unit": str(e.get("Unit", "lbs")),
                "expiryDate": _str(e.get("ExpiryDate"), date_only=True) or None,
                "donor": str(e.get("Donor", "")),
                "volunteerName": str(e.get("VolunteerName", "")),
                "notes": str(e.get("Notes", "")),
                "createdAt": _str(e.get("CreatedAt", ""), date_only=False),
            })
        return out
    except Exception:
        return None


def _entries_to_excel(entries):
    """Write entries to Excel (same format as Node)."""
    try:
        import pandas as pd
        _ensure_data_dir()
        cols = ["Id", "FoodType", "ItemName", "Quantity", "Unit", "ExpiryDate", "Donor", "VolunteerName", "Notes", "CreatedAt"]
        rows = []
        for e in entries:
            rows.append({
                "Id": e.get("id"),
                "FoodType": e.get("foodType"),
                "ItemName": e.get("itemName"),
                "Quantity": e.get("quantity"),
                "Unit": e.get("unit"),
                "ExpiryDate": e.get("expiryDate"),
                "Donor": e.get("donor"),
                "VolunteerName": e.get("volunteerName"),
                "Notes": e.get("notes"),
                "CreatedAt": e.get("createdAt", "")[:19] if e.get("createdAt") else "",
            })
        df = pd.DataFrame(rows, columns=cols)
        df.to_excel(EXCEL_FILE, sheet_name="Entries", index=False, engine="openpyxl")
    except Exception:
        pass


def read_entries():
    _ensure_data_dir()
    entries = _excel_to_entries()
    if entries is not None:
        return entries
    if not os.path.exists(ENTRIES_FILE):
        return []
    try:
        with open(ENTRIES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def write_entries(entries):
    _ensure_data_dir()
    if os.path.exists(EXCEL_FILE):
        _entries_to_excel(entries)
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


def add_entries_batch(items, volunteer_name="", default_donor=""):
    """Add multiple entries at once. items = list of dicts with foodType, itemName, quantity, unit, expiryDate, donor (optional), notes (optional)."""
    import time
    import random
    import string
    entries = read_entries()
    created = []
    for item in items:
        eid = f"entry-{int(time.time() * 1000)}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=7))}"
        donor = item.get("donor") if item.get("donor") not in (None, "") else default_donor
        entry = {
            "id": eid,
            "foodType": item.get("foodType") or "Other",
            "itemName": item.get("itemName") or "",
            "quantity": float(item.get("quantity")) if item.get("quantity") is not None else 0,
            "unit": item.get("unit") or "lbs",
            "expiryDate": item.get("expiryDate") or None,
            "donor": donor or "",
            "volunteerName": volunteer_name or "",
            "notes": item.get("notes") or "",
            "createdAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        }
        entries.append(entry)
        created.append(entry)
    if created:
        write_entries(entries)
    return created


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
