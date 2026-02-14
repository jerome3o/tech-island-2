/**
 * Shared Feature Request / Bug Report FAB (Floating Action Button)
 * Include this script on any page to add a feedback bubble.
 * Skips rendering on the feature-requests page itself (it has its own UI).
 */
(function () {
  // Don't render on the feature-requests page — it has its own FAB
  if (window.location.pathname.startsWith('/feature-requests')) return;

  // --- Styles ---
  const style = document.createElement('style');
  style.textContent = `
    .fr-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-size: 1.6em;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      z-index: 9000;
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      touch-action: none;
    }
    .fr-fab:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
    .fr-fab .fr-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ff4444;
      color: white;
      border-radius: 10px;
      min-width: 20px;
      height: 20px;
      font-size: 0.45em;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
    }

    .fr-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 9100;
      align-items: flex-end;
      justify-content: center;
      padding: 0;
    }
    .fr-overlay.active { display: flex; }

    .fr-sheet {
      background: white;
      width: 100%;
      max-width: 500px;
      max-height: 85vh;
      border-radius: 16px 16px 0 0;
      padding: 20px;
      overflow-y: auto;
      position: relative;
      animation: fr-slide-up 0.25s ease-out;
    }
    @keyframes fr-slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .fr-sheet h2 {
      margin: 0 0 16px;
      font-size: 1.2em;
      color: #333;
    }
    .fr-sheet .fr-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 1.4em;
      cursor: pointer;
      color: #888;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    .fr-sheet .fr-close:hover { background: #f0f0f0; }

    .fr-type-toggle {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .fr-type-btn {
      flex: 1;
      padding: 10px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      font-size: 0.95em;
      text-align: center;
      transition: all 0.2s;
    }
    .fr-type-btn.active {
      border-color: #667eea;
      background: #f0f4ff;
      font-weight: 600;
    }

    .fr-field { margin-bottom: 14px; }
    .fr-field label {
      display: block;
      margin-bottom: 4px;
      color: #555;
      font-weight: 500;
      font-size: 0.9em;
    }
    .fr-field input,
    .fr-field textarea {
      width: 100%;
      padding: 10px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 1em;
      font-family: inherit;
    }
    .fr-field textarea { resize: vertical; min-height: 80px; }
    .fr-field input:focus,
    .fr-field textarea:focus { outline: none; border-color: #667eea; }

    .fr-icons {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 6px;
      margin-top: 6px;
    }
    .fr-icon-opt {
      font-size: 1.5em;
      padding: 6px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      cursor: pointer;
      text-align: center;
      background: white;
      transition: all 0.15s;
    }
    .fr-icon-opt:hover { border-color: #667eea; transform: scale(1.05); }
    .fr-icon-opt.selected { border-color: #667eea; background: #f0f4ff; }

    .fr-submit {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1em;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .fr-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    .fr-success {
      text-align: center;
      padding: 30px 20px;
    }
    .fr-success .fr-check { font-size: 3em; margin-bottom: 12px; }
    .fr-success p { color: #555; font-size: 1em; margin: 0; }

    @media (min-width: 501px) {
      .fr-overlay { align-items: center; padding: 20px; }
      .fr-sheet { border-radius: 16px; }
    }
  `;
  document.head.appendChild(style);

  // --- FAB Button ---
  const fab = document.createElement('button');
  fab.className = 'fr-fab';
  fab.innerHTML = '💡';
  fab.title = 'Submit feedback';
  document.body.appendChild(fab);

  // Badge for pending count (admin only)
  const badge = document.createElement('span');
  badge.className = 'fr-badge';
  badge.style.display = 'none';
  fab.appendChild(badge);

  // --- Modal ---
  const overlay = document.createElement('div');
  overlay.className = 'fr-overlay';

  const FEATURE_ICONS = ['🚀', '💡', '🎨', '🎮', '📱', '🌟', '🔥', '⚡', '🎯', '🏆', '🎪', '🎭'];
  const BUG_ICONS = ['🐛', '🐞', '💥', '🔧', '⚠️', '🚨', '🔴', '❌', '🩹', '🧯', '🕳️', '💔'];

  let selectedType = 'feature';
  let selectedIcon = '💡';

  function buildIconGrid(icons) {
    return icons.map(ic =>
      `<button type="button" class="fr-icon-opt${ic === selectedIcon ? ' selected' : ''}" data-icon="${ic}">${ic}</button>`
    ).join('');
  }

  function renderForm() {
    const icons = selectedType === 'bug' ? BUG_ICONS : FEATURE_ICONS;
    if (selectedType === 'bug' && FEATURE_ICONS.includes(selectedIcon)) selectedIcon = '🐛';
    if (selectedType === 'feature' && BUG_ICONS.includes(selectedIcon)) selectedIcon = '💡';

    overlay.innerHTML = `
      <div class="fr-sheet">
        <button class="fr-close" id="frClose">&times;</button>
        <h2>${selectedType === 'bug' ? '🐛 Report a Bug' : '💡 Request a Feature'}</h2>
        <div class="fr-type-toggle">
          <button class="fr-type-btn ${selectedType === 'feature' ? 'active' : ''}" data-type="feature">💡 Feature</button>
          <button class="fr-type-btn ${selectedType === 'bug' ? 'active' : ''}" data-type="bug">🐛 Bug</button>
        </div>
        <form id="frForm">
          <div class="fr-field">
            <label>Title</label>
            <input type="text" id="frTitle" placeholder="${selectedType === 'bug' ? 'Brief description of the bug' : 'Give your idea a name'}" required>
          </div>
          <div class="fr-field">
            <label>Icon</label>
            <div class="fr-icons" id="frIcons">${buildIconGrid(icons)}</div>
          </div>
          <div class="fr-field">
            <label>Description</label>
            <textarea id="frDesc" placeholder="${selectedType === 'bug' ? 'What happened? What did you expect?' : 'Describe your idea in detail...'}" required></textarea>
          </div>
          <button type="submit" class="fr-submit" id="frSubmitBtn">Submit</button>
        </form>
      </div>
    `;

    // Bind events
    overlay.querySelector('#frClose').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelectorAll('.fr-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedType = btn.dataset.type;
        renderForm();
        overlay.classList.add('active');
      });
    });

    overlay.querySelector('#frIcons').addEventListener('click', (e) => {
      const opt = e.target.closest('.fr-icon-opt');
      if (!opt) return;
      overlay.querySelectorAll('.fr-icon-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedIcon = opt.dataset.icon;
    });

    overlay.querySelector('#frForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = overlay.querySelector('#frTitle').value.trim();
      const desc = overlay.querySelector('#frDesc').value.trim();
      if (!title || !desc) return;

      const btn = overlay.querySelector('#frSubmitBtn');
      btn.disabled = true;
      btn.textContent = 'Submitting...';

      try {
        const resp = await fetch('/feature-requests/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, icon: selectedIcon, description: desc, type: selectedType })
        });
        if (!resp.ok) throw new Error('Failed');

        // Show success
        overlay.querySelector('.fr-sheet').innerHTML = `
          <div class="fr-success">
            <div class="fr-check">✅</div>
            <h2>Thanks for your feedback!</h2>
            <p>Your ${selectedType === 'bug' ? 'bug report' : 'feature request'} has been submitted.</p>
          </div>
        `;
        setTimeout(close, 2000);
      } catch {
        btn.disabled = false;
        btn.textContent = 'Submit';
        alert('Failed to submit. Please try again.');
      }
    });
  }

  function open() {
    renderForm();
    overlay.classList.add('active');
  }

  function close() {
    overlay.classList.remove('active');
  }

  fab.addEventListener('click', open);
  document.body.appendChild(overlay);

  // --- Pending count badge (admin only) ---
  async function checkPendingCount() {
    try {
      const meResp = await fetch('/api/me');
      if (!meResp.ok) return;
      const me = await meResp.json();
      if (!me.is_admin) return;

      const countResp = await fetch('/feature-requests/api/requests/pending-count');
      if (!countResp.ok) return;
      const { count } = await countResp.json();
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    } catch { /* silently fail */ }
  }

  // Check on load (delayed to not block page)
  setTimeout(checkPendingCount, 1500);
})();
