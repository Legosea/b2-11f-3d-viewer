import './style.css';
import {i18n, t} from './i18n.js';
import {createViewer} from './app.js';
import {createProductPanel} from './products.js';
import {createJoystick} from './joystick.js';
import {createFullscreen} from './fullscreen.js';
import {LIGHT_DEFAULTS} from './lighting.js';
import {
  encodeState, decodeState, loadCurrent, saveCurrent, loadSaved, pushSaved, MAX_SAVED
} from './state.js';

const $ = selector => document.querySelector(selector);
export const caseBaseUrl = base => {
  const value = String(base || '/');
  return `${value.endsWith('/') ? value : value + '/'}case`;
};
const CASE_BASE = caseBaseUrl(import.meta.env.BASE_URL);

// ---------- case loading ----------
async function loadCase() {
  const files = {
    case: 'case.json',
    plan: 'plan.json',
    style: 'style.json',
    products: 'furniture-products.json',
    state: 'state.json',
    concepts: 'concept-renders.json'
  };
  const entries = await Promise.all(Object.entries(files).map(async ([key, name]) => {
    const response = await fetch(`${CASE_BASE}/${name}`, {cache: 'no-cache'});
    // concept-renders.json is optional in the contract; the rest is not.
    if (!response.ok) {
      if (key === 'concepts') return [key, {version: 1, renders: []}];
      throw new Error(`${name}: HTTP ${response.status}`);
    }
    return [key, await response.json()];
  }));
  return Object.fromEntries(entries);
}

// ---------- shell markup ----------
const range = (id, label, min, max, value, step = 1) => `
  <label class="control">
    <span>${label}<output id="${id}Value">${value}</output></span>
    <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
  </label>`;

