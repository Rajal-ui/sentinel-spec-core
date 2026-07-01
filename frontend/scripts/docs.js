(function () {
  'use strict';

  function initCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var snippet = btn.closest('.code-snippet');
        var pre = snippet ? snippet.querySelector('pre') : null;
        if (!pre) return;
        var text = pre.textContent.replace(/[\u00A0]/g, ' ').trim();

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { flashCopied(btn); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          flashCopied(btn);
        }
      });
    });
  }

  function flashCopied(btn) {
    var orig = btn.textContent;
    btn.textContent = 'Copied';
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 2000);
  }

  initCopyButtons();

})();
