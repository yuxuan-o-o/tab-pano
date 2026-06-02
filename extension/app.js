/* ═══════════════════════════════════════════
   Tab Out — app.js
   ═══════════════════════════════════════════ */

// ── Constants ─────────────────────────────
// Must come BEFORE S so the object literal can reference DEFAULT_BG
// without hitting the temporal dead zone.
const DEFAULT_BG = 'bundled:forest'; // first-install default background

// ── State ─────────────────────────────────
const S = {
  mode:   ls('to-mode')   || 'light',
  style:  ls('to-style')  || 'solid',
  layout: ls('to-layout') || 'one-col',
  view:   ls('to-view')   || 'list',
  bg:     ls('to-bg')     || DEFAULT_BG,
  name:   ls('to-name')   || '',
};

let cachedWindows    = [];
let aiModeActive     = false;
let _pickerOpen      = false; // prevents popover from closing while OS picker is active
let savedSectionOpen = true;  // whether the saved-tabs card is expanded

// ── Background image cache ─────────────────
// Images are stored in chrome.storage.local (unlimitedStorage) to avoid the
// ~5 MB localStorage cap that causes heavy compression and blurry wallpapers.
// _bgImagesCache keeps a sync in-memory copy so all existing callers stay sync.
let _bgImagesCache = null;

function ls(k, v) {
  if (v === undefined) return localStorage.getItem(k);
  localStorage.setItem(k, v);
}

// ── Saved tabs ────────────────────────────
function getSaved() {
  try { return JSON.parse(localStorage.getItem('to-saved') || '[]'); } catch { return []; }
}
function setSaved(items) { localStorage.setItem('to-saved', JSON.stringify(items)); }

function toggleSaveTab(tab, btn) {
  const saved = getSaved();
  const idx   = saved.findIndex(s => s.url === tab.url);
  if (idx >= 0) {
    // Already saved → remove it
    saved.splice(idx, 1);
    setSaved(saved);
    btn.classList.remove('saved');
    btn.title = 'Save for later';
  } else {
    // New save → prepend
    saved.unshift({ title: tab.title || 'Untitled', url: tab.url, favIconUrl: tab.favIconUrl, savedAt: Date.now() });
    setSaved(saved);
    btn.classList.add('saved');
    btn.title = 'Remove from saved';
    // Brief pop animation
    btn.style.transition = 'transform 0.18s cubic-bezier(.34,1.56,.64,1)';
    btn.style.transform  = 'scale(1.4)';
    setTimeout(() => { btn.style.transform = ''; }, 180);
    savedSectionOpen = true; // auto-open section on first save
  }
  updateSaveBtn();
  renderSavedSection();
}

function updateSaveBtn() {
  const btn = document.getElementById('saveBtn');
  if (!btn) return;
  const count = getSaved().length;
  const filled = count > 0;
  btn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    ${filled ? `Saved (${count})` : 'Save for later'}`;
  btn.classList.toggle('active', filled && savedSectionOpen);
}

// ── Saved section card ────────────────────
function renderSavedSection() {
  const grid    = document.getElementById('groupsGrid');
  let   section = document.getElementById('savedSection');
  const saved   = getSaved();

  // Remove if empty or toggled off
  if (!saved.length || !savedSectionOpen) {
    if (section) section.remove();
    updateSaveBtn();
    return;
  }

  // Create wrapper once
  if (!section) {
    section = document.createElement('div');
    section.id = 'savedSection';
    section.className = 'window-section';
    grid.prepend(section);
  }

  section.innerHTML = '';
  section.appendChild(buildSavedCard(saved));
}

function buildSavedCard(saved) {
  const card = document.createElement('div');
  card.className = 'group-card saved-card';

  card.innerHTML = `
    <div class="group-header">
      <div class="group-icon saved-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="group-titles">
        <div class="group-name">Saved for later</div>
        <div class="group-meta">${saved.length} item${saved.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="group-controls saved-controls">
        <button class="close-all-btn saved-clear-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Clear all
        </button>
      </div>
    </div>
    <div class="group-body view-list saved-body"></div>
  `;

  const body = card.querySelector('.saved-body');
  saved.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'tab-row';

    // Favicon
    let fav;
    if (item.favIconUrl && !item.favIconUrl.startsWith('chrome://')) {
      fav = document.createElement('img');
      fav.className = 'tab-fav';
      fav.src = item.favIconUrl;
      fav.onerror = () => fav.replaceWith(savedPhEl(item.url));
    } else {
      fav = savedPhEl(item.url);
    }

    const title = document.createElement('span');
    title.className = 'tab-row-title';
    title.textContent = item.title || 'Untitled';

    const acts = document.createElement('div');
    acts.className = 'tab-row-actions';
    acts.innerHTML = `
      <button class="tab-act open-saved" title="Open in new tab">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </button>
      <button class="tab-act close" title="Remove from saved">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;

    row.appendChild(fav);
    row.appendChild(title);
    row.appendChild(acts);

    // Click row → open URL
    row.addEventListener('click', e => {
      if (e.target.closest('.tab-row-actions')) return;
      window.open(item.url, '_blank');
    });
    acts.querySelector('.open-saved').addEventListener('click', e => {
      e.stopPropagation();
      window.open(item.url, '_blank');
    });
    // Remove from saved
    acts.querySelector('.close').addEventListener('click', e => {
      e.stopPropagation();
      const s2 = getSaved();
      s2.splice(i, 1);
      setSaved(s2);
      // Sync bookmark buttons in list views
      syncBookmarkStates();
      // Animate row out then re-render
      row.style.transition = 'opacity 0.18s, max-height 0.22s, padding 0.22s';
      row.style.opacity = '0'; row.style.maxHeight = '0';
      row.style.paddingTop = '0'; row.style.paddingBottom = '0';
      setTimeout(() => { updateSaveBtn(); renderSavedSection(); }, 230);
    });

    body.appendChild(row);
  });

  // Clear all
  card.querySelector('.saved-clear-btn').addEventListener('click', () => {
    setSaved([]);
    syncBookmarkStates();
    updateSaveBtn();
    const s = document.getElementById('savedSection');
    if (s) s.remove();
  });

  return card;
}

// Update all .bookmark buttons in live list views to reflect current saved state
function syncBookmarkStates() {
  const savedUrls = new Set(getSaved().map(s => s.url));
  document.querySelectorAll('.tab-act.bookmark').forEach(btn => {
    const url = btn.closest('.tab-row')?.dataset?.tabUrl;
    if (!url) return;
    const isSaved = savedUrls.has(url);
    btn.classList.toggle('saved', isSaved);
    btn.title = isSaved ? 'Remove from saved' : 'Save for later';
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', isSaved ? 'currentColor' : 'none');
  });
}

function savedPhEl(url) {
  const d = document.createElement('div');
  d.className = 'tab-fav-ph';
  try { d.textContent = new URL(url).hostname[0]?.toUpperCase() || '?'; } catch { d.textContent = '?'; }
  return d;
}

// ── Boot ──────────────────────────────────
async function init() {
  await loadBgImages(); // must come first — applyBg reads _bgImagesCache
  applyAll();
  renderGreeting();
  renderDate();
  fetchWeather();
  renderQuickLinks();
  setupSearch();
  setupDupBtn();
  setupSettings();
  setupColorPicker();
  renderBgColors();
  renderBgImages();
  setupSaveBtn();
  renderAiMgmtBtn(); // show ··· badge if key already saved from a previous session
  loadTabs();
}

function setupSaveBtn() {
  updateSaveBtn();
  document.getElementById('saveBtn').addEventListener('click', () => {
    const count = getSaved().length;
    if (!count) return; // nothing saved yet — button is decorative
    savedSectionOpen = !savedSectionOpen;
    renderSavedSection();
    updateSaveBtn();
  });
}

// ── Apply full state to DOM ───────────────
function applyAll() {
  document.body.dataset.mode   = effectiveMode();
  document.body.dataset.style  = S.style;
  document.body.dataset.layout = S.layout;
  applyBg(S.bg);
  syncToggles();
}

function effectiveMode() {
  if (S.mode !== 'auto') return S.mode;
  const h = new Date().getHours();
  return (h >= 7 && h < 19) ? 'light' : 'dark';
}

setInterval(() => {
  if (S.mode === 'auto') document.body.dataset.mode = effectiveMode();
}, 60_000);

function syncToggles() {
  document.querySelectorAll('.toggle-group').forEach(g => {
    const val = S[g.dataset.setting];
    g.querySelectorAll('.toggle-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.value === val)
    );
  });
  syncBgSelection(S.bg);
}

function syncBgSelection(val) {
  document.querySelectorAll('.bg-swatch').forEach(s =>
    s.classList.toggle('selected', s.dataset.color === val)
  );
  document.querySelectorAll('.bg-thumb').forEach(t =>
    t.classList.toggle('selected', t.dataset.bg === val)
  );
}

// ── Greeting ──────────────────────────────
function renderGreeting() {
  const h = new Date().getHours();
  const suffix = S.name ? `, ${S.name}` : '';
  const g = h < 5  ? 'Good night'
          : h < 12 ? 'Good morning'
          : h < 17 ? 'Good afternoon'
          : h < 21 ? 'Good evening'
                   : 'Good night';
  document.getElementById('greeting').textContent = g + suffix;
}

// ── Date ──────────────────────────────────
// Real Solar Icons (linear style) — exact paths from solar-icons npm package
// SVG default: fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
// Filled shapes (calendar dots) get explicit fill="currentColor" stroke="none"
const _si = (size, content) =>
  `<span class="sub-icon"><svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${content}</svg></span>`;

