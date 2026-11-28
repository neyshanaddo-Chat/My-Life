import * as db from '../db.js';
import { h, mount, today, addDays, fmtDate, toast, FACES, parseDate } from '../ui.js';

export const DEFAULT_HABITS = ['Exercise', 'Time outside', 'Reading', 'Connected with someone'];
const FEEL = ['Very low', 'Low', 'Okay', 'Good', 'Great'];
let viewDate = null;

export async function entryFor(date) {
  return (await db.all('wellbeing')).find((w) => w.date === date) || null;
}

/** Dashboard quick check-in: set today's happiness. */
export async function quickHappiness(value) {
  const e = await entryFor(today());
  await db.save('wellbeing', e ? { id: e.id, happiness: value } : { date: today(), happiness: value, habits: {} },
    { action: 'checked in', summary: `Feeling ${FEEL[value - 1].toLowerCase()}` });
  toast('Check-in saved');
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt1 = (n) => (n === null ? '–' : (Math.round(n * 10) / 10).toString());

/** Compare average happiness on days with vs without something. Needs enough days on both sides. */
function patterns(entries, habits) {
  const rated = entries.filter((e) => e.happiness);
  const tests = [
    ['exercised', (e) => (e.exercise_minutes || 0) > 0, (e) => e.exercise_minutes !== undefined && e.exercise_minutes !== null],
    ['slept 7+ hours', (e) => (e.sleep_hours || 0) >= 7, (e) => e.sleep_hours !== undefined && e.sleep_hours !== null && e.sleep_hours !== ''],
    ...habits.filter((n) => n.toLowerCase() !== 'exercise').map((name) => [`did “${name}”`, (e) => !!e.habits?.[name], () => true]),
  ];
  const out = [];
  for (const [label, yes, known] of tests) {
    const pool = rated.filter(known);
    const a = pool.filter(yes).map((e) => e.happiness);
    const b = pool.filter((e) => !yes(e)).map((e) => e.happiness);
    if (a.length >= 3 && b.length >= 3) {
      const diff = avg(a) - avg(b);
      if (Math.abs(diff) >= 0.3) out.push({ label, diff, a: avg(a), b: avg(b) });
    }
  }
  return out.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff)).slice(0, 4);
}

function chart(entries, days = 14) {
  const W = 320, H = 110, pad = 18, bw = (W - pad) / days;
  const byDate = Object.fromEntries(entries.map((e) => [e.date, e]));
  const bars = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today(), i - days + 1);
    const v = byDate[d]?.happiness || 0;
    const bh = (v / 5) * (H - 30);
    const x = pad + i * bw + 3;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    Object.entries({ x, y: H - 18 - (v ? bh : 2), width: bw - 6, height: v ? bh : 2, rx: 3, class: v ? 'bar' : 'bar-empty' })
      .forEach(([k, val]) => r.setAttribute(k, val));
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = `${fmtDate(d)}: ${v ? FEEL[v - 1] : 'no check-in'}`;
    r.append(t); g.append(r);
    if (i % 2 === (days - 1) % 2) {
      const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      Object.entries({ x: x + (bw - 6) / 2, y: H - 4, 'text-anchor': 'middle', class: 'axis' }).forEach(([k, val]) => lab.setAttribute(k, val));
      lab.textContent = parseDate(d).getDate();
      g.append(lab);
    }
    bars.push(g);
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Happiness over the last 14 days');
  for (const lvl of [1, 3, 5]) {
    const y = H - 18 - (lvl / 5) * (H - 30);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    Object.entries({ x1: pad, x2: W, y1: y, y2: y, class: 'grid' }).forEach(([k, v]) => ln.setAttribute(k, v));
    const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    Object.entries({ x: 0, y: y + 4, class: 'axis' }).forEach(([k, v]) => tx.setAttribute(k, v));
    tx.textContent = lvl;
    svg.append(ln, tx);
  }
  bars.forEach((b) => svg.append(b));
  return svg;
}

function scale(name, value, labels, faces) {
  const wrap = h('div', { class: 'scale', role: 'radiogroup', 'aria-label': name });
  [1, 2, 3, 4, 5].forEach((n) => wrap.append(h('button', {
    type: 'button', role: 'radio', 'aria-checked': String(value === n), class: 'scale-btn' + (value === n ? ' active' : ''),
    title: labels[n - 1], 'aria-label': labels[n - 1], dataset: { v: n },
    onclick: () => { wrap.querySelectorAll('.scale-btn').forEach((b) => { const on = +b.dataset.v === n; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); }); wrap.dataset.value = n; },
  }, faces ? faces[n - 1] : String(n))));
  if (value) wrap.dataset.value = value;
  return wrap;
}

