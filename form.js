(function () {
  'use strict';

  const form = document.getElementById('rescueForm');
  const messageEl = document.getElementById('formMessage');
  const itemsContainer = document.getElementById('itemsContainer');
  const addItemBtn = document.getElementById('addItemBtn');

  const itemRowTemplate = function (index) {
    const num = index + 1;
    return (
      '<div class="item-row" data-index="' + index + '">' +
        '<div class="item-row__header">' +
          '<span class="item-row__num">Item ' + num + '</span>' +
          '<button type="button" class="item-row__remove" aria-label="Remove item" title="Remove this item">Remove</button>' +
        '</div>' +
        '<div class="form-grid form-grid--item">' +
          '<div class="field">' +
            '<label>Food type <span class="required">*</span></label>' +
            '<select class="item-foodType" required>' +
              '<option value="">Select type</option>' +
              '<option value="Frozen">Frozen</option>' +
              '<option value="Produce">Produce</option>' +
              '<option value="Dairy">Dairy</option>' +
              '<option value="Bakery">Bakery</option>' +
              '<option value="Canned">Canned</option>' +
              '<option value="Other">Other</option>' +
            '</select>' +
          '</div>' +
          '<div class="field field--wide">' +
            '<label>Item name / description <span class="required">*</span></label>' +
            '<input type="text" class="item-itemName" placeholder="e.g. Mixed vegetables, Bread rolls" required>' +
          '</div>' +
          '<div class="field">' +
            '<label>Quantity <span class="required">*</span></label>' +
            '<input type="number" class="item-quantity" min="0" step="0.1" placeholder="0" required>' +
          '</div>' +
          '<div class="field">' +
            '<label>Unit</label>' +
            '<select class="item-unit">' +
              '<option value="lbs">lbs</option>' +
              '<option value="kg">kg</option>' +
              '<option value="units">units</option>' +
              '<option value="bags">bags</option>' +
              '<option value="boxes">boxes</option>' +
            '</select>' +
          '</div>' +
          '<div class="field field--wide">' +
            '<label>Expiry / use-by date <span class="required">*</span></label>' +
            '<input type="date" class="item-expiryDate" required>' +
          '</div>' +
          '<div class="field field--wide">' +
            '<label>Notes (optional)</label>' +
            '<input type="text" class="item-notes" placeholder="Storage, handling">' +
          '</div>' +
          '<div class="field field--wide item-donor-override">' +
            '<label>Donor for this item (leave blank to use shared)</label>' +
            '<input type="text" class="item-donor" placeholder="Override donor">' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  };

  function updateItemNumbers() {
    const rows = itemsContainer.querySelectorAll('.item-row');
    rows.forEach(function (row, i) {
      row.setAttribute('data-index', i);
      const numEl = row.querySelector('.item-row__num');
      if (numEl) numEl.textContent = 'Item ' + (i + 1);
    });
  }

  function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = 'form-message visible ' + (type || '');
  }

  function hideMessage() {
    if (messageEl) {
      messageEl.className = 'form-message';
      messageEl.textContent = '';
    }
  }

  function collectItems() {
    const rows = itemsContainer.querySelectorAll('.item-row');
    const items = [];
    rows.forEach(function (row) {
      const foodType = (row.querySelector('.item-foodType') || {}).value;
      const itemName = (row.querySelector('.item-itemName') || {}).value;
      const quantity = (row.querySelector('.item-quantity') || {}).value;
      const unit = (row.querySelector('.item-unit') || {}).value || 'lbs';
      const expiryDate = (row.querySelector('.item-expiryDate') || {}).value || null;
      const notes = (row.querySelector('.item-notes') || {}).value || '';
      const donor = (row.querySelector('.item-donor') || {}).value || '';
      items.push({
        foodType: foodType || 'Other',
        itemName: itemName || '',
        quantity: parseFloat(quantity) || 0,
        unit: unit,
        expiryDate: expiryDate,
        notes: notes,
        donor: donor || undefined,
      });
    });
    return items;
  }

  if (addItemBtn) {
    addItemBtn.addEventListener('click', function () {
      const count = itemsContainer.querySelectorAll('.item-row').length;
      const div = document.createElement('div');
      div.innerHTML = itemRowTemplate(count);
      itemsContainer.appendChild(div.firstElementChild);
      updateItemNumbers();
      attachRemoveHandlers();
    });
  }

  function attachRemoveHandlers() {
    itemsContainer.querySelectorAll('.item-row__remove').forEach(function (btn) {
      btn.onclick = function () {
        const row = btn.closest('.item-row');
        const rows = itemsContainer.querySelectorAll('.item-row');
        if (rows.length <= 1) return;
        row.remove();
        updateItemNumbers();
      };
    });
  }
  attachRemoveHandlers();

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideMessage();

      const items = collectItems();
      const volunteerName = (document.getElementById('volunteerName') || {}).value || '';
      const donor = (document.getElementById('donor') || {}).value || '';

      if (items.length === 0) {
        showMessage('Add at least one item.', 'error');
        return;
      }

      const hasRequired = items.every(function (it) {
        return (it.foodType && it.foodType !== '') && (it.itemName && it.itemName.trim() !== '') && it.expiryDate;
      });
      if (!hasRequired) {
        showMessage('Each item needs Food type, Item name, Quantity, and Expiry date.', 'error');
        return;
      }

      fetch('/api/entries/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: items,
          volunteerName: volunteerName,
          donor: donor,
        }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Save failed');
          return res.json();
        })
        .then(function (data) {
          const count = (data && data.count) || items.length;
          showMessage(count + ' item(s) saved. They will appear on the live dashboard shortly.', 'success');
          form.reset();
          while (itemsContainer.querySelectorAll('.item-row').length > 1) {
            itemsContainer.lastElementChild.remove();
          }
          updateItemNumbers();
        })
        .catch(function () {
          showMessage('Could not save. Is the server running? Try again.', 'error');
        });
    });
  }
})();
