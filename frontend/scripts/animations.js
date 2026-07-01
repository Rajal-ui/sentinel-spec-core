/**
 * animations.js
 * Sentinel Spec — IntersectionObserver reveals + stat counters + pipeline
 */

(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Scroll Reveal ───────────────────────────────────────── */
  function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal, .reveal-stagger');

    if (prefersReduced) {
      reveals.forEach(el => {
        el.classList.add('visible');
        // For stagger children
        el.querySelectorAll(':scope > *').forEach(child => {
          child.style.opacity = '1';
          child.style.transform = 'none';
        });
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
  }

  /* ── Stat Counters ───────────────────────────────────────── */
  function animateCounter(el, target, duration, suffix) {
    if (prefersReduced) {
      el.textContent = target + suffix;
      return;
    }

    const start = performance.now();
    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(eased * target);
      el.textContent = value + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  function initStatCounters() {
    const stats = document.querySelectorAll('[data-count]');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el     = entry.target;
          const target = parseFloat(el.dataset.count);
          const suffix = el.dataset.suffix || '';
          const dur    = parseInt(el.dataset.duration || '1800', 10);
          animateCounter(el, target, dur, suffix);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    stats.forEach(el => observer.observe(el));
  }

  /* ── Pipeline Dash Animation ─────────────────────────────── */
  function initPipelineLines() {
    const lines = document.querySelectorAll('.pipe-line');
    lines.forEach(line => {
      line.classList.add('animated');
    });
  }

  /* ── Scan-line reveal ─────────────────────────────────────── */
  function initScanReveal() {
    const scans = document.querySelectorAll('.scan-reveal');

    if (prefersReduced) {
      scans.forEach(el => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    scans.forEach(el => observer.observe(el));
  }

  /* ── Init all ─────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initStatCounters();
    initPipelineLines();
    initScanReveal();
  });

})();