export async function render(el) {
  const date = viewDate || today();
  const entries = (await db.all('wellbeing')).sort((a, b) => a.date.localeCompare(b.date));
  const e = entries.find((x) => x.date === date) || {};
  const habits = await db.getSetting('habits', DEFAULT_HABITS);

  const happy = scale('Happiness', e.happiness, FEEL, FACES);
  const energy = scale('Energy', e.energy, ['Exhausted', 'Tired', 'Okay', 'Energised', 'Full of energy']);
  const sleep = h('input', { type: 'number', min: 0, max: 24, step: 0.5, inputmode: 'decimal', value: e.sleep_hours ?? '', placeholder: 'hrs' });
  const exercise = h('input', { type: 'number', min: 0, max: 1440, step: 5, inputmode: 'numeric', value: e.exercise_minutes ?? '', placeholder: 'min' });
  const habitBoxes = habits.map((name) => h('label', { class: 'habit' }, h('input', { type: 'checkbox', checked: !!e.habits?.[name], dataset: { habit: name } }), h('span', {}, name)));
  const good = h('textarea', { rows: 2, value: e.good || '', placeholder: 'Something that went well or felt good' });
  const hard = h('textarea', { rows: 2, value: e.hard || '', placeholder: 'Something that was difficult or draining' });
  const reflection = h('textarea', { rows: 3, value: e.reflection || '', placeholder: 'Anything else on your mind?' });

  const num = (input) => (input.value === '' ? null : Number(input.value));
  const form = h('form', { class: 'card form checkin', onsubmit: async (ev) => {
    ev.preventDefault();
    const data = {
      date, happiness: happy.dataset.value ? +happy.dataset.value : null, energy: energy.dataset.value ? +energy.dataset.value : null,
      sleep_hours: num(sleep), exercise_minutes: num(exercise),
      habits: Object.fromEntries(habitBoxes.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => [i.dataset.habit, true])),
      good: good.value.trim(), hard: hard.value.trim(), reflection: reflection.value.trim(),
    };
    await db.save('wellbeing', e.id ? { id: e.id, ...data } : data,
      { action: e.id ? 'updated' : 'checked in', summary: `Wellbeing check-in · ${fmtDate(date)}` });
    toast('Check-in saved');
  } },
    h('div', { class: 'date-nav' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous day', onclick: () => { viewDate = addDays(date, -1); render(el); } }, '‹'),
      h('strong', {}, date === today() ? 'Today · ' + fmtDate(date) : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'short' })),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next day', disabled: date >= today(), onclick: () => { viewDate = addDays(date, 1); render(el); } }, '›')),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'How happy do you feel overall?'), happy),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Energy'), energy),
    h('div', { class: 'field-row' },
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Sleep last night (hours)'), sleep),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Exercise / recreation (minutes)'), exercise)),
    h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Habits'), h('div', { class: 'habits' }, habitBoxes),
      h('span', { class: 'field-hint' }, 'Change this list in Settings.')),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '🌤 A positive moment'), good),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, '🌧 A difficult moment'), hard),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Reflection'), reflection),
    h('div', { class: 'form-actions' }, h('span', { class: 'muted small' }, e.id ? 'Saved — edit any time' : ''),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save check-in')));

  // ---- Trends ----
  const last14 = entries.filter((x) => x.date > addDays(today(), -14));
  const last30 = entries.filter((x) => x.date > addDays(today(), -30));
  const pats = patterns(last30, habits);
  const habitCounts = habits.map((n) => [n, last14.filter((x) => x.habits?.[n]).length]);

  const trends = h('section', { class: 'card trends' },
    h('h3', {}, 'Last 14 days'),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('strong', {}, fmt1(avg(last14.map((x) => x.happiness).filter(Boolean)))), h('span', {}, 'avg happiness /5')),
      h('div', { class: 'stat' }, h('strong', {}, fmt1(avg(last14.map((x) => x.sleep_hours).filter((v) => v !== null && v !== undefined)))), h('span', {}, 'avg sleep (h)')),
      h('div', { class: 'stat' }, h('strong', {}, String(last14.reduce((s, x) => s + (x.exercise_minutes || 0), 0))), h('span', {}, 'min exercise'))),
    chart(entries),
    h('h4', {}, 'Habits'),
    h('ul', { class: 'habit-bars' }, habitCounts.map(([n, c]) => h('li', {},
      h('span', {}, n), h('span', { class: 'mini-bar' }, h('span', { style: { width: (c / 14) * 100 + '%' } })), h('span', { class: 'small muted' }, `${c}/14`)))),
    h('h4', {}, 'Patterns'),
    pats.length
      ? h('ul', { class: 'patterns' }, pats.map((p) => h('li', {},
        `On days you ${p.label}, happiness averaged `, h('strong', {}, fmt1(p.a)), ` vs `, h('strong', {}, fmt1(p.b)), ` on other days.`)))
      : h('p', { class: 'muted small' }, 'Patterns appear after a couple of weeks of check-ins — e.g. how sleep, exercise or habits line up with how you feel.'),
    pats.length ? h('p', { class: 'muted small' }, 'Based on your last 30 days. These are early patterns to notice, not proof of cause.') : null);

  mount(el,
    h('div', { class: 'page-head' }, h('div', {}, h('h2', {}, 'Happiness & Wellbeing'),
      h('p', { class: 'muted small' }, 'Notice what helps — not a score to chase.'))),
    h('div', { class: 'two-col' }, form, trends));
}

export function resetView() { viewDate = null; }