$('#app').innerHTML = `
<header class="topbar">
  <div class="brand">
    <span class="brand-mark"></span>
    <div><h1 id="caseName">${t('appTitle')}</h1><small>${t('appSubtitle')}</small></div>
  </div>
  <div class="topbar-info"><span id="caseMeta"></span><span class="pill" id="stagePill"></span></div>
</header>

<main class="workspace">
  <section class="scene-panel" aria-label="3D">
    <div id="viewport"></div>
    <div class="room-labels" id="labels"></div>
    <div id="loading" role="status" aria-live="polite">
      <div class="loading-bar"><i id="loadingFill"></i></div>
      <p class="loading-status" id="loadingStatus">${t('loading')}</p>
    </div>
    <div class="scene-top">
      <div class="view-toggle" role="group">
        <button type="button" data-view="orbit">${t('viewOrbit')}</button>
        <button type="button" data-view="top">${t('viewTop')}</button>
        <button type="button" data-view="axon">${t('viewAxon')}</button>
        <button type="button" data-view="inside">${t('viewInside')}</button>
        <button type="button" data-view="walk">${t('viewWalk')}</button>
      </div>
    </div>
    <div class="legend"><span class="dot"></span><span id="status">${t('statusConceptual')}</span></div>
    <div id="hint" role="status" hidden></div>
    <div id="walkHUD" hidden>
      <p class="walk-instruction" id="walkHint"></p>
      <div class="walk-actions">
        <button type="button" id="walkRun">${t('walkRun')}</button>
        <button type="button" id="walkCrouch">${t('walkCrouch')}</button>
        <button type="button" id="walkExit">${t('walkExit')}</button>
      </div>
    </div>
    <div class="scene-bottom">
      <div class="toolbar">
        <button type="button" class="tool" id="wallToggle" aria-pressed="false">${t('toolWalls')}</button>
        <button type="button" class="tool" id="labelToggle" aria-pressed="true">${t('toolLabels')}</button>
        <button type="button" class="tool" id="photo">${t('toolPhoto')}</button>
        <button type="button" class="tool" id="measure" aria-pressed="false">${t('toolMeasure')}</button>
        <button type="button" class="tool" id="resetView">${t('toolReset')}</button>
        <button type="button" class="tool" id="fullscreen">${t('toolFullscreen')}</button>
      </div>
    </div>
  </section>

  <aside class="side">
    <nav class="panel-tabs" role="tablist">
      <button type="button" data-tab="plan" class="active">${t('tabPlan')}</button>
      <button type="button" data-tab="furniture">${t('tabFurniture')}</button>
      <button type="button" data-tab="light">${t('tabLight')}</button>
      <button type="button" data-tab="view">${t('tabView')}</button>
    </nav>

    <section id="planPanel" class="panel">
      <h2>${t('styleHeading')}</h2>
      <p class="description">${t('styleHint')}</p>
      <div id="styleList" class="style-list"></div>
      <p class="mini-heading">${t('paletteHeading')}</p>
      <div id="paletteRow" class="palette-row"></div>
      <p class="mini-heading">${t('rulesHeading')}</p>
      <ul id="styleRules" class="reasons"></ul>
      <div class="divider"></div>
      <p class="mini-heading">${t('planFacts')}</p>
      <div id="planFacts" class="facts"></div>
      <p class="mini-heading">${t('assumptionsHeading')}</p>
      <ul id="assumptionList" class="unknowns"></ul>
    </section>

    <section id="furniturePanel" class="panel" hidden>
      <h2>${t('productsHeading')}</h2>
      <p class="description" id="placeHint"></p>
      <div class="item-bar">
        <button type="button" id="undo">${t('placeUndo')}</button>
        <button type="button" id="redo">${t('placeRedo')}</button>
        <button type="button" id="rotate">${t('placeRotate')}</button>
        <button type="button" id="duplicate">${t('placeDuplicate')}</button>
      </div>
      <p class="mini-heading">${t('placedHeading')} <span id="itemCount">0</span> ${t('placedCount')}</p>
      <div id="productList" class="product-list"></div>
      <div class="divider"></div>
      <button type="button" class="secondary" id="exportJson">${t('placeExportJson')}</button>
      <button type="button" class="secondary" id="exportText">${t('placeExportText')}</button>
      <button type="button" class="secondary" id="clearItems">${t('placeClear')}</button>
    </section>

    <section id="lightPanel" class="panel" hidden>
      <h2>${t('tabLight')}</h2>
      <label class="control"><span>${t('lightDate')}</span><input id="date" type="date" value="${LIGHT_DEFAULTS.date}"></label>
      ${range('hour', t('lightHour'), 0, 23.75, LIGHT_DEFAULTS.hour, 0.25)}
      <div class="time-presets">
        ${[8, 12, 16, 20].map(h => `<button type="button" data-hour="${h}">${h}:00</button>`).join('')}
        <button type="button" id="timelapse">${t('lightTimelapse')}</button>
      </div>
      ${range('bearing', t('lightBearing'), 0, 359, LIGHT_DEFAULTS.bearing)}
      <p class="note" id="northNote"></p>
      ${range('cloud', t('lightCloud'), 0, 100, LIGHT_DEFAULTS.cloud * 100)}
      ${range('curtain', t('lightCurtain'), 0, 100, LIGHT_DEFAULTS.curtain * 100)}
      <label class="checkbox"><input id="sheer" type="checkbox" checked>${t('lightSheer')}</label>
      <div class="divider"></div>
      ${range('main', t('lightMain'), 0, 100, LIGHT_DEFAULTS.main)}
      ${range('task', t('lightTask'), 0, 100, LIGHT_DEFAULTS.task)}
      ${range('accent', t('lightAccent'), 0, 100, LIGHT_DEFAULTS.accent)}
      ${range('kelvin', t('lightKelvin'), 2700, 5000, LIGHT_DEFAULTS.kelvin, 100)}
      <button type="button" class="secondary" id="lightsOff">${t('lightOff')}</button>
      <p class="note" id="solarInfo"></p>
      <p class="note">${t('solarNote')}</p>
    </section>

    <section id="viewPanel" class="panel" hidden>
      <h2>${t('roomFocus')}</h2>
      <div id="roomList" class="room-nav"></div>
      <div class="divider"></div>
      <p class="mini-heading">${t('qualityHeading')}</p>
      <div class="seg" id="qualitySeg">
        <button type="button" data-quality="high" aria-pressed="false">${t('qualityHigh')}</button>
        <button type="button" data-quality="medium" aria-pressed="false">${t('qualityMedium')}</button>
        <button type="button" data-quality="low" aria-pressed="false">${t('qualityLow')}</button>
      </div>
      <p class="note">${t('qualityNote')}</p>
      <div class="divider"></div>
      <p class="mini-heading">${t('saveHeading')}</p>
      <button type="button" class="primary" id="saveCombo">${t('saveCombo')}</button>
      <button type="button" class="secondary" id="shareLink">${t('shareLink')}</button>
      <button type="button" class="secondary" id="exportProducts">${t('exportProducts')}</button>
      <div id="savedList"></div>
      <p class="note">${t('savedFull')}</p>
    </section>
  </aside>
</main>

<dialog id="modal">
  <div class="modal-head"><h2 id="modalTitle"></h2><button type="button" class="close" aria-label="${t('close')}">×</button></div>
  <div id="modalContent"></div>
</dialog>
<div class="toast" role="status"></div>`;