const ICON = {
  // Solar Icons › Linear › Calendar
  calendar: _si(15, `<path d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12V14C22 17.7712 22 19.6569 20.8284 20.8284C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.8284C2 19.6569 2 17.7712 2 14V12Z"/><path d="M7 4V2.5"/><path d="M17 4V2.5"/><path d="M2.5 9H21.5"/><path d="M18 17C18 17.5523 17.5523 18 17 18C16.4477 18 16 17.5523 16 17C16 16.4477 16.4477 16 17 16C17.5523 16 18 16.4477 18 17Z" fill="currentColor" stroke="none"/><path d="M13 17C13 17.5523 12.5523 18 12 18C11.4477 18 11 17.5523 11 17C11 16.4477 11.4477 16 12 16C12.5523 16 13 16.4477 13 17Z" fill="currentColor" stroke="none"/><path d="M8 17C8 17.5523 7.55228 18 7 18C6.44772 18 6 17.5523 6 17C6 16.4477 6.44772 16 7 16C7.55228 16 8 16.4477 8 17Z" fill="currentColor" stroke="none"/><path d="M18 13C18 13.5523 17.5523 14 17 14C16.4477 14 16 13.5523 16 13C16 12.4477 16.4477 12 17 12C17.5523 12 18 12.4477 18 13Z" fill="currentColor" stroke="none"/><path d="M13 13C13 13.5523 12.5523 14 12 14C11.4477 14 11 13.5523 11 13C11 12.4477 11.4477 12 12 12C12.5523 12 13 12.4477 13 13Z" fill="currentColor" stroke="none"/><path d="M8 13C8 13.5523 7.55228 14 7 14C6.44772 14 6 13.5523 6 13C6 12.4477 6.44772 12 7 12C7.55228 12 8 12.4477 8 13Z" fill="currentColor" stroke="none"/>`),
  // Solar Icons › Linear › Map Point
  pin: _si(14, `<path d="M4 10.1433C4 5.64588 7.58172 2 12 2C16.4183 2 20 5.64588 20 10.1433C20 14.6055 17.4467 19.8124 13.4629 21.6744C12.5343 22.1085 11.4657 22.1085 10.5371 21.6744C6.55332 19.8124 4 14.6055 4 10.1433Z"/><circle cx="12" cy="10" r="3"/>`),
};

function renderDate() {
  const dateEl = document.getElementById('dateStr');
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  dateEl.innerHTML = ICON.calendar + dateStr;
}

// ── Weather ───────────────────────────────
const WMO = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Foggy',48:'Icy fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',71:'Light snow',73:'Snow',75:'Heavy snow',
  80:'Showers',81:'Showers',82:'Heavy showers',95:'Thunderstorm',99:'Thunderstorm',
};

// Solar Icons › Linear — exact paths from package
const _wi = (content) =>
  `<span class="sub-icon weather-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${content}</svg></span>`;

const WMO_ICONS = {
  // Solar Icons › Linear › Sun
  sun: _wi(`<circle cx="12" cy="12" r="6"/><path d="M12 2V3"/><path d="M12 21V22"/><path d="M22 12L21 12"/><path d="M3 12L2 12"/><path d="M19.0708 4.92969L18.678 5.32252"/><path d="M5.32178 18.6777L4.92894 19.0706"/><path d="M19.0708 19.0703L18.678 18.6775"/><path d="M5.32178 5.32227L4.92894 4.92943"/>`),
  // Solar Icons › Linear › Cloud Sun
  sunCloud: _wi(`<path d="M14.381 9.02721C14.9767 8.81911 15.6178 8.70588 16.2857 8.70588C16.9404 8.70588 17.5693 8.81468 18.1551 9.01498M7.11616 11.6089C6.8475 11.5567 6.56983 11.5294 6.28571 11.5294C3.91878 11.5294 2 13.4256 2 15.7647C2 18.1038 3.91878 20 6.28571 20H16.2857C19.4416 20 22 17.4717 22 14.3529C22 11.8811 20.393 9.78024 18.1551 9.01498M7.11616 11.6089C6.88706 10.9978 6.7619 10.3369 6.7619 9.64706C6.7619 6.52827 9.32028 4 12.4762 4C15.4159 4 17.8371 6.19371 18.1551 9.01498M7.11616 11.6089C7.68058 11.7184 8.20528 11.9374 8.66667 12.2426"/><path d="M11.0004 4C10.0882 2.78555 8.63582 2 7 2C4.23858 2 2 4.23858 2 7C2 9.05032 3.2341 10.8124 5 11.584"/>`),
  // Solar Icons › Linear › Cloud Sun (cloud only, no sun arc = overcast)
  cloud: _wi(`<path d="M14.381 9.02721C14.9767 8.81911 15.6178 8.70588 16.2857 8.70588C16.9404 8.70588 17.5693 8.81468 18.1551 9.01498M7.11616 11.6089C6.8475 11.5567 6.56983 11.5294 6.28571 11.5294C3.91878 11.5294 2 13.4256 2 15.7647C2 18.1038 3.91878 20 6.28571 20H16.2857C19.4416 20 22 17.4717 22 14.3529C22 11.8811 20.393 9.78024 18.1551 9.01498M7.11616 11.6089C6.88706 10.9978 6.7619 10.3369 6.7619 9.64706C6.7619 6.52827 9.32028 4 12.4762 4C15.4159 4 17.8371 6.19371 18.1551 9.01498M7.11616 11.6089C7.68058 11.7184 8.20528 11.9374 8.66667 12.2426"/>`),
  // Solar Icons › Linear › Fog
  fog: _wi(`<path d="M14.381 7.02721C14.9767 6.81911 15.6178 6.70588 16.2857 6.70588C16.9404 6.70588 17.5693 6.81468 18.1551 7.01498M7.11616 9.60887C6.8475 9.55673 6.56983 9.52941 6.28571 9.52941C3.91878 9.52941 2 11.4256 2 13.7647C2 14.5852 2.2361 15.3512 2.64482 16M7.11616 9.60887C6.88706 8.9978 6.7619 8.33687 6.7619 7.64706C6.7619 4.52827 9.32028 2 12.4762 2C15.4159 2 17.8371 4.19371 18.1551 7.01498M7.11616 9.60887C7.68059 9.71839 8.20528 9.9374 8.66667 10.2426M18.1551 7.01498C20.393 7.78024 22 9.88113 22 12.3529C22 13.7432 21.4916 15.0161 20.6486 16"/><path d="M8 22H16"/><path d="M5 19H19"/><path d="M2 16H22"/>`),
  // Solar Icons › Linear › Cloud Rain (fewer drops = drizzle)
  drizzle: _wi(`<path d="M14.381 8.02721C14.9767 7.81911 15.6178 7.70588 16.2857 7.70588C16.9404 7.70588 17.5693 7.81468 18.1551 8.01498M7.11616 10.6089C6.8475 10.5567 6.56983 10.5294 6.28571 10.5294C3.91878 10.5294 2 12.4256 2 14.7647C2 16.0746 2.60178 17.2457 3.54704 18.0226M7.11616 10.6089C6.88706 9.9978 6.7619 9.33687 6.7619 8.64706C6.7619 5.52827 9.32028 3 12.4762 3C15.4159 3 17.8371 5.19371 18.1551 8.01498M7.11616 10.6089C7.68059 10.7184 8.20528 10.9374 8.66667 11.2426M18.1551 8.01498C20.393 8.78024 22 10.8811 22 13.3529C22 15.2939 21.0091 17.0061 19.5 18.0226"/><path d="M16 15.5L14 17.5"/><path d="M11.5 15.5L9.5 17.5"/>`),
  // Solar Icons › Linear › Cloud Rain (all 5 drops)
  rain: _wi(`<path d="M14.381 8.02721C14.9767 7.81911 15.6178 7.70588 16.2857 7.70588C16.9404 7.70588 17.5693 7.81468 18.1551 8.01498M7.11616 10.6089C6.8475 10.5567 6.56983 10.5294 6.28571 10.5294C3.91878 10.5294 2 12.4256 2 14.7647C2 16.0746 2.60178 17.2457 3.54704 18.0226M7.11616 10.6089C6.88706 9.9978 6.7619 9.33687 6.7619 8.64706C6.7619 5.52827 9.32028 3 12.4762 3C15.4159 3 17.8371 5.19371 18.1551 8.01498M7.11616 10.6089C7.68059 10.7184 8.20528 10.9374 8.66667 11.2426M18.1551 8.01498C20.393 8.78024 22 10.8811 22 13.3529C22 15.2939 21.0091 17.0061 19.5 18.0226"/><path d="M17 19L15 21"/><path d="M16 15.5L14 17.5"/><path d="M12 20L10 22"/><path d="M11.5 15.5L9.5 17.5"/><path d="M7.5 19L5.5 21"/>`),
  // Solar Icons › Linear › Cloud Snowfall (snowflake star lines)
  snow: _wi(`<path d="M6.28571 19C3.91878 19 2 17.1038 2 14.7647C2 12.4256 3.91878 10.5294 6.28571 10.5294C6.56983 10.5294 6.8475 10.5567 7.11616 10.6089M14.381 8.02721C14.9767 7.81911 15.6178 7.70588 16.2857 7.70588C16.9404 7.70588 17.5693 7.81468 18.1551 8.01498M7.11616 10.6089C6.88706 9.9978 6.7619 9.33687 6.7619 8.64706C6.7619 5.52827 9.32028 3 12.4762 3C15.4159 3 17.8371 5.19371 18.1551 8.01498M7.11616 10.6089C7.68059 10.7184 8.20528 10.9374 8.66667 11.2426M18.1551 8.01498C20.393 8.78024 22 10.8811 22 13.3529C22 16.0599 20.0726 18.3221 17.5 18.8722"/><path d="M12.001 15V22"/><path d="M9.00293 16.7314L15.0016 20.1948"/><path d="M14.999 16.7314L9.00031 20.1948"/>`),
  // Solar Icons › Linear › Cloud Bolt (lightning)
  storm: _wi(`<path d="M6.28571 18C3.91878 18 2 16.1038 2 13.7647C2 11.4256 3.91878 9.52941 6.28571 9.52941C6.56983 9.52941 6.8475 9.55673 7.11616 9.60887M14.381 7.02721C14.9767 6.81911 15.6178 6.70588 16.2857 6.70588C16.9404 6.70588 17.5693 6.81468 18.1551 7.01498M7.11616 9.60887C6.88706 8.9978 6.7619 8.33687 6.7619 7.64706C6.7619 4.52827 9.32028 2 12.4762 2C15.4159 2 17.8371 4.19371 18.1551 7.01498M7.11616 9.60887C7.68059 9.71839 8.20528 9.9374 8.66667 10.2426M18.1551 7.01498C20.393 7.78024 22 9.88113 22 12.3529C22 15.0599 20.0726 17.3221 17.5 17.8722"/><path d="M9.62607 17.4534L10.7744 15.8998C11.5166 14.8955 11.8878 14.3934 12.234 14.4995C12.5803 14.6056 12.5803 15.2215 12.5803 16.4532V16.5694C12.5803 17.0136 12.5803 17.2358 12.7222 17.3751L12.7297 17.3823C12.8748 17.5187 13.106 17.5187 13.5683 17.5187C14.4004 17.5187 14.8165 17.5187 14.9571 17.771C14.9594 17.7752 14.9617 17.7794 14.9639 17.7837C15.0966 18.0399 14.8557 18.3659 14.3739 19.0177L13.2256 20.5713C12.4833 21.5756 12.1122 22.0777 11.7659 21.9716C11.4197 21.8655 11.4197 21.2496 11.4197 20.0179L11.4197 19.9018C11.4197 19.4575 11.4197 19.2354 11.2778 19.096L11.2703 19.0888C11.1252 18.9524 10.894 18.9524 10.4317 18.9524C9.59958 18.9524 9.18354 18.9524 9.04294 18.7001C9.04061 18.6959 9.03835 18.6917 9.03615 18.6874C8.90342 18.4312 9.1443 18.1053 9.62607 17.4534Z"/>`),
};

