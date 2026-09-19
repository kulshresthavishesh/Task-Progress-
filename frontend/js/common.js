// common.js - helpers shared by every page: API calls, auth guard, dates, icons, toasts, dialogs, layout shell.

const API_BASE = 'https://name-task-progress-backend.onrender.com';

const TOKEN_KEY = 'tp-token';
const USER_KEY = 'tp-user';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const el = (id) => document.getElementById(id);


/* ---------- API ---------- */

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  let res;

  try {
    res = await fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers,
      body: options.body
        ? JSON.stringify(options.body)
        : undefined
    });
  } catch (err) {
    throw new Error(
      "Can't reach the server. Check your connection and try again."
    );
  }

  let data = null;

  try {
    data = await res.json();
  } catch (err) {
    // Empty or non-JSON response
  }

  if (!res.ok) {
    if (res.status === 401 && !options.noRedirect) {
      logout(true);
    }

    const error = new Error(
      (data && data.message) ||
      'Something went wrong. Please try again.'
    );

    error.status = res.status;

    throw error;
  }

  return data;
}


/* ---------- Authentication ---------- */

function logout(expired) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  location.replace(
    'login.html' + (expired ? '?expired=1' : '')
  );
}


// Call at the top of every private page.
// Returns the user, or null if the page should stop.
async function requireAuth() {
  if (!localStorage.getItem(TOKEN_KEY)) {
    location.replace('login.html');
    return null;
  }

  try {
    const data = await api('/auth/me');

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(data.user)
    );

    return data.user;

  } catch (err) {
    if (err.status !== 401) {
      const main = el('main');

      if (main) {
        main.innerHTML = emptyState(
          "We couldn't load your account",
          err.message
        );
      }
    }

    return null;
  }
}


/* ---------- Dates & numbers ---------- */

const pad = (n) => String(n).padStart(2, '0');

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);

  return new Date(y, m - 1, d);
}

function shiftDate(str, days) {
  const d = parseDate(str);

  d.setDate(d.getDate() + days);

  return toDateStr(d);
}

function formatDate(str, opts) {
  return parseDate(str).toLocaleDateString(
    'en-US',
    opts || {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }
  );
}

function percent(completed, total) {
  return total === 0
    ? 0
    : Math.round((completed / total) * 100);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function greeting() {
  const h = new Date().getHours();

  return h < 12
    ? 'Good morning'
    : h < 17
      ? 'Good afternoon'
      : 'Good evening';
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );
}


/* ---------- Icons ---------- */

const ICONS = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',

  tasks:
    '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8M13 12h8M13 18h8"/>',

  calendar:
    '<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/>',

  analytics:
    '<path d="M3 3v18h18"/><path d="M8 17V9M13 17V5M18 17v-6"/>',

  settings:
    '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',

  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',

  moon:
    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',

  edit:
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',

  trash:
    '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',

  plus:
    '<path d="M12 5v14M5 12h14"/>',

  check:
    '<path d="M20 6 9 17l-5-5"/>',

  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',

  left:
    '<path d="m15 18-6-6 6-6"/>',

  right:
    '<path d="m9 18 6-6-6-6"/>'
};

function icon(name, size = 18) {
  return `
    <svg
      width="${size}"
      height="${size}"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      ${ICONS[name] || ''}
    </svg>
  `;
}

const LOGO = `
  <svg
    width="26"
    height="26"
    viewBox="0 0 26 26"
    aria-hidden="true"
  >
    <circle
      cx="13"
      cy="13"
      r="10"
      fill="none"
      stroke="var(--border)"
      stroke-width="3.5"
    />

    <circle
      cx="13"
      cy="13"
      r="10"
      fill="none"
      stroke="var(--accent)"
      stroke-width="3.5"
      stroke-linecap="round"
      stroke-dasharray="46 63"
      transform="rotate(-90 13 13)"
    />
  </svg>
`;


/* ---------- Small UI helpers ---------- */

