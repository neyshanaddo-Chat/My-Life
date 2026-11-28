import * as db from '../db.js';
import { h, mount, today, addDays, daysBetween, fmtDate, openSheet, field, toast, empty, progress } from '../ui.js';

let showAchieved = false;

export function goalProgress(g) {
  if (g.kind === 'hundred_day') {
    const done = Object.values(g.days || {}).filter((d) => d.done).length;
    return done / 100;
  }
  if (g.status === 'achieved') return 1;
  const ms = g.milestones || [];
  return ms.length ? ms.filter((m) => m.done).length / ms.length : 0;
}

export function hundredDayStatus(g) {
  if (!g.start_date) return { started: false };
  const day = daysBetween(g.start_date, today()) + 1;
  const done = Object.values(g.days || {}).filter((d) => d.done).length;
  let streak = 0;
  for (let d = today(); g.days?.[d]?.done; d = addDays(d, -1)) streak++;
  if (!streak) for (let d = addDays(today(), -1); g.days?.[d]?.done; d = addDays(d, -1)) streak++;
  return { started: day >= 1, day: Math.min(Math.max(day, 0), 100), done, streak, loggedToday: !!g.days?.[today()]?.done, finished: day > 100 };
}

/** Make sure the 100-Day AI Skills Project exists (created once). */
export async function ensureHundredDay() {
  if (await db.getSetting('seeded-hundred-day')) return;
  await db.save('goals', {
    title: '100-Day AI Skills Project', kind: 'hundred_day', horizon: 'short', area: 'Learning',
    why: 'Build real AI skills by doing something every day for 100 days.',
    start_date: null, days: {}, milestones: [], status: 'active',
  }, { silent: true });
  await db.setSetting('seeded-hundred-day', true);
}

export function logHundredDay(g, date = today()) {
  const entry = g.days?.[date] || {};
  const n = g.start_date ? daysBetween(g.start_date, date) + 1 : null;
  openSheet(n ? `Day ${n} · ${fmtDate(date)}` : fmtDate(date), (close) => {
    const note = h('textarea', { rows: 4, value: entry.note || '', placeholder: 'What did you learn, build or practise?' });
    return h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      const days = { ...(g.days || {}), [date]: { done: true, note: note.value.trim() } };
      await db.save('goals', { id: g.id, days }, { action: 'logged', summary: `${g.title} — day ${n ?? ''}`.trim() });
      close(); toast(`Day ${n ?? ''} logged`.replace('  ', ' '));
    } },
      field('Today\'s progress', note),
      h('div', { class: 'form-actions' },
        entry.done ? h('button', { type: 'button', class: 'btn btn-danger-ghost', onclick: async () => {
          const days = { ...(g.days || {}) }; delete days[date];
          await db.save('goals', { id: g.id, days }, { action: 'updated', summary: `${g.title} — cleared day ${n}` });
          close();
        } }, 'Clear day') : h('span'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, entry.done ? 'Save' : 'Mark day done')));
  });
}

function setStart(g) {
  openSheet('Start the 100 days', (close) => {
    const start = h('input', { type: 'date', value: g.start_date || today(), max: today() });
    return h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      await db.save('goals', { id: g.id, start_date: start.value, target_date: addDays(start.value, 99) }, { action: 'started', summary: g.title });
      close(); toast('100-day project started');
    } },
      field('Day 1 is', start, 'You can pick a past date if you have already begun.'),
      h('div', { class: 'form-actions' }, h('span'), h('button', { type: 'submit', class: 'btn btn-primary' }, 'Start')));
  });
}

