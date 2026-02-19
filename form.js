(function () {
  'use strict';

  const form = document.getElementById('rescueForm');
  const messageEl = document.getElementById('formMessage');

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

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      hideMessage();

      const formData = new FormData(form);
      const payload = {
        foodType: formData.get('foodType'),
        itemName: formData.get('itemName'),
        quantity: parseFloat(formData.get('quantity')) || 0,
        unit: formData.get('unit') || 'lbs',
        expiryDate: formData.get('expiryDate') || null,
        donor: formData.get('donor') || '',
        volunteerName: formData.get('volunteerName') || '',
        notes: formData.get('notes') || '',
      };

      fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Save failed');
          return res.json();
        })
        .then(function () {
          showMessage('Entry saved. It will appear on the live dashboard shortly.', 'success');
          form.reset();
        })
        .catch(function () {
          showMessage('Could not save. Is the server running? Try again.', 'error');
        });
    });
  }
})();
