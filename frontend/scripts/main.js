(function () {
  'use strict';

  function initNav() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;
    var onScroll = function () {
      nav.classList.toggle('nav-scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initHomePage() {
    if (!document.getElementById('cockpit-grade-ring')) return;

    var API_BASE = window.location.origin;

    fetch(API_BASE + '/analytics/summary')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var pct = Math.round(data.compliance_rate * 100);
        var gradeEl = document.getElementById('cockpit-grade-label');
        var ring = document.getElementById('cockpit-grade-ring');
        if (gradeEl) gradeEl.textContent = data.grade || 'N/A';
        if (ring) {
          var offset = 346 - (pct / 100) * 346;
          ring.style.strokeDashoffset = offset;
        }
        var setText = function (id, val) {
          var el = document.getElementById(id);
          if (el) el.textContent = val;
        };
        setText('cockpit-stat-evals', data.total_evaluations.toLocaleString());
        setText('cockpit-stat-rate', pct + '%');
        setText('cockpit-stat-critical', data.open_critical);
        setText('cockpit-stat-high', data.open_high);
        setText('ops-total-evals', data.total_evaluations.toLocaleString());
        setText('ops-compliant-pct', pct + '%');
        setText('ops-violations', data.violation_count.toLocaleString());
        if (data.agent_latency_ms && data.agent_latency_ms.total_avg) {
          setText('ops-agent-latency', data.agent_latency_ms.total_avg + 'ms');
        }
      })
      .catch(function () {});
  }

  initNav();
  initHomePage();

})();
