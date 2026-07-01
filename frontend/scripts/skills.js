(function () {
  'use strict';

  var API_BASE = window.location.origin;

  var grid = document.getElementById('skills-matrix-grid');
  var filterInput = document.getElementById('skills-filter-input');
  var countEl = document.getElementById('skills-count');
  var allRules = [];

  function loadMatrix() {
    fetch(API_BASE + '/compliance/matrix')
      .then(function (r) { return r.json(); })
      .then(function (rules) {
        allRules = rules;
        renderRules(rules);
        initFilter();
      })
      .catch(function () {
        if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color: var(--color-text-muted);">Failed to load rules</div>';
      });
  }

  function renderRules(rules) {
    if (!grid) return;
    grid.innerHTML = rules.map(function (r) {
      var sevClass = r.severity ? r.severity.toLowerCase() : 'low';
      return '<div class="matrix-card" data-rule-id="' + r.rule_id + '" data-domain="' + (r.domain || '') + '" data-severity="' + (r.severity || '') + '">' +
        '<div class="matrix-rule-id"><span class="severity-badge ' + sevClass + '">' + (r.severity || '') + '</span> ' + r.rule_id + '</div>' +
        '<div class="matrix-name">' + (r.name || '') + '</div>' +
        '<div class="matrix-domain">' + (r.domain || '') + '</div>' +
        '</div>';
    }).join('');
    if (countEl) countEl.textContent = rules.length + ' rules';
  }

  function initFilter() {
    if (!filterInput) return;
    filterInput.addEventListener('input', function () {
      var q = filterInput.value.toLowerCase().trim();
      var filtered = allRules.filter(function (r) {
        var text = (r.rule_id + ' ' + (r.domain || '') + ' ' + (r.severity || '') + ' ' + (r.name || '')).toLowerCase();
        return text.includes(q);
      });
      renderRules(filtered);
    });
  }

  loadMatrix();

})();
