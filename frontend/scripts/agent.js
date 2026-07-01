(function () {
  'use strict';

  var API_BASE = window.location.origin;
  var abortController = null;

  var chatMessages = document.getElementById('chat-messages');
  var codeInput = document.getElementById('chat-code-input');
  var runBtn = document.getElementById('agent-run-btn');
  var clearBtn = document.getElementById('agent-clear-btn');
  var thinkingBody = document.getElementById('thinking-log-body');
  var thinkingCount = document.getElementById('thinking-log-count');
  var statusDot = document.getElementById('agent-dot-main');
  var statusText = document.getElementById('agent-status-text-main');
  var inspectorFindingsList = document.getElementById('inspector-findings-list');
  var inspectorFilePath = document.getElementById('inspector-file-path');
  var inspectorFindingsCount = document.getElementById('inspector-findings-count');
  var inspectorFile = document.getElementById('inspector-file');
  var inspectorEmpty = document.querySelector('.inspector-empty');

  var thinkingLogToggle = document.getElementById('thinking-log-toggle');
  var thinkingLog = document.getElementById('thinking-log');

  if (thinkingLogToggle) {
    thinkingLogToggle.addEventListener('click', function () {
      thinkingLog.classList.toggle('collapsed');
    });
  }

  function setStatus(state, text) {
    if (statusDot) {
      statusDot.className = 'agent-status-dot';
      if (state) statusDot.classList.add(state);
    }
    if (statusText) statusText.textContent = text || 'Idle';
  }

  function addChatMessage(type, label, bodyHTML) {
    var div = document.createElement('div');
    div.className = 'chat-message ' + type;
    var labelEl = document.createElement('div');
    labelEl.className = 'chat-message-label';
    labelEl.textContent = label;
    var bodyEl = document.createElement('div');
    bodyEl.className = 'chat-message-body';
    bodyEl.innerHTML = bodyHTML;
    div.appendChild(labelEl);
    div.appendChild(bodyEl);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addFindingToInspector(finding) {
    var sevClass = finding.severity ? finding.severity.toLowerCase() : 'low';
    inspectorFindingsList.innerHTML += '<div class="inspector-finding ' + sevClass + '">' +
      '<span class="severity-badge ' + sevClass + '">' + finding.severity + '</span> ' +
      '<span class="font-mono">' + finding.rule_id + '</span>' +
      '<span style="margin-left: auto; font-size: 10px; color: var(--color-text-muted);">L:' + finding.line_number + '</span>' +
      '</div>';
  }

  function runScan() {
    var sourceCode = codeInput ? codeInput.value.trim() : '';
    if (!sourceCode) {
      addChatMessage('system', 'Sentinel Spec', '<span style="color: var(--color-danger);">Please enter source code to scan.</span>');
      return;
    }

    if (abortController) abortController.abort();

    chatMessages.innerHTML = '';
    thinkingBody.innerHTML = '';
    inspectorFindingsList.innerHTML = '';
    if (inspectorFile) inspectorFile.style.display = 'none';
    if (inspectorEmpty) inspectorEmpty.style.display = 'block';

    addChatMessage('user', 'Submitted Code', '<pre class="chat-code-pre"><code>' + escapeHtml(sourceCode) + '</code></pre>');

    setStatus('running', 'Scanning...');
    if (runBtn) runBtn.disabled = true;
    var eventCount = 0;

    var controller = new AbortController();
    abortController = controller;

    fetch(API_BASE + '/evaluate/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: sourceCode, file_path: 'sandbox', language: 'python' }),
      signal: controller.signal,
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function read() {
          reader.read().then(function (result) {
            if (result.done) {
              setStatus('done', 'Complete');
              if (runBtn) runBtn.disabled = false;
              return;
            }
            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split('\n');
            buffer = lines.pop();

            lines.forEach(function (line) {
              if (line.startsWith('data: ')) {
                try {
                  var data = JSON.parse(line.slice(6));
                  eventCount++;

                  var entry = document.createElement('div');
                  entry.className = 'agent-log-entry';
                  entry.innerHTML = '<span class="step-agent">[' + data.agent + ']</span> ' +
                    '<span class="step-phase">' + data.phase + '</span> ' +
                    '<span class="' + (data.phase === 'finding' ? 'step-finding' : data.phase === 'complete' ? 'step-success' : 'step-detail') + '">' + (data.detail || '') + '</span>';
                  thinkingBody.appendChild(entry);
                  thinkingBody.scrollTop = thinkingBody.scrollHeight;
                  if (thinkingCount) thinkingCount.textContent = eventCount + ' events';

                  if (data.phase === 'finding' && data.payload && data.payload.rule_id) {
                    addChatMessage('finding', data.agent, formatFinding(data.payload));
                    addFindingToInspector(data.payload);
                    if (inspectorEmpty) inspectorEmpty.style.display = 'none';
                    if (inspectorFile) inspectorFile.style.display = 'block';
                    if (inspectorFilePath) inspectorFilePath.textContent = data.payload.file || 'sandbox';
                  }

                  if (data.phase === 'complete' && data.payload && data.payload.summary) {
                    addChatMessage('system', 'Sentinel Spec', '<span style="color: var(--color-success);">✓ Scan complete.</span> ' + data.payload.summary);
                  }
                } catch (e) {}
              }
            });

            read();
          }).catch(function (err) {
            if (err.name === 'AbortError') return;
            handleError(err.message);
          });
        }

        read();
      })
      .catch(function (err) {
        if (err.name === 'AbortError') return;
        handleError(err.message);
      });

    function handleError(msg) {
      setStatus('error', 'Error');
      if (runBtn) runBtn.disabled = false;
      addChatMessage('system', 'Sentinel Spec', '<span style="color: var(--color-danger);">Error: ' + msg + '</span>');
      var entry = document.createElement('div');
      entry.className = 'agent-log-entry';
      entry.innerHTML = '<span class="step-finding">Error: ' + msg + '</span>';
      thinkingBody.appendChild(entry);
    }
  }

  function clearAll() {
    if (abortController) abortController.abort();
    chatMessages.innerHTML = '<div class="chat-message system"><div class="chat-message-label">Sentinel Spec</div><div class="chat-message-body">Press "Run Scan" to submit code for analysis.</div></div>';
    thinkingBody.innerHTML = '<div style="color: var(--color-text-muted); padding: var(--space-md);">Press "Run Scan" to begin...</div>';
    inspectorFindingsList.innerHTML = '';
    if (inspectorFile) inspectorFile.style.display = 'none';
    if (inspectorEmpty) inspectorEmpty.style.display = 'block';
    setStatus('', 'Idle');
    if (thinkingCount) thinkingCount.textContent = '0 events';
    if (runBtn) runBtn.disabled = false;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatFinding(f) {
    var sevClass = f.severity ? f.severity.toLowerCase() : 'low';
    return '<div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm);">' +
      '<span class="severity-badge ' + sevClass + '">' + (f.severity || 'INFO') + '</span>' +
      '<span class="font-mono" style="color: var(--color-primary); font-size: 12px;">' + (f.rule_id || '') + '</span>' +
      '<span style="font-size: 11px; color: var(--color-text-muted); margin-left: auto;">L:' + (f.line_number || '?') + '</span>' +
      '</div>' +
      '<p style="font-size: 13px; margin-bottom: var(--space-sm);">' + (f.description || '') + '</p>' +
      (f.suggested_fix ? '<div class="diff-block" style="margin-bottom: 0; font-size: 11px;"><span class="diff-ins">+ ' + escapeHtml(f.suggested_fix) + '</span></div>' : '');
  }

  if (runBtn) runBtn.addEventListener('click', runScan);
  if (clearBtn) clearBtn.addEventListener('click', clearAll);

})();
