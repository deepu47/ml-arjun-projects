# Food Rescue Dashboard & Alerts

Dashboard and alert system for a food rescue organisation: volunteers submit rescues via a form, data appears on a live dashboard, and supervisors get alerts every 2 hours for **frozen** and **produce** items near expiry.

## Features

- **Volunteer entry form** – Volunteers enter food type (Frozen, Produce, Dairy, Bakery, Canned, Other), item name, quantity, expiry date, donor, and optional notes. Submissions are stored and shown on the dashboard.
- **Live dashboard** – Refreshes every **30 seconds** so new form entries appear automatically. Shows:
  - Food rescued (lbs/day), spoilage %, pickup/storage times, volunteer utilization
  - **Near expiry** table – Frozen & produce items expiring within **48 hours**
  - **Recent rescue entries** – Latest volunteer submissions
  - **Recent alerts** – Alerts that have been sent to the supervisor
- **Alerts every 2 hours** – A cron job runs every 2 hours, finds frozen and produce items with expiry within 48 hours, and:
  - Logs them to the **server console** (supervisor can monitor the terminal)
  - Stores them in `data/alerts.json` so they appear in the “Recent alerts” section on the dashboard

## Run locally

From the project folder `C:\Users\udred\food-rescue-dashboard` (or `cd C:\Users\udred\food-rescue-dashboard` if you're elsewhere):

```bash
cd C:\Users\udred\food-rescue-dashboard
npm install
npm start
```

Then open:

- **Operations dashboard:** http://localhost:3000/
- **Supervisor alert board:** http://localhost:3000/supervisor.html
- **Warehouse dashboard:** http://localhost:3000/warehouse.html
- **Volunteer form:** http://localhost:3000/form.html  
- **Import Excel (Microsoft Forms):** http://localhost:3000/import.html

**Data is stored in Excel** at `data/food_rescue_entries.xlsx` so you can open it in Microsoft Excel to review and edit. Alerts stay in `data/alerts.json`.

---

## Microsoft Forms + Excel

You can use **Microsoft Forms** for volunteer food entry and have the dashboard use that data.

### Option 1: Export from Forms, then import

1. Create a Microsoft Form with questions such as: **Food type**, **Item name**, **Quantity**, **Unit**, **Expiry date**, **Donor**, **Volunteer name**, **Notes** (use similar wording so the importer can match columns).
2. In Forms, go to **Responses** → **Open in Excel** to get an Excel file of responses.
3. In the dashboard, open **Import Excel** (nav link), upload that Excel file. Rows are merged into the dashboard. Check **Replace all existing data** only if you want the file to become the full dataset.
4. Data is saved to `data/food_rescue_entries.xlsx`. Open that file in Excel anytime to review or edit; the dashboard reads from it.

### Option 2: Download data as Excel

- On **Import Excel**, click **Download food_rescue_entries.xlsx** to get the current data. Edit in Excel and re-upload with **Replace all existing data** checked to apply your changes.

### Option 3: Power Automate (automatic per response)

- Use Power Automate: trigger **When a new response is submitted** (Microsoft Forms), then send an **HTTP** request **POST** to `https://your-server/api/entries` with a JSON body mapping form fields to `foodType`, `itemName`, `quantity`, `unit`, `expiryDate`, `donor`, `volunteerName`, `notes`. Each new response is appended to the Excel-backed data.

---

## Deploy on Streamlit

A Python/Streamlit version of the dashboard is included so you can run or deploy it on [Streamlit Community Cloud](https://share.streamlit.io/) (or any host that runs Streamlit).

### Run Streamlit locally

From the project folder `C:\Users\udred\food-rescue-dashboard`:

```bash
cd C:\Users\udred\food-rescue-dashboard
pip install -r requirements-streamlit.txt
streamlit run app.py
```

Then open the URL shown (e.g. http://localhost:8501). You get:

- **Operations** (home) – metrics, near-expiry table, recent entries, alert history
- **Supervisor Alerts** – alert board with filter (All / Frozen / Produce), alert history
- **Warehouse** – inventory by category, recent intake, full inventory sorted by expiry
- **Volunteer Entry** – form to submit new rescues

The Streamlit app uses the **same** `data/entries.json` and `data/alerts.json` as the Node app (if you have existing data, it will show up).

### Deploy to Streamlit Community Cloud

1. Push this repo to GitHub (ensure `app.py`, `pages/`, `data_utils.py`, and `requirements-streamlit.txt` are in the repo).
2. Go to [share.streamlit.io](https://share.streamlit.io), sign in, and click **New app**.
3. Select your repo, branch, and set **Main file path** to `app.py` (or the path to `app.py` inside the repo, e.g. `food-rescue-dashboard/app.py` if the app lives in a subfolder).
4. In **Advanced settings**, set **Requirements file** to `requirements-streamlit.txt` (or `food-rescue-dashboard/requirements-streamlit.txt` if in a subfolder).
5. Deploy. The app will run at a public URL.

Note: On Streamlit Cloud, the `data/` folder is ephemeral unless you use external storage (e.g. a database or cloud storage). For persistent data, replace the file-based logic in `data_utils.py` with your storage backend.

---

## API (Node server)

- `GET /api/entries` – List rescue entries (optional `?limit=50`)
- `POST /api/entries` – Submit a new rescue (JSON body; use from Power Automate)
- `POST /api/entries/batch` – Submit multiple entries (JSON body)
- `POST /api/import/excel` – Upload Excel file (form field `file`); optional `?replace=1` to replace all data
- `GET /api/export/excel` – Download current data as Excel
- `GET /api/dashboard` – Aggregated metrics for the dashboard
- `GET /api/near-expiry` – Frozen & produce items expiring within 48 hours
- `GET /api/alerts` – Alerts sent to supervisor (optional `?limit=10`)

## Optional: email alerts to supervisor

To send email alerts instead of (or in addition to) console logs, add [nodemailer](https://www.npmjs.com/package/nodemailer) and in `server.js` inside the expiry check loop (where it logs to console), call your own `sendSupervisorAlert(newAlerts)` that uses your SMTP settings (e.g. from environment variables).