// ---------- helpers ----------
const isMobile = () => window.matchMedia('(max-width: 800px)').matches;

// Module-level timers live here rather than beside their functions: the boot sequence calls those
// functions top-down, and a `let` declared further down the file would still be in its temporal
// dead zone when the first call reaches it.
let toastTimer = null;
let hintTimer = null;
let persistTimer = null;
function toast(message) {
  const el = $('.toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function openModal(title, html) {
  $('#modalTitle').textContent = title;
  $('#modalContent').innerHTML = html;
  $('#modal').showModal();
}
$('#modal .close').onclick = () => $('#modal').close();

function setProgress(ratio, text) {
  const overlay = $('#loading');
  if (!overlay?.isConnected) return;
  $('#loadingFill').style.width = `${Math.round(ratio * 100)}%`;
  if (text) $('#loadingStatus').textContent = text;
  if (ratio >= 1) {
    overlay.classList.add('is-gone');
    setTimeout(() => overlay.remove(), 320);
  }
}

// ---------- overlays that the viewer's callbacks touch ----------
// These must exist before createViewer runs: the viewer fires onView during construction, and
// syncView reaches for the joystick.
let viewer = null;
const joystick = createJoystick($('.scene-panel'), (x, y) => viewer?.walkAnalog(x, y));
const fullscreen = createFullscreen($('.scene-panel'), active => {
  $('#fullscreen').classList.toggle('active', active);
  viewer?.resize();
});
$('#fullscreen').onclick = () => fullscreen.toggle(isMobile());

// ---------- boot ----------
let caseData = null;
let panel = null;
let timelapseTimer = null;

try {
  caseData = await loadCase();
} catch (error) {
  console.error(error);
  $('#viewport').innerHTML = `<div class="error-overlay">${t('caseLoadFailed')}<br><small>${error.message}</small></div>`;
  setProgress(1, '');
}

if (caseData) {
  $('#caseName').textContent = caseData.case?.displayName || t('appTitle');
  $('#caseMeta').textContent = [
    `${caseData.plan?.rooms?.length || 0} rooms`,
    `${caseData.style?.styles?.length || 0} styles`,
    `${(caseData.products || []).length} products`
  ].join(' · ');
  $('#stagePill').textContent = caseData.state?.stage || caseData.case?.stage || 'unknown';
  if (caseData.case?.locale) i18n.locale = caseData.case.locale;

  // Let the browser paint the shell once before the (main-thread) scene build starts.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0))));

  try {
    viewer = createViewer($('#viewport'), caseData, {
      labelRoot: $('#labels'),
      onProgress: (stage, ratio) => setProgress(ratio, stage === 'compile' ? t('loadingCompile') : stage === 'textures' ? t('loadingTextures') : ''),
      onRoomSelect: id => viewer?.focusRoom(id),
      onItems: detail => onItems(detail),
      onView: detail => syncView(detail),
      onLight: detail => syncLight(detail)
    });
  } catch (error) {
    console.error(error);
    $('#viewport').innerHTML = `<div class="error-overlay">${t('loadFailed')}</div>`;
    setProgress(1, '');
  }
}

if (viewer) {
  panel = createProductPanel($('#productList'), {
    onPlace: id => {
      if (isMobile()) {
        viewer.pickProduct(id);
        showHint(t('placeHintMobile'));
      } else if (!viewer.placeProduct(id)) {
        toast(t('placeRejected'));
      }
    },
    onFocus: id => viewer.focusItem(id)
  });
  panel.setProducts(viewer.setProducts(caseData.products || []));
  $('#placeHint').textContent = isMobile() ? t('placeHintMobile') : t('placeHintDesktop');

  buildStylePanel();
  buildPlanFacts();
  buildRoomList();
  wireToolbar();
  wireLightPanel();
  wireViewPanel();
  wireFurniturePanel();
  restoreState();
}

// ---------- panels ----------
function buildStylePanel() {
  const styles = caseData.style?.styles || [];
  $('#styleList').innerHTML = styles.map(style => `
    <button type="button" class="style-card" data-style="${style.id}">
      <strong>${style.name}</strong>
      <small>${style.summary || ''}</small>
    </button>`).join('');
  $('#styleList').onclick = event => {
    const id = event.target.closest('[data-style]')?.dataset.style;
    if (id) applyStyle(id);
  };
  if (styles[0]) applyStyle(viewer.getStyle()?.id || styles[0].id);
}

function applyStyle(id) {
  const style = viewer.setStyle(id);
  if (!style) return;
  document.querySelectorAll('[data-style]').forEach(el => el.classList.toggle('active', el.dataset.style === id));
  $('#paletteRow').innerHTML = (style.palette || []).map(entry => `
    <span class="swatch" title="${entry.name} · ${entry.role}"><i style="background:${entry.hex}"></i>${entry.name}</span>`).join('');
  $('#styleRules').innerHTML = (style.rules || []).map(rule => `<li>${rule}</li>`).join('');
  persist();
}

function buildPlanFacts() {
  const plan = caseData.plan || {};
  const source = plan.source || {};
  const rows = [
    ['units', plan.units || '—'],
    ['coordinateSystem', source.coordinateSystem || '—'],
    ['scaleStatus', source.scaleStatus || 'unknown'],
    ['northDeg', source.northDeg === null || source.northDeg === undefined ? 'unknown' : `${source.northDeg}°`],
    ['walls', String(plan.walls?.length || 0)],
    ['openings', String(plan.openings?.length || 0)],
    ['fixedElements', String(plan.fixedElements?.length || 0)],
    ['routes', String(plan.routes?.length || 0)]
  ];
  $('#planFacts').innerHTML = rows.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('');
  const assumptions = [
    ...(plan.assumptions || []).map(a => `<li><b>${a.status}</b> ${a.statement}</li>`),
    ...(caseData.state?.unknowns || []).map(u => `<li><b>unknown</b> ${u}</li>`)
  ];
  $('#assumptionList').innerHTML = assumptions.join('') || '<li>—</li>';
}

function buildRoomList() {
  const rooms = viewer.rooms();
  $('#roomList').innerHTML = [
    `<button type="button" class="room" data-room="all">${t('wholeHome')}</button>`,
    ...rooms.map(room => `<button type="button" class="room" data-room="${room.id}">${room.name}<small>${room.kind}</small></button>`)
  ].join('');
  $('#roomList').onclick = event => {
    const id = event.target.closest('[data-room]')?.dataset.room;
    if (!id) return;
    viewer.focusRoom(id);
    document.querySelectorAll('[data-room]').forEach(el => el.classList.toggle('active', el.dataset.room === id));
  };
}

// ---------- tabs ----------
document.querySelectorAll('[data-tab]').forEach(button => {
  button.onclick = () => {
    const tab = button.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach(el => el.classList.toggle('active', el === button));
    for (const name of ['plan', 'furniture', 'light', 'view']) {
      $(`#${name}Panel`).hidden = name !== tab;
    }
  };
});

// ---------- toolbar / views ----------
function showHint(text) {
  const el = $('#hint');
  el.textContent = text;
  el.hidden = !text;
  clearTimeout(hintTimer);
  if (text) hintTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

function syncView({view, focus}) {
  document.querySelectorAll('[data-view]').forEach(el => {
    const on = el.dataset.view === view;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', String(on));
  });
  document.querySelectorAll('[data-room]').forEach(el => el.classList.toggle('active', el.dataset.room === focus));
  $('#walkHUD').hidden = view !== 'walk';
  $('.scene-panel').classList.toggle('walking', view === 'walk');
  joystick.show(view === 'walk' && isMobile());
  $('#walkHint').textContent = isMobile() ? t('walkHintMobile') : t('walkHintDesktop');
  $('#status').textContent = view === 'walk' ? t('statusWalk') : t('statusConceptual');
  persist();
}

function wireToolbar() {
  document.querySelectorAll('[data-view]').forEach(button => {
    button.onclick = () => {
      if (button.dataset.view !== 'top' && $('#measure').getAttribute('aria-pressed') === 'true') setMeasure(false);
      viewer.setView(button.dataset.view);
    };
  });
  $('#resetView').onclick = () => { viewer.focusRoom('all'); viewer.setView('orbit'); };
  $('#wallToggle').onclick = () => {
    const mode = $('#wallToggle').getAttribute('aria-pressed') === 'true' ? 'cut' : 'full';
    viewer.setWallMode(mode);
    $('#wallToggle').setAttribute('aria-pressed', String(mode === 'full'));
    $('#wallToggle').classList.toggle('active', mode === 'full');
  };
  $('#labelToggle').onclick = () => {
    const on = $('#labelToggle').getAttribute('aria-pressed') !== 'true';
    viewer.setLabelsVisible(on);
    $('#labelToggle').setAttribute('aria-pressed', String(on));
    $('#labelToggle').classList.toggle('active', on);
  };
  $('#measure').onclick = () => setMeasure($('#measure').getAttribute('aria-pressed') !== 'true');
  $('#photo').onclick = () => {
    document.body.classList.add('photo-mode');
    requestAnimationFrame(() => {
      const png = viewer.capture(2);
      document.body.classList.remove('photo-mode');
      viewer.invalidate();
      const link = document.createElement('a');
      link.href = png;
      link.download = `${caseData.case?.caseId || 'case'}-${Date.now()}.png`;
      link.click();
    });
  };
  $('#walkExit').onclick = () => viewer.setView('inside');
  $('#walkRun').onpointerdown = () => viewer.walkRun(true);
  $('#walkRun').onpointerup = () => viewer.walkRun(false);
  $('#walkCrouch').onclick = () => viewer.walkCrouch($('#walkCrouch').classList.toggle('active'));
}

function setMeasure(on) {
  if (on) viewer.setView('top');
  viewer.setMeasure(on);
  $('#measure').setAttribute('aria-pressed', String(on));
  $('#measure').classList.toggle('active', on);
  showHint(on ? t('measureHint') : '');
}

// ---------- light panel ----------
function wireLightPanel() {
  const state = viewer.getLight();
  $('#northNote').textContent = state.northKnown ? t('lightNorthKnown') : t('lightNorthUnknown');
  const send = () => {
    stopTimelapse();
    viewer.setLight(readLightInputs());
  };
  for (const id of ['date', 'sheer']) $(`#${id}`).onchange = send;
  for (const id of ['hour', 'bearing', 'cloud', 'curtain', 'main', 'task', 'accent', 'kelvin']) {
    $(`#${id}`).oninput = () => {
      $(`#${id}Value`).textContent = $(`#${id}`).value;
      viewer.setLight(readLightInputs());
      if (id === 'hour') stopTimelapse();
    };
  }
  document.querySelectorAll('[data-hour]').forEach(button => {
    button.onclick = () => {
      $('#hour').value = button.dataset.hour;
      $('#hourValue').textContent = button.dataset.hour;
      send();
    };
  });
  $('#lightsOff').onclick = () => {
    for (const id of ['main', 'task', 'accent']) { $(`#${id}`).value = 0; $(`#${id}Value`).textContent = '0'; }
    send();
  };
  $('#timelapse').onclick = () => (timelapseTimer ? stopTimelapse() : startTimelapse());
}

function readLightInputs() {
  return {
    date: $('#date').value || LIGHT_DEFAULTS.date,
    hour: +$('#hour').value,
    bearing: +$('#bearing').value,
    cloud: +$('#cloud').value / 100,
    curtain: +$('#curtain').value / 100,
    sheer: $('#sheer').checked,
    main: +$('#main').value,
    task: +$('#task').value,
    accent: +$('#accent').value,
    kelvin: +$('#kelvin').value
  };
}

function startTimelapse() {
  // Roughly 12 s from 6:00 to 22:00; a reduced-motion preference gets discrete jumps instead.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hour = 6;
  $('#timelapse').classList.add('active');
  timelapseTimer = setInterval(() => {
    hour += reduced ? 4 : 0.25;
    if (hour > 22) { stopTimelapse(); return; }
    $('#hour').value = hour;
    $('#hourValue').textContent = hour.toFixed(2);
    viewer.setLight(readLightInputs());
  }, reduced ? 900 : 180);
}

function stopTimelapse() {
  clearInterval(timelapseTimer);
  timelapseTimer = null;
  $('#timelapse').classList.remove('active');
}

function syncLight(result) {
  const solar = result.solar || {};
  $('#solarInfo').textContent =
    `alt ${solar.altitudeDeg?.toFixed(1)}° · az ${solar.azimuthDeg?.toFixed(1)}° · ${result.night ? 'night' : 'day'}`;
  persist();
}

// ---------- view panel ----------
function wireViewPanel() {
  document.querySelectorAll('[data-quality]').forEach(button => {
    button.onclick = () => markQuality(viewer.setQuality(button.dataset.quality));
  });
  markQuality(viewer.getQuality());

  $('#saveCombo').onclick = () => {
    const saved = pushSaved(snapshot());
    renderSaved(saved);
    toast(`${t('saveCombo')} ✓`);
  };
  $('#shareLink').onclick = async () => {
    const url = `${location.origin}${location.pathname}#${viewer.encodeShare()}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t('shareCopied'));
    } catch {
      openModal(t('shareLink'), `<p>${t('shareManual')}</p><textarea readonly rows="4">${url}</textarea>`);
    }
  };
  $('#exportProducts').onclick = () => download(
    `${caseData.case?.caseId || 'case'}-products.json`,
    JSON.stringify(viewer.exportProducts(), null, 2),
    'application/json'
  );
  renderSaved(loadSaved());
}

function markQuality(level) {
  document.querySelectorAll('[data-quality]').forEach(el => {
    const on = el.dataset.quality === level;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', String(on));
  });
  persist();
}

function renderSaved(saved) {
  $('#savedList').innerHTML = saved.slice(0, MAX_SAVED).map((record, index) => `
    <button type="button" class="secondary" data-saved="${index}">
      ${t('saveSlot')} ${index + 1} · ${record.layout?.length || 0} items · ${(record.savedAt || '').slice(0, 10)}
    </button>`).join('');
  $('#savedList').onclick = event => {
    const index = event.target.closest('[data-saved]')?.dataset.saved;
    if (index === undefined) return;
    applySnapshot(loadSaved()[+index]);
  };
}

// ---------- furniture panel ----------
function wireFurniturePanel() {
  $('#undo').onclick = () => viewer.undo();
  $('#redo').onclick = () => viewer.redo();
  $('#rotate').onclick = () => viewer.rotateSelected(15);
  $('#duplicate').onclick = () => viewer.duplicateSelected();
  $('#clearItems').onclick = () => viewer.clearLayout();
  $('#exportJson').onclick = () => download(
    `${caseData.case?.caseId || 'case'}-layout.json`,
    JSON.stringify(viewer.exportProducts(), null, 2),
    'application/json'
  );
  $('#exportText').onclick = () => openModal(t('placeExportText'), `<pre>${viewer.exportText()}</pre>`);
}

function onItems(detail) {
  $('#itemCount').textContent = String(detail.items?.length ?? 0);
  panel?.setCounts(detail.items || []);
  if (detail.rejected) {
    toast(detail.rejected.reason === 'wet' ? t('placeWetArea') : t('placeRejected'));
  }
  if ('pending' in detail && !detail.pending) showHint('');
  persist();
}

// ---------- persistence ----------
function snapshot() {
  const light = viewer.getLight();
  return {
    style: viewer.getStyle()?.id || null,
    quality: viewer.getQuality(),
    view: viewer.getView().view,
    focus: viewer.getView().focus,
    layout: viewer.getLayout(),
    light: {
      date: light.date, hour: light.hour, bearing: light.bearing,
      cloud: light.cloud, curtain: light.curtain, sheer: light.sheer, kelvin: light.kelvin
    }
  };
}

function persist() {
  if (!viewer) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => saveCurrent(snapshot()), 250);
}

function applySnapshot(record) {
  if (!record) return;
  if (record.style) applyStyle(record.style);
  if (record.quality) markQuality(viewer.setQuality(record.quality));
  if (record.light) {
    for (const [id, value] of Object.entries({
      date: record.light.date, hour: record.light.hour, bearing: record.light.bearing,
      cloud: Math.round((record.light.cloud || 0) * 100), curtain: Math.round((record.light.curtain || 0) * 100),
      kelvin: record.light.kelvin
    })) {
      const el = $(`#${id}`);
      if (!el || value === undefined || value === null) continue;
      el.value = value;
      const output = $(`#${id}Value`);
      if (output) output.textContent = value;
    }
    $('#sheer').checked = record.light.sheer !== false;
    viewer.setLight(readLightInputs());
  }
  viewer.setLayout(record.layout || []);
  panel?.setCounts(record.layout || []);
  $('#itemCount').textContent = String(record.layout?.length || 0);
  if (record.view) viewer.setView(record.view, {focus: record.focus || 'all'});
}

function restoreState() {
  // A share hash always wins over browser storage: the link is what the sender meant to show.
  const shared = decodeState(location.hash);
  if (shared) {
    viewer.applyShare(location.hash);
    applySnapshot({
      style: shared.styleId, quality: shared.quality, view: shared.view,
      focus: shared.focus, layout: shared.layout, light: shared.light
    });
    toast('link');
    return;
  }
  const current = loadCurrent();
  if (current) applySnapshot(current);
}

function download(filename, text, type) {
  const blob = new Blob([text], {type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Exposed for the smoke test and for a host that drives the viewer programmatically.
window.idm = {
  get viewer() { return viewer; },
  get caseData() { return caseData; },
  encodeState, decodeState
};
