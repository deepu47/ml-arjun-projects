(function () {
  'use strict';

  const POLL_MS = 30 * 1000;
  let currentFilter = 'all';
  let lastNearExpiry = [];

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setLastUpdated() {
    var now = new Date();
    setText('lastUpdated', now.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }));
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'short' });
    } catch (e) {
      return iso;
    }
  }

  function formatTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' });
    } catch (e) {
      return iso;
    }
  }

  function filterItems(items) {
    if (currentFilter === 'all') return items;
    return items.filter(function (item) {
      return (item.foodType || '').toLowerCase() === currentFilter;
    });
  }

  function renderAlertCards(nearExpiry) {
    var container = document.getElementById('alertCards');
    var emptyEl = document.getElementById('alertCardsEmpty');
    if (!container) return;

    var filtered = filterItems(nearExpiry || []);

    if (filtered.length === 0) {
      if (emptyEl) {
        emptyEl.textContent = currentFilter === 'all'
          ? 'No items needing action. Frozen & produce expiring within 48 hours will appear here.'
          : 'No ' + currentFilter + ' items near expiry.';
        emptyEl.className = 'empty-state';
      }
      return;
    }

    if (emptyEl) emptyEl.remove();

    container.innerHTML = filtered.map(function (item) {
      var type = (item.foodType || '').toLowerCase();
      var typeClass = type === 'frozen' ? 'alert-card--frozen' : type === 'produce' ? 'alert-card--produce' : '';
      return (
        '<div class="alert-card ' + typeClass + '">' +
          '<div class="alert-card__type">' + (item.foodType || '') + '</div>' +
          '<h3 class="alert-card__name">' + (item.itemName || '—') + '</h3>' +
          '<p class="alert-card__meta">' + (item.quantity != null ? item.quantity : '—') + ' ' + (item.unit || '') + (item.donor ? ' · ' + item.donor : '') + '</p>' +
          '<p class="alert-card__expiry">Expires ' + formatDate(item.expiryDate) + '</p>' +
        '</div>'
      );
    }).join('');
  }

  function renderAlertHistory(alerts) {
    var tbody = document.getElementById('alertHistoryBody');
    if (!tbody) return;

    if (!alerts || alerts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No alerts sent yet. Alerts run every 2 hours.</td></tr>';
      return;
    }

    tbody.innerHTML = alerts.slice(0, 50).map(function (a) {
      return (
        '<tr><td>' + formatTime(a.createdAt) + '</td><td>' + (a.foodType || '—') + '</td><td>' + (a.itemName || '—') + '</td><td>' +
        (a.quantity != null ? a.quantity : '—') + ' ' + (a.unit || '') + '</td><td>' + formatDate(a.expiryDate) + '</td><td>' + (a.donor || '—') + '</td></tr>'
      );
    }).join('');
  }

  function updateSummary(nearExpiry) {
    var list = nearExpiry || [];
    setText('alertCount', list.length);
    setText('frozenCount', list.filter(function (e) { return (e.foodType || '').toLowerCase() === 'frozen'; }).length);
    setText('produceCount', list.filter(function (e) { return (e.foodType || '').toLowerCase() === 'produce'; }).length);
  }

  function fetchData() {
    fetch('/api/near-expiry')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (near) {
        lastNearExpiry = near || [];
        updateSummary(lastNearExpiry);
        renderAlertCards(lastNearExpiry);
      })
      .catch(function () {
        updateSummary([]);
        renderAlertCards([]);
      });

    fetch('/api/alerts?limit=50')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(renderAlertHistory)
      .catch(function () { renderAlertHistory([]); });

    setLastUpdated();
  }

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('filter-btn--active'); });
      btn.classList.add('filter-btn--active');
      currentFilter = btn.getAttribute('data-filter') || 'all';
      renderAlertCards(lastNearExpiry);
    });
  });

  fetchData();
  setInterval(fetchData, POLL_MS);
})();