function hundredDayCard(g) {
  const s = hundredDayStatus(g);
  if (!s.started) {
    return h('article', { class: 'card goal-card hero-card' },
      h('div', { class: 'goal-head' }, h('h3', {}, g.title), h('span', { class: 'pill' }, '100 days')),
      g.why ? h('p', { class: 'muted' }, g.why) : null,
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => setStart(g) }, 'Set start date'));
  }
  const cells = [];
  for (let i = 0; i < 100; i++) {
    const date = addDays(g.start_date, i);
    const isDone = g.days?.[date]?.done;
    const cls = isDone ? 'done' : date === today() ? 'today' : date < today() ? 'missed' : '';
    cells.push(h('button', {
      type: 'button', class: 'hd-cell ' + cls, title: `Day ${i + 1} · ${fmtDate(date)}${isDone ? ' ✓' : ''}`,
      'aria-label': `Day ${i + 1}${isDone ? ', done' : ''}`, disabled: date > today(),
      onclick: () => logHundredDay(g, date),
    }));
  }
  return h('article', { class: 'card goal-card hero-card' },
    h('div', { class: 'goal-head' }, h('h3', {}, g.title),
      h('button', { class: 'icon-btn small', type: 'button', 'aria-label': 'Edit start date', title: 'Edit start date', onclick: () => setStart(g) }, '✎')),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('strong', {}, s.finished ? '100' : String(s.day)), h('span', {}, s.finished ? 'days complete' : 'today is day')),
      h('div', { class: 'stat' }, h('strong', {}, String(s.done)), h('span', {}, 'days logged')),
      h('div', { class: 'stat' }, h('strong', {}, String(s.streak)), h('span', {}, 'day streak'))),
    h('div', { class: 'hd-grid' }, cells),
    !s.finished ? h('button', { class: 'btn ' + (s.loggedToday ? 'btn-ghost' : 'btn-primary'), type: 'button', onclick: () => logHundredDay(g) },
      s.loggedToday ? '✓ Today logged — edit' : 'Log today') : null);
}

function standardCard(g) {
  const ms = g.milestones || [];
  const p = goalProgress(g);
  const toggleMs = async (m) => {
    const milestones = ms.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x));
    await db.save('goals', { id: g.id, milestones }, { action: m.done ? 'updated' : 'milestone', summary: `${g.title}: ${m.title}` });
  };
  const addInput = h('input', { type: 'text', placeholder: 'Add a milestone…', maxlength: 120, 'aria-label': 'New milestone' });
  return h('article', { class: 'card goal-card' + (g.status === 'achieved' ? ' achieved' : '') },
    h('div', { class: 'goal-head' },
      h('div', {}, h('h3', {}, g.title),
        h('div', { class: 'row-meta' },
          h('span', { class: 'pill' }, g.horizon === 'short' ? 'Short-term' : 'Long-term'),
          g.area ? h('span', {}, g.area) : null,
          g.target_date ? h('span', {}, 'by ' + fmtDate(g.target_date, { day: 'numeric', month: 'short', year: 'numeric' })) : null,
          g.status === 'achieved' && g.achieved_at ? h('span', {}, '★ Achieved ' + new Date(g.achieved_at).toLocaleDateString()) : null)),
      h('button', { class: 'icon-btn small', type: 'button', 'aria-label': 'Edit goal', title: 'Edit goal', onclick: () => editGoal(g) }, '✎')),
    g.why ? h('p', { class: 'muted small' }, g.why) : null,
    h('div', { class: 'progress-row' }, progress(p, g.title), h('span', { class: 'small' }, Math.round(p * 100) + '%')),
    ms.length ? h('ul', { class: 'milestones' }, ms.map((m) => h('li', {},
      h('label', {}, h('input', { type: 'checkbox', checked: !!m.done, onchange: () => toggleMs(m) }), h('span', {}, m.title))))) : null,
    g.status !== 'achieved' ? h('form', { class: 'inline-add', onsubmit: async (e) => {
      e.preventDefault();
      const v = addInput.value.trim(); if (!v) return;
      await db.save('goals', { id: g.id, milestones: [...ms, { id: db.uuid(), title: v, done: false }] }, { action: 'updated', summary: `${g.title}: added milestone` });
    } }, addInput, h('button', { class: 'btn btn-ghost small', type: 'submit' }, 'Add')) : null);
}