const WMO_E = {
  0: WMO_ICONS.sun,
  1: WMO_ICONS.sunCloud, 2: WMO_ICONS.sunCloud,
  3: WMO_ICONS.cloud,
  45: WMO_ICONS.fog, 48: WMO_ICONS.fog,
  51: WMO_ICONS.drizzle, 53: WMO_ICONS.drizzle, 55: WMO_ICONS.drizzle,
  61: WMO_ICONS.rain, 63: WMO_ICONS.rain, 65: WMO_ICONS.rain,
  71: WMO_ICONS.snow, 73: WMO_ICONS.snow, 75: WMO_ICONS.snow,
  80: WMO_ICONS.drizzle, 81: WMO_ICONS.rain, 82: WMO_ICONS.rain,
  95: WMO_ICONS.storm, 99: WMO_ICONS.storm,
};

async function fetchWeather() {
  const el  = document.getElementById('weatherStr');
  const sep = document.getElementById('weatherSep');
  try {
    // IP-based geolocation — no browser permission needed, works in all extension contexts.
    // Cache result for 30 min to stay well within ipapi.co's free tier (1000 req/day).
    let lat, lon, city;
    const GEO_TTL = 30 * 60 * 1000;
    try {
      const cached = JSON.parse(localStorage.getItem('to-geo') || 'null');
      if (cached && cached.lat && cached.lon && (Date.now() - cached.ts) < GEO_TTL) {
        ({ lat, lon, city } = cached);
      }
    } catch {}

    if (!lat) {
      // Try multiple IP-geolocation services — order chosen for China accessibility.
      // api.ip.sb  — works reliably in mainland China
      // ipwho.is   — lightweight, often accessible
      // ipapi.co   — fallback for other regions
      // ipinfo.io  — broad global coverage
      let geo = null;
      const GEO_APIS = [
        { url: 'https://api.ip.sb/geoip',     parse: d => d.latitude  ? d : null },
        { url: 'https://ipwho.is/',           parse: d => d.latitude  ? d : null },
        { url: 'https://ipapi.co/json/',      parse: d => d.latitude  ? d : null },
        { url: 'https://ipinfo.io/json',      parse: d => d.loc ? { latitude: +d.loc.split(',')[0], longitude: +d.loc.split(',')[1], city: d.city } : null },
      ];
      for (const { url, parse } of GEO_APIS) {
        try {
          const d = await fetch(url).then(r => r.json());
          const g = parse(d);
          if (g) { geo = g; break; }
        } catch {}
      }
      if (!geo) throw new Error('no geo');
      lat  = geo.latitude;
      lon  = geo.longitude;
      city = geo.city || geo.region || '';
      localStorage.setItem('to-geo', JSON.stringify({ lat, lon, city, ts: Date.now() }));
    }

    const w    = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`
    ).then(r => r.json());
    const temp = Math.round(w.current.temperature_2m);
    const code = w.current.weather_code;
    const cityPart = city ? `${ICON.pin}${esc(city)}<span class="sub-sep">·</span>` : '';
    const weatherIcon = WMO_E[code] || _wi(`<circle cx="12" cy="12" r="5"/>`);
    el.innerHTML = `${cityPart}${weatherIcon}${temp}°C`;
  } catch {
    sep.hidden = true;
  }
}

// ── Quick links ───────────────────────────
const MAX_QUICK_LINKS = 6;
const DEFAULT_LINKS = [
  { name:'Figma',     url:'https://figma.com',        d:'figma.com'     },
  { name:'GitHub',    url:'https://github.com',       d:'github.com'    },
  { name:'X',         url:'https://x.com',            d:'x.com'         },
  { name:'Notion',    url:'https://notion.so',        d:'notion.so'     },
  { name:'Linear',    url:'https://linear.app',       d:'linear.app'    },
  { name:'ChatGPT',   url:'https://chatgpt.com',      d:'chatgpt.com'   },
];

function getLinks() {
  try {
    const s = localStorage.getItem('to-quicklinks');
    return s ? JSON.parse(s) : DEFAULT_LINKS;
  } catch { return DEFAULT_LINKS; }
}
function saveLinks(links) {
  localStorage.setItem('to-quicklinks', JSON.stringify(links));
}

function renderQuickLinks() {
  const c = document.getElementById('quickLinks');
  c.innerHTML = '';
  const links = getLinks();

  links.forEach((link, i) => {
    const a = document.createElement('a');
    a.className = 'quick-link';
    a.href = link.url; a.title = link.name; a.target = '_blank';

    const img = document.createElement('img');
    img.src = `https://www.google.com/s2/favicons?domain=${link.d}&sz=32`;
    img.alt = link.name;
    img.onerror = () => { img.style.display = 'none'; a.prepend(link.name[0]); };
    a.appendChild(img);

    // Delete button — visible on hover (CSS), removes the link
    const del = document.createElement('button');
    del.className = 'ql-delete'; del.title = 'Remove';
    del.innerHTML = `<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    del.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const next = links.filter((_, idx) => idx !== i);
      saveLinks(next); renderQuickLinks();
    });
    a.appendChild(del);
    c.appendChild(a);
  });

  // "+" placeholder — only if under the max; sits at the LEFT (prepended)
  if (links.length < MAX_QUICK_LINKS) {
    const btn = document.createElement('button');
    btn.className = 'quick-link ql-add'; btn.title = 'Add shortcut';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    btn.addEventListener('click', () => openQlPopover(btn));
    c.prepend(btn); // always the leftmost item
  }
}

// ── Add-link popover ──────────────────────
function openQlPopover(anchor) {
  // Toggle off if already open
  const existing = document.getElementById('qlPopover');
  if (existing) { existing.remove(); return; }

  const pop = document.createElement('div');
  pop.id = 'qlPopover'; pop.className = 'ql-popover';
  pop.innerHTML = `
    <input class="ql-input" id="qlUrlInput" type="text" placeholder="Paste a URL…" autocomplete="off" spellcheck="false">
    <button class="ql-confirm" id="qlConfirmBtn">Add</button>
  `;
  document.body.appendChild(pop);

  // Position: centred below the anchor
  const r = anchor.getBoundingClientRect();
  pop.style.top       = `${r.bottom + 8 + window.scrollY}px`;
  pop.style.left      = `${r.left + window.scrollX}px`; // left-align with the + button
  pop.style.transform = 'none';

  const input = pop.querySelector('#qlUrlInput');
  input.focus();

  function commit() {
    let raw = input.value.trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
    let hostname;
    try { hostname = new URL(raw).hostname.replace(/^www\./, ''); } catch { return; }
    const base = hostname.split('.')[0];
    const name = base.charAt(0).toUpperCase() + base.slice(1);
    const links = getLinks();
    if (links.length >= MAX_QUICK_LINKS) return;
    links.push({ name, url: raw, d: hostname });
    saveLinks(links); pop.remove(); renderQuickLinks();
  }

  pop.querySelector('#qlConfirmBtn').addEventListener('click', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') pop.remove();
  });

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!pop.contains(e.target) && e.target !== anchor) {
        pop.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 0);
}

// ── Duplicate tab detection ───────────────
function getDuplicates() {
  const allTabs = cachedWindows.flatMap(w => w.tabs || []).filter(t => !isExtensionTab(t));
  const seen = new Map(); // url → first tab
  const extras = [];
  for (const t of allTabs) {
    const key = t.url;
    if (seen.has(key)) { extras.push(t); } else { seen.set(key, t); }
  }
  return extras;
}

function updateDupBtn() {
  const extras = getDuplicates();
  const btn    = document.getElementById('dupBtn');
  const label  = document.getElementById('dupLabel');
  if (!btn) return;
  if (extras.length === 0) { btn.style.display = 'none'; return; }
  btn.style.display = '';
  label.textContent = `${extras.length} duplicate${extras.length > 1 ? 's' : ''}`;
}

const DUP_PANEL_THRESHOLD = 3; // show review panel if duplicates ≥ this

function setupDupBtn() {
  document.getElementById('dupBtn').addEventListener('click', () => {
    const extras = getDuplicates();
    if (!extras.length) return;

    // Few duplicates → close immediately, no friction
    if (extras.length < DUP_PANEL_THRESHOLD) {
      closeExtras(extras);
      return;
    }

    // Many duplicates → show review panel
    const existing = document.getElementById('dupPanel');
    if (existing) { existing.remove(); return; } // toggle off
    renderDupPanel(extras);
  });
}

async function closeExtras(extras) {
  await Promise.all(extras.map(t => chrome.tabs.remove(t.id).catch(() => {})));
  cachedWindows = await chrome.windows.getAll({ populate: true });
  document.getElementById('dupPanel')?.remove();
  renderTabs();
}

function renderDupPanel(extras) {
  // Group extras by URL to show "Title — X copies will be closed"
  const byUrl = new Map();
  for (const t of extras) {
    if (!byUrl.has(t.url)) byUrl.set(t.url, []);
    byUrl.get(t.url).push(t);
  }

  const panel = document.createElement('div');
  panel.id = 'dupPanel';
  panel.className = 'dup-panel';

  const header = document.createElement('div');
  header.className = 'dup-panel-header';
  header.innerHTML = `<span>Keeping the first of each — closing <strong>${extras.length}</strong> extra${extras.length > 1 ? 's' : ''}</span>`;
  panel.appendChild(header);

  const list = document.createElement('div');
  list.className = 'dup-panel-list';

  byUrl.forEach((tabs, url) => {
    const row = document.createElement('div');
    row.className = 'dup-row';

    const fav = document.createElement('img');
    fav.className = 'dup-fav';
    fav.width = fav.height = 14;
    try { fav.src = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch {}
    fav.onerror = () => { fav.style.display = 'none'; };

    const title = document.createElement('span');
    title.className = 'dup-title';
    title.textContent = tabs[0].title || url;

    const count = document.createElement('span');
    count.className = 'dup-count';
    count.textContent = `×${tabs.length + 1}`; // extras + the one we keep

    row.appendChild(fav);
    row.appendChild(title);
    row.appendChild(count);
    list.appendChild(row);
  });

  panel.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'dup-panel-actions';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'pill-btn dup-confirm-btn';
  confirmBtn.textContent = `Close ${extras.length} extras`;
  confirmBtn.onclick = () => closeExtras(extras);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'pill-btn dup-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => panel.remove();

  actions.appendChild(confirmBtn);
  actions.appendChild(cancelBtn);
  panel.appendChild(actions);

  // Insert right after meta-row
  const metaRow = document.querySelector('.meta-row');
  metaRow.insertAdjacentElement('afterend', panel);
}

// ── Tab Search ────────────────────────────
let _tsdIdx = -1; // keyboard-selected index in dropdown

function setupSearch() {
  const input = document.getElementById('searchInput');
  const drop  = document.getElementById('tabSearchDrop');

  // ── Global keyboard shortcut: / or Cmd+K → focus search ──
  document.addEventListener('keydown', e => {
    if (e.target === input) return; // already focused
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });

  // Show/hide + render on typing
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) { closeTsd(); return; }
    renderTsd(q);
  });

  // Keyboard nav
  input.addEventListener('keydown', e => {
    const items = drop.querySelectorAll('.tsd-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _tsdIdx = Math.min(_tsdIdx + 1, items.length - 1);
      highlightTsd(items);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      _tsdIdx = Math.max(_tsdIdx - 1, -1);
      highlightTsd(items);
      return;
    }
    if (e.key === 'Escape') {
      closeTsd(); input.blur(); return;
    }
    if (e.key === 'Enter') {
      // If a tab result is highlighted → jump to it
      if (_tsdIdx >= 0 && items[_tsdIdx]) {
        items[_tsdIdx].click(); return;
      }
      // Otherwise → Google search
      const q = input.value.trim();
      if (q) {
        window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, '_blank');
        input.value = '';
        closeTsd();
      }
    }
  });

  // Close when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) closeTsd();
  });
}

function renderTsd(q) {
  const drop = document.getElementById('tabSearchDrop');
  const lower = q.toLowerCase();

  // Collect all tabs from all windows
  const allTabs = cachedWindows.flatMap(w =>
    (w.tabs || []).map(t => ({ ...t, windowId: w.id }))
  );

  const matches = allTabs.filter(t =>
    (t.title  || '').toLowerCase().includes(lower) ||
    (t.url    || '').toLowerCase().includes(lower)
  ).slice(0, 6);

  if (!matches.length) { closeTsd(); return; }

  _tsdIdx = -1;
  drop.innerHTML = '';

  const multiWindow = cachedWindows.filter(w => (w.tabs||[]).length).length > 1;

  matches.forEach(tab => {
    const item = document.createElement('div');
    item.className = 'tsd-item';

    // Favicon
    const fav = document.createElement('img');
    fav.className = 'tsd-fav';
    fav.width = fav.height = 16;
    fav.src = tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=32`;
    fav.onerror = () => { fav.style.display = 'none'; };

    // Text block
    const text = document.createElement('div');
    text.className = 'tsd-text';

    const title = document.createElement('span');
    title.className = 'tsd-title';
    title.textContent = tab.title || tab.url;

    const url = document.createElement('span');
    url.className = 'tsd-url';
    try { url.textContent = new URL(tab.url).hostname; } catch { url.textContent = tab.url; }

    text.appendChild(title);
    text.appendChild(url);

    // Window badge (only if multiple windows)
    if (multiWindow) {
      const badge = document.createElement('span');
      badge.className = 'tsd-badge';
      const winIdx = cachedWindows.findIndex(w => w.id === tab.windowId);
      badge.textContent = `W${winIdx + 1}`;
      item.appendChild(fav);
      item.appendChild(text);
      item.appendChild(badge);
    } else {
      item.appendChild(fav);
      item.appendChild(text);
    }

    item.addEventListener('click', () => {
      chrome.windows.update(tab.windowId, { focused: true });
      chrome.tabs.update(tab.id, { active: true });
      closeTsd();
      document.getElementById('searchInput').value = '';
    });

    drop.appendChild(item);
  });

  drop.classList.add('open');
}

