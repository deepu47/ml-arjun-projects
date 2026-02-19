(function () {
  'use strict';

  const POLL_MS = 30 * 1000;
  const CATEGORIES = ['Frozen', 'Produce', 'Dairy', 'Bakery', 'Canned', 'Other'];

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setLastUpdated() {
    var now = new Date();
    setText('lastUpdated', now.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }));
  }

  function formatNumber(n) {
    return typeof n === 'number' && !isNaN(n) ? n.toLocaleString() : '0';
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

  function getExpiryRowClass(expiryDate) {
    if (!expiryDate) return '';
    var exp = new Date(expiryDate);
    var now = new Date();
    if (isNaN(exp.getTime())) return '';
    if (exp < now) return 'expired';
    var twoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    if (exp <= twoDays) return 'expiring-soon';
    return '';
  }

  function buildByCategory(entries) {
    var byCat = {};
    CATEGORIES.forEach(function (c) { byCat[c] = { count: 0, quantity: 0 }; });
    entries.forEach(function (e) {
      var type = e.foodType || 'Other';
      if (!byCat[type]) byCat[type] = { count: 0, quantity: 0 };
      byCat[type].count += 1;
      byCat[type].quantity += Number(e.quantity) || 0;
    });
    return byCat;
  }

  function renderCategoryBlocks(entries) {
    var container = document.getElementById('categoryBlocks');
    if (!container) return;

    var byCat = buildByCategory(entries || []);
    var order = CATEGORIES.filter(function (c) { return (byCat[c] && byCat[c].count > 0) || c === 'Frozen' || c === 'Produce'; });

    if (order.length === 0 && entries && entries.length > 0) {
      Object.keys(byCat).forEach(function (k) {
        if (!CATEGORIES.includes(k)) order.push(k);
      });
    }
    if (order.length === 0) order = CATEGORIES;

    container.innerHTML = order.map(function (cat) {
      var data = byCat[cat] || { count: 0, quantity: 0 };
      return (
        '<div class="category-block">' +
          '<p class="category-block__name">' + cat + '</p>' +
          '<p class="category-block__qty">' + formatNumber(Math.round(data.quantity)) + '</p>' +
          '<p class="category-block__count">' + data.count + ' items</p>' +
        '</div>'
      );
    }).join('');
  }

  function renderTable(tbodyId, rows, showReceivedTime) {
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">No inventory yet. Entries appear when volunteers submit rescues.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (r) {
      var rowClass = getExpiryRowClass(r.expiryDate);
      var received = showReceivedTime ? formatTime(r.createdAt) : formatDate(r.createdAt);
      return (
        '<tr class="' + rowClass + '">' +
          '<td>' + (r.foodType || '—') + '</td>' +
          '<td>' + (r.itemName || '—') + '</td>' +
          '<td>' + (r.quantity != null ? r.quantity : '—') + ' ' + (r.unit || '') + '</td>' +
          '<td>' + formatDate(r.expiryDate) + '</td>' +
          '<td>' + (r.donor || '—') + '</td>' +
          '<td>' + received + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function fetchData() {
    Promise.all([
      fetch('/api/entries?limit=500').then(function (r) { return r.ok ? r.json() : []; }),
      fetch('/api/dashboard').then(function (r) { return r.ok ? r.json() : {}; })
    ]).then(function (results) {
      var entries = results[0];
      var dashboard = results[1];

      var totalQty = entries.reduce(function (s, e) { return s + (Number(e.quantity) || 0); }, 0);
      setText('totalItems', entries.length);
      setText('totalQuantity', formatNumber(Math.round(totalQty)));
      setText('recentIntake', dashboard.recentCount != null ? dashboard.recentCount : entries.length);

      renderCategoryBlocks(entries);

      var sorted = entries.slice().sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      renderTable('recentIntakeBody', sorted.slice(0, 30), true);

      var byExpiry = entries.slice().sort(function (a, b) {
        var da = a.expiryDate ? new Date(a.expiryDate) : new Date(0);
        var db = b.expiryDate ? new Date(b.expiryDate) : new Date(0);
        return da - db;
      });
      renderTable('inventoryBody', byExpiry, false);
    }).catch(function () {
      setText('totalItems', '0');
      setText('totalQuantity', '0');
      setText('recentIntake', '0');
      renderCategoryBlocks([]);
      renderTable('recentIntakeBody', []);
      renderTable('inventoryBody', []);
    });

    setLastUpdated();
  }

  fetchData();
  setInterval(fetchData, POLL_MS);
})();