export function editGoal(g = {}) {
  const isNew = !g.id;
  openSheet(isNew ? 'New goal' : 'Edit goal', (close) => {
    const title = h('input', { type: 'text', required: true, maxlength: 150, value: g.title || '', placeholder: 'What do you want to achieve?' });
    const why = h('textarea', { rows: 2, value: g.why || '', placeholder: 'Why it matters to you (optional)' });
    const horizon = h('select', { value: g.horizon || 'long' }, h('option', { value: 'long' }, 'Long-term'), h('option', { value: 'short' }, 'Short-term'));
    const area = h('input', { type: 'text', value: g.area || '', placeholder: 'e.g. Health, Career', maxlength: 60 });
    const target = h('input', { type: 'date', value: g.target_date || '' });
    return h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      if (!title.value.trim()) return title.focus();
      await db.save('goals', {
        ...(isNew ? { kind: 'standard', milestones: [], status: 'active' } : { id: g.id }),
        title: title.value.trim(), why: why.value.trim(), horizon: horizon.value, area: area.value.trim() || null, target_date: target.value || null,
      });
      close(); toast(isNew ? 'Goal added' : 'Goal saved');
    } },
      field('Goal', title), field('Why', why),
      h('div', { class: 'field-row' }, field('Type', horizon), field('Target date', target)),
      field('Life area', area),
      h('div', { class: 'form-actions' },
        !isNew ? h('div', { class: 'btn-group' },
          h('button', { type: 'button', class: 'btn btn-danger-ghost', onclick: async () => {
            if (!confirm('Delete this goal?')) return; await db.remove('goals', g.id); close(); toast('Goal deleted');
          } }, 'Delete'),
          h('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
            const achieved = g.status !== 'achieved';
            await db.save('goals', { id: g.id, status: achieved ? 'achieved' : 'active', achieved_at: achieved ? new Date().toISOString() : null },
              { action: achieved ? 'achieved' : 'reopened', summary: g.title });
            close(); if (achieved) toast('★ Goal achieved — well done');
          } }, g.status === 'achieved' ? 'Reopen' : '★ Mark achieved')) : h('span'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, isNew ? 'Add goal' : 'Save')));
  });
}

export async function render(el) {
  await ensureHundredDay();
  const goals = await db.all('goals');
  const hundred = goals.filter((g) => g.kind === 'hundred_day');
  const standard = goals.filter((g) => g.kind !== 'hundred_day');
  const active = standard.filter((g) => g.status !== 'achieved');
  const achieved = standard.filter((g) => g.status === 'achieved').sort((a, b) => (b.achieved_at || '').localeCompare(a.achieved_at || ''));
  const byHorizon = (hz) => active.filter((g) => (g.horizon || 'long') === hz);

  const section = (title, list) => list.length ? h('div', { class: 'group' },
    h('h3', { class: 'group-title' }, title, h('span', { class: 'count' }, list.length)),
    h('div', { class: 'card-grid' }, list.map(standardCard))) : null;

  mount(el,
    h('div', { class: 'page-head' },
      h('div', {}, h('h2', {}, 'Goals & Projects'), h('p', { class: 'muted small' }, `${active.length} active · ${achieved.length} achieved`)),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => editGoal() }, '+ Add goal')),
    hundred.map(hundredDayCard),
    section('Short-term objectives', byHorizon('short')),
    section('Long-term goals', byHorizon('long')),
    !active.length ? empty('◎', 'Add a goal and break it into milestones to track progress.') : null,
    achieved.length ? h('div', { class: 'group' },
      h('button', { class: 'linkish', type: 'button', onclick: () => { showAchieved = !showAchieved; render(el); } },
        (showAchieved ? '▾ ' : '▸ ') + `Achievements (${achieved.length})`),
      showAchieved ? h('div', { class: 'card-grid' }, achieved.map(standardCard)) : null) : null);
}
