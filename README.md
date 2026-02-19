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

Data is stored in the `data/` folder (`entries.json`, `alerts.json`). No database required.

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
- `POST /api/entries` – Submit a new rescue (JSON body)
- `GET /api/dashboard` – Aggregated metrics for the dashboard
- `GET /api/near-expiry` – Frozen & produce items expiring within 48 hours
- `GET /api/alerts` – Alerts sent to supervisor (optional `?limit=10`)

## Optional: email alerts to supervisor

To send email alerts instead of (or in addition to) console logs, add [nodemailer](https://www.npmjs.com/package/nodemailer) and in `server.js` inside the expiry check loop (where it logs to console), call your own `sendSupervisorAlert(newAlerts)` that uses your SMTP settings (e.g. from environment variables).
