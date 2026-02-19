(function () {
  'use strict';

  const sample = {
    foodRescuedLbsPerDay: 1247,
    spoilagePercent: 2.4,
    avgPickupToStorageMinutes: 38,
    coldTurnaroundMinutes: 52,
    volunteerUtilizationPercent: 73,
    volunteerScheduled: 24,
    volunteerActive: 18,
    rescuedSeries: [980, 1100, 1050, 1180, 1220, 1190, 1247],
  };

  const POLL_MS = 30 * 1000; // 30 seconds

  function formatNumber(n) {
    return typeof n === 'number' && !isNaN(n) ? n.toLocaleString() : '--';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setLastUpdated() {
    const now = new Date();
    setText('lastUpdated', now.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    }));
  }

  function renderSparkline(containerId, values) {
    const el = document.getElementById(containerId);
    if (!el || !values || !values.length) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = el.offsetWidth || 200;
    const height = 32;
    const padding = 2;
    const points = values.map((v, i) => {
      const x = padding + (i / (values.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((v - min) / range) * (height - 2 * padding);
      return x + ',' + y;
    });
    const path = 'M ' + points.join(' L ');
    el.innerHTML = '<svg width="100%" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none">' +
      '<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  function updateDashboard(data) {
    const d = data || sample;

    setText('foodRescued', formatNumber(d.foodRescuedLbsPerDay));
    setText('spoilage', typeof d.spoilagePercent === 'number' ? d.spoilagePercent.toFixed(1) : '--');
    setText('pickupStorage', String(d.avgPickupToStorageMinutes != null ? d.avgPickupToStorageMinutes : '--'));
    setText('coldTurnaround', String(d.coldTurnaroundMinutes != null ? d.coldTurnaroundMinutes : '--'));
    setText('volunteerUtil', typeof d.volunteerUtilizationPercent === 'number' ? d.volunteerUtilizationPercent.toFixed(0) : '--');

    const bar = document.getElementById('volunteerBar');
    if (bar) bar.style.width = Math.min(100, Math.max(0, d.volunteerUtilizationPercent || 0)) + '%';

    const hint = document.getElementById('volunteerHint');
    if (hint && d.volunteerScheduled != null && d.volunteerActive != null) {
      hint.textContent = d.volunteerActive + ' of ' + d.volunteerScheduled + ' scheduled volunteers active';
    } else if (hint) {
      hint.textContent = 'Target: 70–85% utilization';
    }

    const trendSpoilage = document.getElementById('trendSpoilage');
    if (trendSpoilage) trendSpoilage.textContent = '↓ 0.3% vs last week';

    const trendPickup = document.getElementById('trendPickup');
    if (trendPickup) trendPickup.textContent = '↓ 5 min vs last week';

    const trendCold = document.getElementById('trendCold');
    if (trendCold) trendCold.textContent = '↓ 8 min vs last week';

    renderSparkline('sparkRescued', d.rescuedSeries || sample.rescuedSeries);
    setLastUpdated();
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' });
    } catch {
      return iso;
    }
  }

  function formatTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  function renderRecentAlerts(alerts) {
    const el = document.getElementById('recentAlerts');
    if (!el) return;
    if (!alerts || alerts.length === 0) {
      el.innerHTML = '<p class="alerts-none">No alerts sent yet. Alerts run every 2 hours for frozen & produce near expiry.</p>';
      return;
    }
    el.innerHTML = '<ul class="alerts-list">' + alerts.slice(0, 10).map(function (a) {
      return '<li><strong>' + formatTime(a.createdAt) + '</strong> ' + (a.message || a.itemName || '') + '</li>';
    }).join('') + '</ul>';
  }

  function renderNearExpiry(rows) {
    const tbody = document.getElementById('nearExpiryBody');
    if (!tbody) return;
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">No frozen or produce items near expiry (within 48 hours).</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      return '<tr><td>' + (r.foodType || '—') + '</td><td>' + (r.itemName || '—') + '</td><td>' +
        (r.quantity != null ? r.quantity : '—') + ' ' + (r.unit || '') + '</td><td>' + formatDate(r.expiryDate) + '</td><td>' + (r.donor || '—') + '</td></tr>';
    }).join('');
  }

  function renderRecentEntries(rows) {
    const tbody = document.getElementById('recentEntriesBody');
    if (!tbody) return;
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No entries yet. Use the Volunteer entry form to add rescues.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(function (r) {
      return '<tr><td>' + (r.foodType || '—') + '</td><td>' + (r.itemName || '—') + '</td><td>' +
        (r.quantity != null ? r.quantity : '—') + ' ' + (r.unit || '') + '</td><td>' + formatDate(r.expiryDate) + '</td><td>' + (r.donor || '—') + '</td><td>' + formatTime(r.createdAt) + '</td></tr>';
    }).join('');
  }

  function fetchAll() {
    // Dashboard metrics
    fetch('/api/dashboard')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { updateDashboard(data); })
      .catch(function () { updateDashboard(sample); });

    // Recent alerts sent to supervisor
    fetch('/api/alerts?limit=10')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(renderRecentAlerts)
      .catch(function () { renderRecentAlerts([]); });

    // Near-expiry items (frozen, produce)
    fetch('/api/near-expiry')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(renderNearExpiry)
      .catch(function () { renderNearExpiry([]); });

    // Recent entries
    fetch('/api/entries?limit=50')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(renderRecentEntries)
      .catch(function () { renderRecentEntries([]); });
  }

  // Initial load
  updateDashboard(sample);
  fetchAll();

  // Refresh every 30 seconds so form submissions appear on the live dashboard
  setInterval(fetchAll, POLL_MS);
})();