function emptyState(title, text) {
  return `
    <div class="empty">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function toast(message, type = 'info') {
  let box = el('toasts');

  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'toasts';

    document.body.appendChild(box);
  }

  const t = document.createElement('div');

  t.className = 'toast ' + type;

  t.setAttribute(
    'role',
    type === 'error' ? 'alert' : 'status'
  );

  t.textContent = message;

  box.appendChild(t);

  setTimeout(() => {
    t.classList.add('out');

    setTimeout(() => t.remove(), 250);
  }, 3500);
}


// Resolves to true (confirmed) or false.
function confirmDialog({
  title,
  message,
  confirmText = 'Delete'
}) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');

    dlg.className = 'modal small';

    dlg.innerHTML = `
      <div class="modal-body">
        <h2>${escapeHtml(title)}</h2>
        <p class="muted">
          ${escapeHtml(message)}
        </p>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          class="btn ghost"
          data-answer="no"
        >
          Cancel
        </button>

        <button
          type="button"
          class="btn danger"
          data-answer="yes"
        >
          ${escapeHtml(confirmText)}
        </button>
      </div>
    `;

    document.body.appendChild(dlg);

    let answer = false;

    dlg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-answer]');

      if (btn) {
        answer = btn.dataset.answer === 'yes';
        dlg.close();
      } else if (e.target === dlg) {
        dlg.close();
      }
    });

    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(answer);
    });

    dlg.showModal();
  });
}


/* ---------- Charts ---------- */

function cssVar(name) {
  return getComputedStyle(
    document.documentElement
  )
    .getPropertyValue(name)
    .trim();
}

function applyChartDefaults() {
  if (!window.Chart) return;

  Chart.defaults.font.family =
    "'Manrope', system-ui, sans-serif";

  Chart.defaults.font.weight = 600;

  Chart.defaults.color = cssVar('--muted');

  Chart.defaults.borderColor = cssVar('--border');
}


/* ---------- Layout shell ---------- */

function bindThemeToggles() {
  document
    .querySelectorAll('[data-theme-toggle]')
    .forEach((btn) => {
      btn.addEventListener('click', toggleTheme);
    });
}

function buildShell(user, page) {
  const items = [
    ['dashboard', 'Dashboard', 'dashboard.html'],
    ['tasks', 'Tasks', 'tasks.html'],
    ['calendar', 'Calendar', 'calendar.html'],
    ['analytics', 'Analytics', 'analytics.html'],
    ['settings', 'Settings', 'settings.html']
  ];

  const links = items
    .map(
      ([key, label, href]) =>
        `<a href="${href}"${
          key === page
            ? ' aria-current="page"'
            : ''
        }>${icon(
          key,
          20
        )}<span>${label}</span></a>`
    )
    .join('');

  const themeIcons = `
    <span class="icon-moon">
      ${icon('moon', 20)}
    </span>

    <span class="icon-sun">
      ${icon('sun', 20)}
    </span>
  `;

  el('sidebar').innerHTML = `
    <a class="brand" href="dashboard.html">
      ${LOGO}
      <span>TaskProgress</span>
    </a>

    <nav class="nav" aria-label="Main">
      ${links}
    </nav>

    <div class="sidebar-foot">

      <button
        type="button"
        class="nav-btn"
        data-theme-toggle
      >
        ${themeIcons}
        <span>Switch theme</span>
      </button>

      <div class="user">

        <span class="avatar">
          ${escapeHtml(
            user.name.charAt(0).toUpperCase()
          )}
        </span>

        <div>
          <strong class="user-name">
            ${escapeHtml(user.name)}
          </strong>

          <span class="muted small">
            ${escapeHtml(user.email)}
          </span>
        </div>

        <button
          type="button"
          class="icon-btn"
          data-logout
          aria-label="Log out"
          title="Log out"
        >
          ${icon('logout')}
        </button>

      </div>
    </div>
  `;

  el('bottomnav').innerHTML = links;

  el('mobileTop').innerHTML = `
    <a class="brand" href="dashboard.html">
      ${LOGO}
      <span>TaskProgress</span>
    </a>

    <button
      type="button"
      class="icon-btn"
      data-theme-toggle
      aria-label="Switch theme"
    >
      ${themeIcons}
    </button>
  `;

  bindThemeToggles();

  document
    .querySelectorAll('[data-logout]')
    .forEach((btn) => {
      btn.addEventListener(
        'click',
        () => logout()
      );
    });
}