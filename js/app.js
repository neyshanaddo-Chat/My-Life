// App shell: navigation, theme, and drawing the current screen.
import * as db from './db.js';
import * as dashboard from './screens/dashboard.js';
import * as tasks from './screens/tasks.js';
import * as goals from './screens/goals.js';
import * as notes from './screens/notes.js';
import * as wellbeing from './screens/wellbeing.js';
import * as settings from './screens/settings.js';
import * as later from './screens/later.js';

// ---- Theme (Light / Dark), saved per device ----
function currentTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  document.getElementById('themeColor').setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#ffffff');
  try { localStorage.setItem('theme', theme); } catch (_) {}
}

// ---- Screens (must match the screen-<name> ids and menu links) ----
const RENDER = {
  home: (el) => dashboard.render(el),
  calendar: (el) => later.calendar(el),
  tasks: (el) => tasks.render(el),
  goals: (el) => goals.render(el),
  notes: (el) => notes.render(el),
  wellbeing: (el) => wellbeing.render(el),
  apps: (el) => later.apps(el),
  sync: (el) => later.sync(el),
  settings: (el) => settings.render(el, { applyTheme, currentTheme }),
  about: () => {},
};
const SCREENS = Object.keys(RENDER);

const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('backdrop');
const menuBtn = document.getElementById('menuBtn');
const wide = window.matchMedia('(min-width: 1024px)');

function setMenu(open) {
  if (wide.matches) open = false; // menu is always visible on wide screens
  sidebar.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  sidebar.setAttribute('aria-hidden', String(!open && !wide.matches));
  sidebar.inert = !open && !wide.matches;
}
menuBtn.addEventListener('click', () => setMenu(true));
document.getElementById('closeBtn').addEventListener('click', () => setMenu(false));
backdrop.addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
wide.addEventListener('change', () => setMenu(false));

let current = null;
function screenName() {
  const name = location.hash.slice(1);
  return SCREENS.includes(name) ? name : 'home';
}

async function draw() {
  const el = document.getElementById('screen-' + current);
  try { await RENDER[current](el); }
  catch (err) { console.error(err); el.textContent = 'Something went wrong drawing this screen: ' + err.message; }
}

function showScreen() {
  const name = screenName();
  const changed = name !== current;
  current = name;
  if (name === 'wellbeing' && changed) wellbeing.resetView();
  SCREENS.forEach((s) => document.getElementById('screen-' + s).classList.toggle('active', s === name));
  document.querySelectorAll('.nav-link').forEach((a) => {
    const on = a.dataset.screen === name;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  setMenu(false);
  if (changed) window.scrollTo(0, 0);
  draw();
}
window.addEventListener('hashchange', showScreen);
document.querySelectorAll('.nav-link').forEach((a) => a.addEventListener('click', () => setMenu(false)));

// Redraw the visible screen whenever data changes (debounced).
let pending = null;
db.onChange(() => {
  clearTimeout(pending);
  pending = setTimeout(() => { if (!document.getElementById('sheet').classList.contains('open')) draw(); }, 30);
});
// Redraw once a sheet closes, in case data changed while it was open.
new MutationObserver(() => { if (!document.getElementById('sheet').classList.contains('open')) draw(); })
  .observe(document.getElementById('sheet'), { attributes: true, attributeFilter: ['class'] });

// Redraw when returning to the app on a new day (dates like "Today" change).
let lastDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && new Date().toDateString() !== lastDay) { lastDay = new Date().toDateString(); draw(); }
});

// Ask the browser to keep this device's data even when storage is low.
navigator.storage?.persist?.().catch(() => {});

applyTheme(currentTheme());
showScreen();
