(function() {
  // ===== ENCRYPTED CONFIG =====
  // Generated via kavita-encrypt-secrets.html using your Kavita installId as the password
  // Kavita installId can be grabbed via the server-info-slim API endpoint
  
  const ENCRYPTED = {
    // extraMenuItems: one entry per item; encrypt text and url separately
    menuItems: [
      {
        text: {"salt":"REPLACE","iv":"REPLACE","ct":"REPLACE"},  // encrypted Link Text
        url:  {"salt":"REPLACE","iv":"REPLACE","ct":"REPLACE"},  // encrypted URL
      },
      // add more { text:..., url:... } pairs as needed
    ],
    // motd
    motdTitle: {"salt":"REPLACE","iv":"REPLACE","ct":"REPLACE"},  // encrypted "Title!"
    motdBody:  {"salt":"REPLACE","iv":"REPLACE","ct":"REPLACE"},  // encrypted full HTML body
  };

  // Bump this whenever you want all users to re-see the MOTD.
  const MOTD_ID = '2026-04-26-message';
  const STORAGE_KEY = 'customTweaks.motdDismissed';

  // Decrypted values populated after auth + decryption
  let extraMenuItems = [];
  let motd = null;

  // ===== CRYPTO HELPERS =====
  async function decrypt(blob, password) {
    const b64d = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64d(blob.salt), iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false, ["decrypt"]
    );
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64d(blob.iv) }, key, b64d(blob.ct)
    );
    return new TextDecoder().decode(pt);
}


  // ===== AUTH =====
  function getToken() {
    // Inspect localStorage in DevTools to confirm the right key on your install.
    for (const k of ['kavita-user', 'user']) {
      const v = localStorage.getItem(k);
      if (!v) continue;
      try {
        const parsed = JSON.parse(v);
        if (parsed?.token) return parsed.token;
      } catch {}
    }
    return null;
  }

  async function getPassword() {
    const token = getToken();
    if (!token) return null;
    try {
      const resp = await fetch('/api/server/server-info-slim', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      console.log(resp)
      if (!resp.ok) return null;
      const info = await resp.json();
      return info.installId || null;
    } catch {
      return null;
    }
  }

  let decrypted = false;
  async function ensureDecrypted() {
    if (decrypted) return true;

    const allBlobs = [
      ...ENCRYPTED.menuItems.flatMap(i => [i.text, i.url]),
      ENCRYPTED.motdTitle,
      ENCRYPTED.motdBody,
    ];
    if (allBlobs.some(b => !b || !b.salt || !b.iv || !b.ct ||
                            b.salt === 'REPLACE' || b.iv === 'REPLACE' || b.ct === 'REPLACE')) {
      console.warn('Tweaks: encrypted blobs not configured');
      return false;
    }

    const password = await getPassword();
    if (!password) return false;
    try {
      const items = [];
      for (const item of ENCRYPTED.menuItems) {
        items.push({
          text: await decrypt(item.text, password),
          url:  await decrypt(item.url, password),
        });
      }
      const title = await decrypt(ENCRYPTED.motdTitle, password);
      const body  = await decrypt(ENCRYPTED.motdBody, password);

      extraMenuItems = items;
      motd = { id: MOTD_ID, title, body };
      decrypted = true;
      return true;
    } catch (e) {
      console.warn('Tweaks decryption failed:', e);
      return false;
    }
  }


  // ===== ROUTE GATING =====
  function isLoggedInRoute() {
    const path = window.location.pathname;
    if (path === '/login' || path.startsWith('/login') ||
        path === '/registration' || path.startsWith('/registration') ||
        path.startsWith('/confirm-email') ||
        path.startsWith('/confirm-reset-password') ||
        path === '/' || path === '') {
      return false;
    }
    return true;
  }

  // ===== MOTD =====
  function showMotdIfNeeded() {
    if (!motd || !motd.id) return;

    let dismissedId = null;
    try {
      dismissedId = localStorage.getItem(STORAGE_KEY);
    } catch (e) { /* localStorage may be blocked */ }

    if (dismissedId === motd.id) return;
    if (document.getElementById('custom-motd-overlay')) return;

    const dismiss = () => {
      try {
        localStorage.setItem(STORAGE_KEY, motd.id);
      } catch (e) { /* ignore */ }
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    };

    const overlay = document.createElement('div');
    overlay.id = 'custom-motd-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      font-family: inherit;
      -webkit-backdrop-filter: blur(2px);
      backdrop-filter: blur(2px);
      overflow-y: auto;
      -webkit-tap-highlight-color: transparent;
    `;

    const box = document.createElement('div');
    box.style.cssText = `
      background: var(--bs-body-bg);
      color: var(--body-text-color);
      max-width: 540px;
      width: 100%;
      max-height: calc(100dvh - 2rem);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      border: 1px solid var(--primary-color-darker-shade);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      margin: auto;
    `;
    box.addEventListener('click', (e) => e.stopPropagation());

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 0.875rem 1rem;
      border-bottom: 1px solid var(--primary-color-darker-shade);
      display: flex; align-items: center; justify-content: space-between;
      gap: 0.5rem;
      flex-shrink: 0;
    `;

    const title = document.createElement('h4');
    title.textContent = motd.title || 'Notice';
    title.style.cssText = `
      margin: 0;
      color: var(--body-text-color);
      font-size: 1.15rem; font-weight: 600;
      line-height: 1.3;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      background: transparent; border: none;
      color: var(--body-text-color);
      cursor: pointer;
      font-size: 1.75rem; line-height: 1;
      width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      margin: -0.5rem -0.5rem -0.5rem 0;
      border-radius: 4px;
      opacity: 0.6;
      transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
      flex-shrink: 0;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.opacity = '1';
      closeBtn.style.color = 'var(--primary-color)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.opacity = '0.6';
      closeBtn.style.color = 'var(--body-text-color)';
    });
    closeBtn.addEventListener('click', dismiss);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.innerHTML = motd.body || '';
    body.style.cssText = `
      padding: 1rem 1.25rem;
      line-height: 1.6;
      color: var(--body-text-color);
      font-size: 1rem;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      flex: 1 1 auto;
    `;
    body.querySelectorAll('a').forEach(a => {
      a.style.color = 'var(--primary-color)';
      a.style.textDecoration = 'none';
      a.style.wordBreak = 'break-word';
      a.addEventListener('mouseenter', () => {
        a.style.textDecoration = 'underline';
        a.style.color = 'var(--primary-color-dark-shade)';
      });
      a.addEventListener('mouseleave', () => {
        a.style.textDecoration = 'none';
        a.style.color = 'var(--primary-color)';
      });
    });

    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--primary-color-darker-shade);
      display: flex; justify-content: flex-end; gap: 0.5rem;
      background: var(--primary-color-darkest-shade);
      flex-shrink: 0;
    `;

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.textContent = 'Got it';
    dismissBtn.style.cssText = `
      padding: 0.625rem 1.25rem;
      min-height: 44px;
      border-radius: 4px;
      border: 1px solid var(--primary-color);
      background: var(--primary-color);
      color: var(--bs-body-bg);
      cursor: pointer;
      font-size: 1rem; font-weight: 600;
      transition: background 0.15s ease, border-color 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    `;
    dismissBtn.addEventListener('mouseenter', () => {
      dismissBtn.style.background = 'var(--primary-color-dark-shade)';
      dismissBtn.style.borderColor = 'var(--primary-color-dark-shade)';
    });
    dismissBtn.addEventListener('mouseleave', () => {
      dismissBtn.style.background = 'var(--primary-color)';
      dismissBtn.style.borderColor = 'var(--primary-color)';
    });
    dismissBtn.addEventListener('click', dismiss);

    footer.appendChild(dismissBtn);
    box.appendChild(header);
    box.appendChild(body);
    box.appendChild(footer);
    overlay.appendChild(box);

    overlay.addEventListener('click', dismiss);

    const escHandler = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
  }

  // ===== MENU FUNCTIONS =====
  function addToDesktopMenu() {
    if (!extraMenuItems.length) return;
    const menus = document.querySelectorAll('div.dropdown-menu');
    menus.forEach(menu => {
      if (menu.dataset.extraItemsAdded === 'true') return;
      const profileLink = menu.querySelector('a.dropdown-item[href*="/profile/"]');
      if (!profileLink) return;
      const helpLink = menu.querySelector('a.dropdown-item[target="_blank"]');
      if (!helpLink) return;

      let insertAfter = profileLink;
      extraMenuItems.forEach(item => {
        const newLink = helpLink.cloneNode(true);
        newLink.href = item.url;
        newLink.textContent = item.text;
        insertAfter.insertAdjacentElement('afterend', newLink);
        insertAfter = newLink;
      });
      menu.dataset.extraItemsAdded = 'true';
    });
  }

  function addToMobileMenu() {
    if (!extraMenuItems.length) return;
    const modals = document.querySelectorAll('app-nav-link-modal');
    modals.forEach(modal => {
      if (modal.dataset.extraItemsAdded === 'true') return;
      const modalBody = modal.querySelector('.modal-body');
      if (!modalBody) return;
      const profileLink = modalBody.querySelector('a[href*="/profile/"]');
      if (!profileLink) return;
      const profileWrapper = profileLink.closest('div.mb-3');
      if (!profileWrapper) return;
      const helpLink = modalBody.querySelector('a[target="_blank"]');
      if (!helpLink) return;
      const helpWrapper = helpLink.closest('div.mb-3');
      if (!helpWrapper) return;

      let insertAfter = profileWrapper;
      extraMenuItems.forEach(item => {
        if (modalBody.querySelector(`a[href="${item.url}"]`)) return;
        const newWrapper = helpWrapper.cloneNode(true);
        const newLink = newWrapper.querySelector('a');
        newLink.href = item.url;
        newLink.textContent = item.text;
        insertAfter.insertAdjacentElement('afterend', newWrapper);
        insertAfter = newWrapper;
      });
      modal.dataset.extraItemsAdded = 'true';
    });
  }

  function addMenuItems() {
    try {
      addToDesktopMenu();
      addToMobileMenu();
    } catch (e) {
      console.error('Menu tweak error:', e);
    }
  }

  let scheduled = false;
  function scheduleAdd() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (isLoggedInRoute() && decrypted) addMenuItems();
    });
  }

  // ===== STARTUP / SPA ROUTING =====
  let observer = null;
  let motdShown = false;

  async function runTweaks() {
    if (!isLoggedInRoute()) return;

    const ok = await ensureDecrypted();
    if (!ok) return; // not logged in yet, or decryption failed: try again on next route change

    addMenuItems();

    if (!motdShown) {
      showMotdIfNeeded();
      motdShown = true;
    }

    if (!observer) {
      observer = new MutationObserver(scheduleAdd);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function start() {
    runTweaks();

    //patch History API to detect route changes
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function() {
      origPush.apply(this, arguments);
      window.dispatchEvent(new Event('locationchange'));
    };
    history.replaceState = function() {
      origReplace.apply(this, arguments);
      window.dispatchEvent(new Event('locationchange'));
    };
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
    window.addEventListener('locationchange', runTweaks);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