function highlightTsd(items) {
  items.forEach((el, i) => el.classList.toggle('active', i === _tsdIdx));
}

function closeTsd() {
  const drop = document.getElementById('tabSearchDrop');
  if (drop) { drop.classList.remove('open'); drop.innerHTML = ''; }
  _tsdIdx = -1;
}

// ── Load tabs (entry point) ───────────────
async function loadTabs() {
  try {
    cachedWindows = await chrome.windows.getAll({ populate: true });
  } catch {
    document.getElementById('groupsGrid').innerHTML =
      `<div class="empty-state">Load as a Chrome Extension to see your tabs.<br>
       <small style="opacity:.6;font-size:13px">chrome://extensions → Load unpacked → select extension folder</small></div>`;
    return;
  }

  const allTabs = cachedWindows
    .flatMap(w => w.tabs)
    .filter(t => !isExtensionTab(t));

  document.getElementById('tabCountPill').textContent   = `${allTabs.length} tab${allTabs.length !== 1 ? 's' : ''} open`;
  updateDupBtn();
  const groupPill = document.getElementById('groupCountPill');
  if (cachedWindows.length <= 1) {
    groupPill.style.display = 'none'; // single window — redundant info
  } else {
    groupPill.style.display = '';
    groupPill.textContent = `${cachedWindows.length} windows`;
  }

  renderDefault();
  renderSavedSection();   // show saved card on top if items exist

  // Background-fetch OG images for any tab that has no cached image yet.
  // Fire-and-forget: the grid re-renders itself once images start arriving.
  prefetchMissingOgImages(allTabs);
}

async function prefetchMissingOgImages(allTabs) {
  const httpTabs = allTabs.filter(t => t.url?.startsWith('http'));
  if (!httpTabs.length) return;

  // Check which tabs already have a cached image (ogimg or thumb)
  try {
    const keys   = httpTabs.flatMap(t => [`ogimg_${t.id}`, `thumb_${t.id}`]);
    const stored = await chrome.storage.local.get(keys);
    const missing = httpTabs.filter(
      t => !stored[`ogimg_${t.id}`] && !stored[`thumb_${t.id}`]
    );
    if (!missing.length) return;

    // Ask the background worker to fetch them (it can make credentialed requests)
    chrome.runtime.sendMessage({
      type: 'fetch_og_images',
      tabs: missing.map(t => ({ id: t.id, url: t.url })),
    });
  } catch { /* extension not fully loaded yet */ }
}

function isExtensionTab(t) {
  return !t.url || t.url.startsWith('chrome-extension://') || t.url.startsWith('chrome://');
}

// ── Default render: Window → Domain ──────
function renderDefault() {
  const grid = document.getElementById('groupsGrid');
  grid.innerHTML = '';

  // Count windows that actually have visible tabs
  const activeWindows = cachedWindows.filter(
    win => win.tabs.some(t => !isExtensionTab(t))
  );
  const singleWindow = activeWindows.length === 1;

  cachedWindows.forEach((win, i) => {
    const tabs = win.tabs.filter(t => !isExtensionTab(t));
    if (!tabs.length) return;

    // Hide the "Window X / close" header when there's only one window — redundant noise
    const section = buildWindowSection(win, tabs, i + 1, singleWindow);
    grid.appendChild(section);
  });
}

// ── Window section ─────────────────────────
function buildWindowSection(win, tabs, idx, hideHeader = false) {
  const section = document.createElement('div');
  section.className = 'window-section';

  if (!hideHeader) {
    // Header (flat, no card) — only shown when multiple windows are open
    const header = document.createElement('div');
    header.className = 'window-header';

    const closeIcon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    header.innerHTML = `
      <span class="window-header-title">Window ${idx}</span>
      <span class="window-header-count" title="Close window">
        <span class="wc-label-default">${tabs.length} tab${tabs.length !== 1 ? 's' : ''}</span>
        <span class="wc-label-hover">${closeIcon} Close window</span>
      </span>
    `;

    // Close all tabs in this window on click
    header.querySelector('.window-header-count').addEventListener('click', async () => {
      const tabIds = tabs.map(t => t.id).filter(Boolean);
      if (tabIds.length) await chrome.tabs.remove(tabIds);
    });

    section.appendChild(header);
  }

  // Domain grid
  const domainGrid = document.createElement('div');
  domainGrid.className = 'domain-grid';

  const grouped = groupByDomain(tabs);
  const DOMAIN_COLORS_LIGHT = [
    '#dff0e8','#deeaf8','#fef0db','#f0e4f8','#fce4e4','#e4f8f0',
    '#fdf0e4','#e4eaf8','#f8f4e4','#e8e4f8',
  ];
  // Same hues, dark & semi-transparent for dark mode
  const DOMAIN_COLORS_DARK = [
    'rgba(47,110,78,0.35)',   // mint
    'rgba(45,90,160,0.35)',   // blue
    'rgba(130,95,30,0.35)',   // amber
    'rgba(100,60,150,0.35)',  // lavender
    'rgba(140,50,50,0.35)',   // rose
    'rgba(30,110,90,0.35)',   // teal
    'rgba(140,90,40,0.35)',   // peach
    'rgba(60,80,160,0.35)',   // periwinkle
    'rgba(120,110,50,0.35)',  // cream
    'rgba(90,70,160,0.35)',   // lilac
  ];
  const isDark = document.body.dataset.mode === 'dark';
  const DOMAIN_COLORS = isDark ? DOMAIN_COLORS_DARK : DOMAIN_COLORS_LIGHT;
  let colorIdx = 0;

  // Sort: bigger groups first, Other always last
  const entries = Object.entries(grouped).sort(([a, at], [b, bt]) => {
    if (a === 'other') return 1;
    if (b === 'other') return -1;
    return bt.length - at.length;
  });

  entries.forEach(([domain, dtabs]) => {
    const bg = DOMAIN_COLORS[colorIdx++ % DOMAIN_COLORS.length];
    const card = buildDomainCard(domain, dtabs, bg);
    domainGrid.appendChild(card);
  });

  section.appendChild(domainGrid);
  return section;
}

// ── Group tabs by domain ──────────────────
// Domains with ≤ 2 tabs → merged into "other"
function groupByDomain(tabs) {
  const map = {};
  tabs.forEach(tab => {
    let domain = 'other';
    try { domain = new URL(tab.url).hostname.replace(/^www\./, ''); } catch {}
    if (!map[domain]) map[domain] = [];
    map[domain].push(tab);
  });

  const result = {};
  const otherTabs = [];

  Object.entries(map).forEach(([domain, dtabs]) => {
    if (domain === 'other' || dtabs.length <= 2) {
      otherTabs.push(...dtabs);
    } else {
      result[domain] = dtabs;
    }
  });

  if (otherTabs.length > 0) result['other'] = otherTabs;
  return result;
}

// ── Domain group card ─────────────────────
// aiEmoji: if provided, use it as the icon instead of favicon (AI-organized groups)
function buildDomainCard(domain, tabs, bgColor, aiEmoji = null) {
  const card = document.createElement('div');
  card.className = 'group-card';
  card._tabs = tabs;

  const isOther = domain === 'other';
  const displayName = isOther ? 'Other' : domain;

  // Icon: AI emoji > folder for Other > favicon for real domains
  let iconHtml;
  if (aiEmoji) {
    iconHtml = `<div class="group-icon" style="background:${bgColor}">${esc(aiEmoji)}</div>`;
  } else if (isOther) {
    iconHtml = `<div class="group-icon" style="background:${bgColor}">📂</div>`;
  } else {
    iconHtml = `
      <div class="group-icon" style="background:${bgColor}">
        <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32"
             alt="" style="width:20px;height:20px;border-radius:4px"
             onerror="this.style.display='none'">
      </div>`;
  }

  card.innerHTML = `
    <div class="group-header">
      ${iconHtml}
      <div class="group-titles">
        <div class="group-name">${esc(displayName)}</div>
        <div class="group-meta">${tabs.length} tab${tabs.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="group-controls">
        <div class="vtm">
          <button class="vtm-btn" data-view="grid" title="Image view">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="1" y="1" width="8" height="8" rx="1.5"/><rect x="11" y="1" width="8" height="8" rx="1.5"/>
              <rect x="1" y="11" width="8" height="8" rx="1.5"/><rect x="11" y="11" width="8" height="8" rx="1.5"/>
            </svg>
          </button>
          <button class="vtm-btn active" data-view="list" title="List">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="6" y1="5" x2="18" y2="5"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="6" y1="15" x2="18" y2="15"/>
              <circle cx="2.5" cy="5" r="1.2" fill="currentColor" stroke="none"/>
              <circle cx="2.5" cy="10" r="1.2" fill="currentColor" stroke="none"/>
              <circle cx="2.5" cy="15" r="1.2" fill="currentColor" stroke="none"/>
            </svg>
          </button>
        </div>
        <button class="close-all-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Close all
        </button>
      </div>
    </div>
    <div class="group-body"></div>
  `;

  const body = card.querySelector('.group-body');
  renderList(body, tabs);

  // Per-card view toggle
  card.querySelectorAll('.vtm-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      card.querySelectorAll('.vtm-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (btn.dataset.view === 'grid') renderGrid(body, tabs);
      else renderList(body, tabs);
    });
  });

  // Close all
  card.querySelector('.close-all-btn').addEventListener('click', async e => {
    e.stopPropagation();
    confetti(card);
    await Promise.all(tabs.map(t => chrome.tabs.remove(t.id).catch(() => {})));
    card.style.transition = 'opacity 0.4s, transform 0.4s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.94)';
    setTimeout(() => card.remove(), 420);
  });

  return card;
}

// ── AI mode ───────────────────────────────
function getApiKey() { return localStorage.getItem('to-anthropic-key') || ''; }
function setApiKey(k) { localStorage.setItem('to-anthropic-key', k.trim()); }

// Entry point — called when user clicks "Organize with AI"
async function handleAiBtn() {
  if (!getApiKey()) {
    openApiKeyPopover();
    return;
  }
  await runAiOrganize();
}

// ── API key popover (first-time setup / change) ───
function openApiKeyPopover(onSave) {
  // Close if already open (toggle)
  const existing = document.getElementById('aiKeyPopover');
  if (existing) { existing.remove(); return; }

  const aiBtn  = document.getElementById('aiBtn');
  const setBtn = document.getElementById('settingsBtn');
  const hasKey = !!getApiKey();

  const pop = document.createElement('div');
  pop.id = 'aiKeyPopover';
  pop.className = 'ql-popover ai-key-popover';
  pop.innerHTML = `
    <div class="ai-key-inner">
      <div class="ai-key-heading">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
        ${hasKey ? 'Update API key' : 'API key'}
      </div>
      <p class="ai-key-hint">
        Stored locally, never leaves your browser.
        <a class="ai-key-link" href="https://console.anthropic.com/settings/keys" target="_blank">Get a Claude key ↗</a>
      </p>
      <div class="ai-key-row">
        <input class="ql-input ai-key-input" id="aiKeyInput" type="password"
               placeholder="Paste your API key…" autocomplete="off" spellcheck="false">
        <button class="ql-confirm" id="aiKeyConfirm">${hasKey ? 'Update' : 'Start'}</button>
      </div>
    </div>`;
  document.body.appendChild(pop);

  // ── Width + position = same as settings popover ──
  const sr = setBtn.getBoundingClientRect();
  const ar = aiBtn.getBoundingClientRect();
  pop.style.top   = `${ar.bottom + 10 + window.scrollY}px`;
  pop.style.left  = 'auto';
  pop.style.right = `${window.innerWidth - sr.right}px`;
  pop.style.width = `${sr.right - ar.left}px`;

  const input = pop.querySelector('#aiKeyInput');
  input.focus();

  async function confirm() {
    const key = input.value.trim();
    if (!key) return;
    setApiKey(key);
    pop.remove();
    renderAiMgmtBtn();          // show/hide the ··· badge
    if (onSave) onSave();
    else await runAiOrganize();
  }

  pop.querySelector('#aiKeyConfirm').addEventListener('click', confirm);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirm();
    if (e.key === 'Escape') pop.remove();
  });
  setTimeout(() => {
    document.addEventListener('click', function h(e) {
      if (!pop.contains(e.target) && e.target !== aiBtn) {
        pop.remove(); document.removeEventListener('click', h);
      }
    });
  }, 0);
}

// ── AI button — hover key-management dot ──
// Shows a ··· badge on hover when a key is already saved.
// Clicking it opens a mini popover with Change / Remove.
function renderAiMgmtBtn() {
  const aiBtn = document.getElementById('aiBtn');
  let mgmt    = document.getElementById('aiMgmtBtn');

  if (getApiKey()) {
    if (!mgmt) {
      mgmt = document.createElement('button');
      mgmt.id        = 'aiMgmtBtn';
      mgmt.className = 'ai-mgmt-btn';
      mgmt.title     = 'Manage API key';
      // Three-dot SVG (horizontally centred, always crisp)
      mgmt.innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>`;
      mgmt.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        openKeyMgmtPopover();
      });
      aiBtn.appendChild(mgmt);
    }
  } else {
    mgmt?.remove();
  }
}

// Mini popover: Change key / Remove key
function openKeyMgmtPopover() {
  const existing = document.getElementById('keyMgmtPop');
  if (existing) { existing.remove(); return; }

  const aiBtn = document.getElementById('aiBtn');
  const srBtn = document.getElementById('settingsBtn');

  const pop = document.createElement('div');
  pop.id        = 'keyMgmtPop';
  pop.className = 'ql-popover key-mgmt-pop';
  pop.innerHTML = `
    <button class="km-btn" id="kmChange">Change key</button>
    <button class="km-btn km-remove" id="kmRemove">Remove key</button>`;
  document.body.appendChild(pop);

  // Same width + alignment as the settings popover
  const sr = srBtn.getBoundingClientRect();
  const ar = aiBtn.getBoundingClientRect();
  pop.style.top   = `${ar.bottom + 10 + window.scrollY}px`;
  pop.style.right = `${window.innerWidth - sr.right}px`;
  pop.style.left  = 'auto';
  pop.style.width = `${sr.right - ar.left}px`;

  pop.querySelector('#kmChange').addEventListener('click', e => {
    e.stopPropagation(); pop.remove();
    openApiKeyPopover(() => renderAiMgmtBtn()); // onSave: just refresh badge
  });
  pop.querySelector('#kmRemove').addEventListener('click', e => {
    e.stopPropagation(); pop.remove();
    localStorage.removeItem('to-anthropic-key');
    renderAiMgmtBtn();
    if (aiModeActive) {
      aiModeActive = false;
      document.getElementById('aiBtn').classList.remove('active');
      renderDefault(); renderSavedSection();
    }
  });

  setTimeout(() => {
    document.addEventListener('click', function h(e) {
      if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', h); }
    });
  }, 0);
}

// ── AI organize flow ──────────────────────
async function runAiOrganize() {
  const aiBtn = document.getElementById('aiBtn');
  const grid  = document.getElementById('groupsGrid');

  // Loading state
  aiBtn.disabled = true;
  aiBtn.classList.add('active');
  aiBtn.innerHTML = `
    <svg class="ai-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Organizing…`;
  grid.innerHTML = `<div class="empty-state ai-loading">
    <div class="ai-loading-icon">✦</div>
    <div>Grouping your tabs by topic…</div>
  </div>`;

  try {
    const allTabs = cachedWindows
      .flatMap(w => w.tabs)
      .filter(t => !isExtensionTab(t) && t.url && t.title);

    if (!allTabs.length) throw new Error('No tabs to organize.');

    const groups = await fetchAiGroups(allTabs);
    renderAiGroups(groups, allTabs);
    aiModeActive = true;
    aiBtn.classList.add('active');
  } catch (err) {
    console.error('[Tab Out AI]', err);
    const isAuthErr = err.message?.includes('401') || err.message?.includes('auth');
    grid.innerHTML = `<div class="empty-state">
      <div style="font-size:24px;margin-bottom:12px">⚠️</div>
      <strong>${isAuthErr ? 'Invalid API key' : 'Something went wrong'}</strong><br>
      <span style="font-size:13px;opacity:.7;display:block;margin-top:6px">${esc(err.message)}</span>
      ${isAuthErr ? `<button class="pill-btn" id="aiRetryKeyBtn" style="margin-top:14px;font-size:13px">Update API key</button>` : ''}
    </div>`;
    if (isAuthErr) {
      localStorage.removeItem('to-anthropic-key');
      document.getElementById('aiRetryKeyBtn')?.addEventListener('click', () => {
        aiModeActive = false; aiBtn.classList.remove('active');
        renderDefault(); renderSavedSection();
        openApiKeyPopover();
      });
    }
    aiModeActive = false;
  } finally {
    aiBtn.disabled = false;
    aiBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
      </svg>
      Organize with AI`;
    renderAiMgmtBtn(); // re-attach gear badge — innerHTML wipe removed it
  }
}

// ── AI provider detection & unified caller ─
function detectProvider(key) {
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-'))     return 'openai';
  if (key.startsWith('AIza'))    return 'gemini';
  return 'anthropic'; // sensible default
}

async function callAI(prompt) {
  const key = getApiKey();
  const provider = detectProvider(key);
  if (provider === 'openai')  return callOpenAI(prompt, key);
  if (provider === 'gemini')  return callGemini(prompt, key);
  return callAnthropic(prompt, key);
}

async function callAnthropic(prompt, key) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const msg  = body?.error?.message || resp.statusText || 'Unknown error';
    if (resp.status === 401) throw new Error(`401 — ${msg}`);
    throw new Error(`API error ${resp.status}: ${msg}`);
  }
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAI(prompt, key) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (resp.status === 401) throw new Error('401 — invalid or expired API key.');
  if (!resp.ok) throw new Error(`API error ${resp.status}: ${resp.statusText}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(prompt, key) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err?.error?.message || resp.statusText;
    if (resp.status === 400 || resp.status === 401 || resp.status === 403)
      throw new Error(`401 — ${msg}`);
    throw new Error(`API error ${resp.status}: ${msg}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Tab grouping prompt + response parsing ─
async function fetchAiGroups(tabs) {
  const tabList = tabs
    .map((t, i) => `${i}. "${t.title.slice(0, 80)}" — ${t.url.slice(0, 100)}`)
    .join('\n');

  const prompt = `You are organizing someone's browser tabs by topic.

Here are their open tabs:
${tabList}

Group these tabs into meaningful topic clusters. Return ONLY valid JSON, no markdown fences, no explanation:
{
  "groups": [
    { "name": "Group Name", "emoji": "🎨", "tabIndices": [0, 3, 7] }
  ]
}

Rules:
- Create 3–8 groups
- Group by topic or task, not by website
- Every tab index must appear in exactly one group
- Names: 2–4 words, descriptive
- Pick a fitting emoji per group
- Tabs that don't fit anywhere else go into a group named "Other" with emoji "📂"`;

  const text = await callAI(prompt);
  const json  = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed.groups)) throw new Error('Unexpected response format.');
  return parsed.groups;
}

// ── Render AI groups ──────────────────────
function renderAiGroups(groups, allTabs) {
  const grid = document.getElementById('groupsGrid');
  grid.innerHTML = '';

  const domainGrid = document.createElement('div');
  domainGrid.className = 'domain-grid';

  const ICON_COLORS_LIGHT = [
    '#deeaf8','#dff0e8','#fef0db','#f0e4f8','#fce4e4','#e4f8f0','#fdf0e4','#e4eaf8',
  ];
  const ICON_COLORS_DARK = [
    'rgba(45,90,160,0.35)','rgba(47,110,78,0.35)','rgba(130,95,30,0.35)',
    'rgba(100,60,150,0.35)','rgba(140,50,50,0.35)','rgba(30,110,90,0.35)',
    'rgba(140,90,40,0.35)','rgba(60,80,160,0.35)',
  ];
  const isDark  = document.body.dataset.mode === 'dark';
  const palette = isDark ? ICON_COLORS_DARK : ICON_COLORS_LIGHT;

  groups.forEach((group, idx) => {
    const tabs = (group.tabIndices || [])
      .map(i => allTabs[i])
      .filter(Boolean);
    if (!tabs.length) return;

    const bg   = palette[idx % palette.length];
    const card = buildDomainCard(group.name, tabs, bg, group.emoji);
    domainGrid.appendChild(card);
  });

  grid.appendChild(domainGrid);
}

// ── Render tab list ───────────────────────
function renderList(body, tabs) {
  body.className = 'group-body view-list';
  body.innerHTML = '';
  const savedUrls = new Set(getSaved().map(s => s.url));

  tabs.forEach(tab => {
    const row = document.createElement('div');
    row.className = 'tab-row';
    row.dataset.tabUrl = tab.url || '';  // needed by syncBookmarkStates()

    const isSaved = savedUrls.has(tab.url);
    const fav = favEl(tab, false);
    const title = document.createElement('span');
    title.className = 'tab-row-title';
    title.textContent = tab.title || 'Untitled';
    const acts = document.createElement('div');
    acts.className = 'tab-row-actions';
    acts.innerHTML = `
      <button class="tab-act bookmark${isSaved ? ' saved' : ''}" title="${isSaved ? 'Remove from saved' : 'Save for later'}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <button class="tab-act close" title="Close tab">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;
    row.appendChild(fav); row.appendChild(title); row.appendChild(acts);

    row.addEventListener('click', e => {
      if (e.target.closest('.tab-row-actions')) return;
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    });
    acts.querySelector('.bookmark').addEventListener('click', e => {
      e.stopPropagation();
      // Sync fill state on the SVG inside the button before toggling
      const svg = e.currentTarget.querySelector('svg');
      toggleSaveTab(tab, e.currentTarget);
      if (svg) svg.setAttribute('fill', e.currentTarget.classList.contains('saved') ? 'currentColor' : 'none');
    });
    acts.querySelector('.close').addEventListener('click', async e => {
      e.stopPropagation();
      confetti(row);
      await chrome.tabs.remove(tab.id).catch(() => {});
      row.style.transition = 'opacity 0.18s, max-height 0.22s, padding 0.22s';
      row.style.opacity = '0'; row.style.maxHeight = '0';
      row.style.paddingTop = '0'; row.style.paddingBottom = '0';
      setTimeout(() => row.remove(), 240);
    });
    body.appendChild(row);
  });
}

// ── Render tab grid ───────────────────────
async function renderGrid(body, tabs) {
  body.className = 'group-body view-grid';
  body.innerHTML = '';

  // Load OG images (URL strings) + screenshot thumbnails (data-URLs)
  // Priority in the cell: og:image → screenshot → large favicon → initial letter
  let stored = {};
  try {
    const keys = tabs.flatMap(t => [`ogimg_${t.id}`, `thumb_${t.id}`]);
    stored = await chrome.storage.local.get(keys);
  } catch { /* storage not yet active — show placeholders */ }

  tabs.forEach(tab => {
    const cell = document.createElement('div');
    cell.className = 'tab-grid-cell';
    const initial = (tab.title || '?')[0].toUpperCase();
    const fav = favEl(tab, true);
    const titleEl = document.createElement('span');
    titleEl.className = 'tgc-title'; titleEl.textContent = tab.title || 'Untitled';
    const foot = document.createElement('div');
    foot.className = 'tgc-foot'; foot.appendChild(fav); foot.appendChild(titleEl);

    const imgDiv = document.createElement('div');
    imgDiv.className = 'tgc-img';

    const ogUrl    = stored[`ogimg_${tab.id}`];   // OG image URL (preferred)
    const thumbUrl = stored[`thumb_${tab.id}`];   // screenshot data-URL (fallback)

    function showFaviconFallback() {
      if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
        const favLarge = document.createElement('img');
        favLarge.className = 'tgc-fav-large';
        favLarge.src = tab.favIconUrl;
        favLarge.onerror = () => {
          favLarge.remove();
          imgDiv.innerHTML = `<span class="tgc-initial">${esc(initial)}</span>`;
        };
        imgDiv.appendChild(favLarge);
      } else {
        imgDiv.innerHTML = `<span class="tgc-initial">${esc(initial)}</span>`;
      }
    }

    if (ogUrl) {
      // ✅ OG image — designed by the site for previews, best quality
      const img = document.createElement('img');
      img.className = 'tgc-screenshot';
      img.src = ogUrl;
      img.onerror = () => {
        img.remove();
        if (thumbUrl) {
          const img2 = document.createElement('img');
          img2.className = 'tgc-screenshot';
          img2.src = thumbUrl;
          imgDiv.appendChild(img2);
        } else showFaviconFallback();
      };
      imgDiv.appendChild(img);
    } else if (thumbUrl) {
      // ✅ Screenshot captured by background.js
      const img = document.createElement('img');
      img.className = 'tgc-screenshot';
      img.src = thumbUrl;
      imgDiv.appendChild(img);
    } else {
      // ⏳ Nothing cached yet
      showFaviconFallback();
    }

    cell.appendChild(imgDiv);
    cell.appendChild(foot);
    cell.addEventListener('click', () => {
      chrome.tabs.update(tab.id, { active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    });
    body.appendChild(cell);
  });
}

// ── Favicon helpers ───────────────────────
function favEl(tab, small) {
  if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
    const img = document.createElement('img');
    img.className = small ? 'tab-fav-sm' : 'tab-fav';
    img.src = tab.favIconUrl;
    img.onerror = () => img.replaceWith(phEl(tab, small));
    return img;
  }
  return phEl(tab, small);
}
function phEl(tab, small) {
  const d = document.createElement('div');
  d.className = small ? 'tab-fav-sm-ph' : 'tab-fav-ph';
  try { d.textContent = new URL(tab.url).hostname[0]?.toUpperCase() || '?'; } catch { d.textContent = '?'; }
  return d;
}

// ── Settings ──────────────────────────────
function setupSettings() {
  const settBtn = document.getElementById('settingsBtn');
  const aiBtn   = document.getElementById('aiBtn');
  const popover = document.getElementById('settingsPopover');

  // Settings popover toggle
  settBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = popover.classList.toggle('open');
    settBtn.classList.toggle('active', open);
    if (open) positionPopover();
    else closeColorPicker(true); // save color if settings closes
  });

  document.addEventListener('click', e => {
    const cpEl   = document.getElementById('cpPopover');
    const cpOpen = cpEl && cpEl.classList.contains('open');
    const inPop  = popover.contains(e.target) || e.target === settBtn;
    const inCp   = cpEl && cpEl.contains(e.target);

    if (!inPop && !inCp) {
      // Click outside everything — close both
      if (cpOpen) closeColorPicker(true);
      if (!_pickerOpen) { // don't close settings if a file picker is open
        popover.classList.remove('open');
        settBtn.classList.remove('active');
      }
      return;
    }
    // Click inside settings panel but outside color picker — close just the color picker
    // (guard against the same click that opened the picker immediately closing it)
    if (cpOpen && inPop && !inCp && !_cpJustOpened) {
      closeColorPicker(true);
    }
  });

  // AI button — toggle off if already in AI mode, otherwise run organize
  aiBtn.addEventListener('click', () => {
    if (aiModeActive) {
      aiModeActive = false;
      aiBtn.classList.remove('active');
      renderDefault();
      renderSavedSection();
    } else {
      handleAiBtn();
    }
  });

  // Settings toggle buttons
  document.querySelectorAll('.toggle-group').forEach(g => {
    g.addEventListener('click', e => {
      const b = e.target.closest('.toggle-btn');
      if (!b) return;
      const key = g.dataset.setting, val = b.dataset.value;
      g.querySelectorAll('.toggle-btn').forEach(x => x.classList.toggle('active', x === b));
      S[key] = val; ls(`to-${key}`, val);
      applySetting(key, val);
    });
  });

}

function positionPopover() {
  const sr  = document.getElementById('settingsBtn').getBoundingClientRect();
  const ar  = document.getElementById('aiBtn').getBoundingClientRect();
  const pop = document.getElementById('settingsPopover');
  // Right edge = Settings right; left edge = AI left
  pop.style.left  = 'auto';
  pop.style.right = (window.innerWidth - sr.right) + 'px';
  pop.style.width = (sr.right - ar.left) + 'px';
  pop.style.top   = (sr.bottom + 10) + 'px';
}

function applySetting(key, val) {
  if (key === 'mode') {
    document.body.dataset.mode = effectiveMode();
    // Icon background colors are set inline at render time — re-render so they
    // pick up the correct light/dark palette.
    if (!aiModeActive) { renderDefault(); renderSavedSection(); }
  } else if (key === 'style') {
    document.body.dataset.style = val;
  } else if (key === 'layout') {
    document.body.dataset.layout = val;
  } else if (key === 'view' && !aiModeActive) {
    document.querySelectorAll('.group-card').forEach(card => {
      const body = card.querySelector('.group-body');
      if (!body || !card._tabs) return;
      card.querySelectorAll('.vtm-btn').forEach(b => b.classList.toggle('active', b.dataset.view === val));
      if (val === 'grid') renderGrid(body, card._tabs);
      else renderList(body, card._tabs);
    });
  }
}

// ── Background storage (fixed 3 slots each) ──
const BG_SLOTS         = 3;
const DEFAULT_BG_COLORS = ['#BED3E8', '#EAEAEA', '#0C0B0F'];

// ── Bundled wallpapers (shipped with the extension, used as default slot values on first install) ──
// Users can delete these and upload their own — they behave exactly like user-uploaded images.
const BUNDLED_WALLPAPERS = [
  { key: 'bundled:forest',     url: 'wallpapers/forest.jpg',     label: 'Forest'     },
  { key: 'bundled:ocean',      url: 'wallpapers/ocean.jpg',      label: 'Ocean'      },
  { key: 'bundled:urban',      url: 'wallpapers/urban.jpg',      label: 'Urban'      },
];

function getBgColors() {
  try {
    const v = localStorage.getItem('to-bg-colors');
    if (v) {
      const arr = JSON.parse(v);
      while (arr.length < BG_SLOTS) arr.push(null);
      return arr.slice(0, BG_SLOTS);
    }
  } catch {}
  return [...DEFAULT_BG_COLORS];
}
function saveBgColors(arr) { localStorage.setItem('to-bg-colors', JSON.stringify(arr.slice(0, BG_SLOTS))); }

function deleteColorSlot(i) {
  const arr = getBgColors();
  const removed = arr[i];
  arr[i] = null;
  saveBgColors(arr);
  if (S.bg === removed) {
    S.bg = arr.find(c => c) || DEFAULT_BG;
    ls('to-bg', S.bg); applyBg(S.bg);
  }
  renderBgColors(); syncBgSelection(S.bg);
}

function getBgImages() {
  const arr = _bgImagesCache ? [..._bgImagesCache] : [null, null, null];
  while (arr.length < BG_SLOTS) arr.push(null);
  return arr.slice(0, BG_SLOTS);
}
function saveBgImages(arr) {
  _bgImagesCache = arr.slice(0, BG_SLOTS);
  chrome.storage.local.set({ 'to-bg-images-v2': _bgImagesCache }).catch(() => {});
}

// Load bg images from chrome.storage.local into the in-memory cache.
// Falls back to the old localStorage key so existing wallpapers aren't lost.
async function loadBgImages() {
  try {
    const result = await chrome.storage.local.get('to-bg-images-v2');
    const stored = result['to-bg-images-v2'];
    if (Array.isArray(stored)) {
      _bgImagesCache = stored;
      return;
    }
    // Migrate from old localStorage storage (low-res images)
    const old = localStorage.getItem('to-bg-images');
    if (old) {
      try { _bgImagesCache = JSON.parse(old); } catch {}
      if (_bgImagesCache) return;
    }
  } catch {}
  // First install — pre-populate slots with bundled wallpapers so the picker looks great out of the box.
  // Users can delete any of them and upload their own (they behave like regular uploaded images).
  _bgImagesCache = BUNDLED_WALLPAPERS.map(wp => ({
    key: wp.key,
    dataUrl: chrome.runtime.getURL(wp.url),
  }));
  // Pad to BG_SLOTS if fewer than 3 bundled wallpapers
  while (_bgImagesCache.length < BG_SLOTS) _bgImagesCache.push(null);
}

function deleteImageSlot(i) {
  const arr = getBgImages();
  const removed = arr[i]?.key;
  arr[i] = null;
  saveBgImages(arr);
  if (S.bg === removed) { S.bg = DEFAULT_BG; ls('to-bg', S.bg); applyBg(S.bg); }
  renderBgImages(); syncBgSelection(S.bg);
}

// ── SVG + icon (matches the rest of the icon set) ───────────────
function makePlusIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '12'); svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  const h = document.createElementNS(ns, 'line');
  h.setAttribute('x1','5'); h.setAttribute('y1','12'); h.setAttribute('x2','19'); h.setAttribute('y2','12');
  const v = document.createElementNS(ns, 'line');
  v.setAttribute('x1','12'); v.setAttribute('y1','5'); v.setAttribute('x2','12'); v.setAttribute('y2','19');
  svg.appendChild(h); svg.appendChild(v);
  return svg;
}

// ── Render bg pickers ─────────────────────
function renderBgColors() {
  const container = document.getElementById('bgColors');
  if (!container) return;
  container.innerHTML = '';
  getBgColors().forEach((color, i) => {
    const btn = document.createElement('button');
    if (color !== null) {
      btn.className = 'bg-swatch' + (S.bg === color ? ' selected' : '');
      btn.dataset.color = color;
      btn.style.background = color;
      btn.title = color;
      btn.onclick = () => { S.bg = color; ls('to-bg', color); applyBg(color); syncBgSelection(color); };
      const del = document.createElement('button');
      del.className = 'swatch-del';
      del.textContent = '×';
      del.onclick = e => { e.stopPropagation(); deleteColorSlot(i); };
      btn.appendChild(del);
    } else {
      btn.className = 'bg-swatch bg-swatch-add';
      btn.title = 'Add custom color';
      btn.appendChild(makePlusIcon());
      btn.onclick = e => { e.stopPropagation(); openColorPicker(i); };
    }
    container.appendChild(btn);
  });
}

// ── Image upload ──────────────────────────
// Create a fresh <input type="file"> for every upload attempt.
// This avoids File-object invalidation, stale event handlers, and
// every other "it worked once but not again" class of bug.
function triggerImageUpload(slotIdx) {
  const inp = document.createElement('input');
  inp.type   = 'file';
  inp.accept = 'image/*';
  inp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(inp);
  _pickerOpen = true;

  function cleanup() {
    _pickerOpen = false;
    if (inp.parentNode) inp.parentNode.removeChild(inp);
  }

  inp.addEventListener('cancel', cleanup);

  inp.addEventListener('change', function() {
    const file = this.files && this.files[0];
    if (!file) { cleanup(); return; }

    // Read the file FIRST, clear/remove the input only after reading
    const reader = new FileReader();
    reader.onerror = cleanup;
    reader.onload = function(ev) {
      cleanup(); // safe to remove now — we have the data URL
      const img = new Image();
      img.onerror = function() {};
      img.onload  = function() {
        // Store in chrome.storage.local (unlimitedStorage) — no need to compress aggressively.
        // Cap at 2560px on the longest side to keep render performance good on Retina screens.
        const key = 'img_' + Date.now();
        const arr = getBgImages();
        const MAX_PX = 2560;
        const scale  = Math.min(1, MAX_PX / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width  = Math.round(img.width  * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        arr[slotIdx] = { key, dataUrl: c.toDataURL('image/jpeg', 0.92) };
        saveBgImages(arr);
        const saved = true;
        S.bg = key; ls('to-bg', key);
        applyBg(key); renderBgImages(); syncBgSelection(key);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file); // file still valid — input not yet cleared
  });

  inp.click();
}

function renderBgImages() {
  const container = document.getElementById('bgPicker');
  if (!container) return;
  container.innerHTML = '';
  getBgImages().forEach((img, i) => {
    const thumb = document.createElement('div');
    if (img !== null) {
      thumb.className = 'bg-thumb' + (S.bg === img.key ? ' selected' : '');
      thumb.dataset.bg = img.key;
      thumb.onclick = () => { S.bg = img.key; ls('to-bg', img.key); applyBg(img.key); syncBgSelection(img.key); };
      const inner = document.createElement('div');
      inner.className = 'bg-thumb-inner';
      inner.style.backgroundImage = `url("${img.dataUrl}")`;
      thumb.appendChild(inner);
      const del = document.createElement('button');
      del.className = 'thumb-del';
      del.textContent = '×';
      del.onclick = e => { e.stopPropagation(); deleteImageSlot(i); };
      thumb.appendChild(del);
    } else {
      thumb.className = 'bg-thumb bg-thumb-add';
      thumb.appendChild(makePlusIcon());
      const slotIdx = i;
      thumb.addEventListener('click', function(e) {
        e.stopPropagation();
        triggerImageUpload(slotIdx);
      });
    }
    container.appendChild(thumb);
  });
}

// ── Custom HSV Color Picker ───────────────
let _cpSlot      = -1;
let _cpHue       = 210;   // 0–360
let _cpSat       = 0.35;  // 0–1
let _cpBri       = 0.88;  // 0–1 (brightness/value)
let _cpOrigBg    = '';
let _cpJustOpened = false; // guard: prevent the same click that opens the picker from instantly closing it

function hsvToHex(h, s, v) {
  const f = (n, k = (n + h / 60) % 6) =>
    v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
  const hex2 = n => Math.round(n * 255).toString(16).padStart(2, '0');
  return '#' + hex2(f(5)) + hex2(f(3)) + hex2(f(1));
}
function hexToHsv(hex) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return { h: 210, s: 0.35, v: 0.88 };
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let hh = 0;
  if (d) {
    if (max===r) hh = ((g-b)/d % 6 + 6) % 6;
    else if (max===g) hh = (b-r)/d + 2;
    else hh = (r-g)/d + 4;
  }
  return { h: hh * 60, s: max ? d/max : 0, v: max };
}

function cpDrawSv() {
  const c = document.getElementById('cpSv');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const hueHex = hsvToHex(_cpHue, 1, 1);
  const gH = ctx.createLinearGradient(0,0,W,0);
  gH.addColorStop(0, '#fff'); gH.addColorStop(1, hueHex);
  ctx.fillStyle = gH; ctx.fillRect(0,0,W,H);
  const gV = ctx.createLinearGradient(0,0,0,H);
  gV.addColorStop(0, 'rgba(0,0,0,0)'); gV.addColorStop(1, '#000');
  ctx.fillStyle = gV; ctx.fillRect(0,0,W,H);
  // cursor
  const cx = _cpSat * W, cy = (1 - _cpBri) * H;
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.stroke();
}
function cpDrawHue() {
  const c = document.getElementById('cpHue');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const g = ctx.createLinearGradient(0,0,W,0);
  for (let i = 0; i <= 7; i++) g.addColorStop(i/7, `hsl(${i*360/7},100%,50%)`);
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
  const x = (_cpHue / 360) * W;
  ctx.beginPath(); ctx.arc(x, H/2, H/2 - 1.5, 0, Math.PI*2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, H/2, H/2 - 1.5, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1; ctx.stroke();
}
function cpRefreshUi() {
  const hex = hsvToHex(_cpHue, _cpSat, _cpBri);
  const hexEl = document.getElementById('cpHex');
  const preEl = document.getElementById('cpPreview');
  if (hexEl && document.activeElement !== hexEl) hexEl.value = hex.toUpperCase();
  if (preEl) preEl.style.background = hex;
  applyBg(hex); // live preview on page background
  cpDrawSv();
  cpDrawHue();
}
function cpSaveColor() {
  const hex = hsvToHex(_cpHue, _cpSat, _cpBri);
  const arr = getBgColors();
  arr[_cpSlot] = hex;
  saveBgColors(arr);
  S.bg = hex; ls('to-bg', hex);
  applyBg(hex); renderBgColors(); syncBgSelection(hex);
}

function openColorPicker(slotIdx) {
  _cpSlot = slotIdx;
  _cpOrigBg = S.bg;
  // Init HSV from current slot color
  const arr = getBgColors();
  const cur = arr[slotIdx];
  if (cur && /^#[0-9a-fA-F]{6}$/.test(cur)) {
    const { h, s, v } = hexToHsv(cur);
    _cpHue = h; _cpSat = s; _cpBri = v;
  } else {
    _cpHue = 210; _cpSat = 0.35; _cpBri = 0.88;
  }
  const picker  = document.getElementById('cpPopover');
  const settPop = document.getElementById('settingsPopover');
  picker.classList.add('open');
  _pickerOpen = true;
  // Guard: ignore the bubbling click that opened this picker
  _cpJustOpened = true;
  setTimeout(() => { _cpJustOpened = false; }, 150);
  // Position: to the RIGHT of settings panel, 10px gap (same as the gap above the settings panel).
  // Bottom edge aligned with settings panel bottom; height is natural (content-driven).
  const pr       = settPop.getBoundingClientRect();
  const GAP      = 10;
  const CP_WIDTH = 208;
  const leftPos  = Math.min(pr.right + GAP, window.innerWidth - CP_WIDTH - 4);
  picker.style.left   = leftPos + 'px';
  picker.style.right  = 'auto';
  picker.style.top    = pr.top + 'px';
  picker.style.bottom = 'auto';
  picker.style.height = pr.height + 'px';

  // SV canvas fills remaining height:
  // total - padding(28) - cp-top(32) - gaps(30) - hue(16) - add-btn(34) = total - 140
  const svH = Math.max(80, Math.round(pr.height - 140));
  const svC = document.getElementById('cpSv');
  svC.style.height = svH + 'px';
  svC.height       = svH; // canvas drawing buffer must match display height
  cpRefreshUi();
}
function closeColorPicker(save) {
  const picker = document.getElementById('cpPopover');
  if (!picker) return;
  picker.classList.remove('open');
  _pickerOpen = false;
  if (_cpSlot >= 0) {
    // Color picker was open — either save or revert
    if (save) {
      cpSaveColor();
    } else {
      // Revert background to what it was before we opened the picker
      S.bg = _cpOrigBg; ls('to-bg', _cpOrigBg);
      applyBg(_cpOrigBg);
      syncBgSelection(_cpOrigBg);
    }
    _cpSlot = -1;
  }
}

function setupColorPicker() {
  const svC  = document.getElementById('cpSv');
  const hueC = document.getElementById('cpHue');
  const hexI = document.getElementById('cpHex');
  if (!svC || !hueC) return;
  let svDown = false, hueDown = false;
  const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));

  function onSv(e) {
    const r = svC.getBoundingClientRect();
    _cpSat = clamp((e.clientX - r.left) / r.width,  0, 1);
    _cpBri = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    cpRefreshUi();
  }
  function onHue(e) {
    const r = hueC.getBoundingClientRect();
    _cpHue = clamp(((e.clientX - r.left) / r.width) * 360, 0, 360);
    cpRefreshUi();
  }

  svC.addEventListener('mousedown',  e => { e.preventDefault(); svDown = true;  onSv(e); });
  hueC.addEventListener('mousedown', e => { e.preventDefault(); hueDown = true; onHue(e); });
  document.addEventListener('mousemove', e => {
    if (svDown)  onSv(e);
    if (hueDown) onHue(e);
  });
  document.addEventListener('mouseup', () => {
    if (svDown || hueDown) { svDown = false; hueDown = false; }
  });

  if (hexI) {
    hexI.addEventListener('input', e => {
      const v = e.target.value.trim();
      const full = v.startsWith('#') ? v : '#' + v;
      if (/^#[0-9a-fA-F]{6}$/.test(full)) {
        const {h,s,v:bri} = hexToHsv(full);
        _cpHue = h; _cpSat = s; _cpBri = bri;
        document.getElementById('cpPreview').style.background = full;
        applyBg(full);
        cpDrawSv(); cpDrawHue();
      }
    });
    hexI.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { closeColorPicker(true);  e.preventDefault(); }
      if (e.key === 'Escape') { closeColorPicker(false); e.preventDefault(); }
    });
  }

  const addBtn = document.getElementById('cpAddBtn');
  if (addBtn) addBtn.addEventListener('click', e => { e.stopPropagation(); closeColorPicker(true); });
}


// ── Background ────────────────────────────
function applyBg(val) {
  const layer = document.getElementById('bgLayer');
  if (!val || val.startsWith('#')) {
    layer.style.backgroundImage = 'none';
    layer.style.backgroundColor = val || DEFAULT_BG;
    layer.classList.remove('bg-blurred');
    document.body.dataset.bgDark = isColorDark(val || DEFAULT_BG) ? 'true' : 'false';
  } else {
    // Image backgrounds (user-uploaded or pre-loaded bundled wallpapers).
    // Both are stored in _bgImagesCache with a .dataUrl that is either a data: URI
    // or a chrome-extension:// URL (for bundled defaults). Both work in CSS and as img.src.
    const img = getBgImages().filter(Boolean).find(img => img.key === val);
    if (img) {
      layer.style.backgroundImage = `url("${img.dataUrl}")`;
      layer.style.backgroundColor = '';
      layer.classList.add('bg-blurred');
      detectImgBrightness(img.dataUrl);
      return;
    }
    document.body.dataset.bgDark = 'false';
  }
}

// Sample a 64×64 thumbnail of the image to determine perceived brightness,
// then set bgDark so text/element colors adapt automatically in light mode.
function detectImgBrightness(dataUrl) {
  const img = new Image();
  img.onload = function() {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, S, S);
    const px = ctx.getImageData(0, 0, S, S).data;
    let lum = 0;
    for (let i = 0; i < px.length; i += 4)
      lum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    document.body.dataset.bgDark = (lum / (S * S) < 0.45) ? 'true' : 'false';
  };
  img.src = dataUrl;
}

// perceived luminance threshold for "dark"
function isColorDark(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
}

// ── Confetti ──────────────────────────────
function confetti(el) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const colors = ['#4a8a5a','#88c4a0','#a4c8e4','#f0d090','#ffffff','#b8d4be','#e8c4a0'];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'cp';
    const sz    = 5 + Math.random() * 5;
    const angle = (Math.PI * 2 * i / 22) + (Math.random() - 0.5) * 0.6;
    const spd   = 70 + Math.random() * 110;
    const dx    = Math.cos(angle) * spd;
    const dy    = Math.sin(angle) * spd - 55;
    p.style.cssText = `left:${cx}px;top:${cy}px;width:${sz}px;height:${sz}px;` +
                      `background:${colors[i % colors.length]};--dx:${dx}px;--dy:${dy}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

// ── Util ──────────────────────────────────
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// ── Start ─────────────────────────────────
init();
