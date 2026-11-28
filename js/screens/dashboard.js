import * as db from '../db.js';
import { h, mount, today, addDays, fmtDate, timeAgo, progress, FACES, isoDate } from '../ui.js';
const localDay = (iso) => isoDate(new Date(iso));
import { taskRow, sortTasks, editTask } from './tasks.js';
import { goalProgress, hundredDayStatus, ensureHundredDay, logHundredDay } from './goals.js';
import { quickHappiness, DEFAULT_HABITS } from './wellbeing.js';
import { newJournal } from './notes.js';

const ACTION_ICON = { created: '+', completed: '✓', deleted: '−', updated: '✎', 'checked in': '♥', achieved: '★', milestone: '◆', logged: '●', scheduled: '↻', reopened: '↺', started: '▶', imported: '⇩' };

function greeting(name) {
  const hr = new Date().getHours();
  const part = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}` : part;
}

function tile(title, body, link, linkLabel) {
  return h('section', { class: 'card tile' },
    h('div', { class: 'tile-head' }, h('h3', {}, title), link ? h('a', { href: '#' + link, class: 'tile-link' }, linkLabel || 'Open →') : null),
    body);
}

export async function render(el) {
  await ensureHundredDay();
  const [tasks, goals, wellbeing, notes, activity, name, habits] = await Promise.all([
    db.all('tasks'), db.all('goals'), db.all('wellbeing'), db.all('notes'), db.recentActivity(8),
    db.getSetting('name', ''), db.getSetting('habits', DEFAULT_HABITS),
  ]);
  const t0 = today();
  const open = tasks.filter((t) => !t.done).sort(sortTasks);
  const overdue = open.filter((t) => t.due && t.due < t0);
  const dueToday = open.filter((t) => t.due === t0);
  const upcoming = open.filter((t) => t.due && t.due > t0 && t.due <= addDays(t0, 7));
  const doneToday = tasks.filter((t) => t.done && t.completed_at && localDay(t.completed_at) === t0);
  const todayEntry = wellbeing.find((w) => w.date === t0);
  const activeGoals = goals.filter((g) => g.status !== 'achieved' && g.kind !== 'hundred_day');
  const hundred = goals.find((g) => g.kind === 'hundred_day');
  const hd = hundred ? hundredDayStatus(hundred) : null;
  const journalToday = notes.some((n) => n.type === 'journal' && localDay(n.created_at) === t0);

  // ---- Hero: today at a glance ----
  const hero = h('section', { class: 'hero' },
    h('div', {},
      h('p', { class: 'hero-date' }, fmtDate(t0, { weekday: 'long', day: 'numeric', month: 'long' })),
      h('h2', { class: 'hero-title' }, greeting(name))),
    h('div', { class: 'hero-stats' },
      h('a', { href: '#tasks', class: 'hero-stat' }, h('strong', {}, String(dueToday.length + overdue.length)), h('span', {}, 'due today')),
      h('a', { href: '#tasks', class: 'hero-stat' }, h('strong', {}, String(doneToday.length)), h('span', {}, 'done today')),
      hd?.started ? h('a', { href: '#goals', class: 'hero-stat' }, h('strong', {}, String(hd.day)), h('span', {}, 'of 100 days')) : null));

  // ---- Check-in ----
  const checkin = tile('How are you feeling?',
    h('div', {},
      h('div', { class: 'scale big' }, [1, 2, 3, 4, 5].map((n) => h('button', {
        type: 'button', class: 'scale-btn' + (todayEntry?.happiness === n ? ' active' : ''), 'aria-label': `Happiness ${n} of 5`,
        'aria-pressed': String(todayEntry?.happiness === n), onclick: () => quickHappiness(n),
      }, FACES[n - 1]))),
      todayEntry
        ? h('p', { class: 'muted small' }, [
          todayEntry.sleep_hours != null ? `Slept ${todayEntry.sleep_hours}h` : null,
          todayEntry.exercise_minutes ? `${todayEntry.exercise_minutes} min exercise` : null,
          `${habits.filter((x) => todayEntry.habits?.[x]).length}/${habits.length} habits`,
        ].filter(Boolean).join(' · '))
        : h('p', { class: 'muted small' }, 'Tap a face for a quick check-in.')),
    'wellbeing', 'Check-in →');

  // ---- Tasks ----
  const focus = [...overdue, ...dueToday];
  const taskTile = tile('Today\'s tasks',
    h('div', {},
      focus.length ? h('div', { class: 'list' }, focus.slice(0, 6).map(taskRow))
        : h('p', { class: 'muted small' }, open.length ? 'Nothing due today. ' + open.length + ' open task' + (open.length === 1 ? '' : 's') + ' in total.' : 'No open tasks.'),
      focus.length > 6 ? h('a', { href: '#tasks', class: 'small' }, `+${focus.length - 6} more`) : null,
      h('button', { type: 'button', class: 'btn btn-ghost small add-inline', onclick: () => editTask({}, { due: t0 }) }, '+ Add task for today')),
    'tasks', 'All tasks →');

  // ---- Upcoming ----
  const upTile = tile('Coming up this week',
    upcoming.length
      ? h('ul', { class: 'agenda' }, upcoming.slice(0, 6).map((t) => h('li', {},
        h('span', { class: 'agenda-date' }, fmtDate(t.due, { weekday: 'short', day: 'numeric' })), h('span', {}, t.title))))
      : h('p', { class: 'muted small' }, 'Nothing scheduled in the next 7 days. Calendar events arrive in Stage 2.'),
    'tasks');

  // ---- Goals ----
  const goalTile = tile('Goal progress',
    h('div', { class: 'goal-mini-list' },
      hundred ? h('div', { class: 'goal-mini' },
        h('div', { class: 'goal-mini-head' }, h('span', {}, hundred.title),
          hd.started ? h('span', { class: 'small muted' }, `${hd.done}/100`) : null),
        hd.started ? progress(hd.done / 100, hundred.title) : null,
        hd.started && !hd.finished
          ? h('button', { type: 'button', class: 'btn small ' + (hd.loggedToday ? 'btn-ghost' : 'btn-primary'), onclick: () => logHundredDay(hundred) },
            hd.loggedToday ? '✓ Day ' + hd.day + ' logged' : 'Log day ' + hd.day)
          : !hd.started ? h('a', { href: '#goals', class: 'small' }, 'Set your start date →') : null) : null,
      activeGoals.slice(0, 4).map((g) => h('div', { class: 'goal-mini' },
        h('div', { class: 'goal-mini-head' }, h('span', {}, g.title), h('span', { class: 'small muted' }, Math.round(goalProgress(g) * 100) + '%')),
        progress(goalProgress(g), g.title))),
      !activeGoals.length ? h('a', { href: '#goals', class: 'small' }, '+ Add a goal') : null),
    'goals');

  // ---- Activity ----
  const actTile = tile('Recent activity',
    activity.length
      ? h('ul', { class: 'activity' }, activity.map((a) => h('li', {},
        h('span', { class: 'act-icon', 'aria-hidden': 'true' }, ACTION_ICON[a.action] || '•'),
        h('span', { class: 'act-text' }, capital(a.action) + (a.summary ? ': ' + a.summary : '')),
        h('span', { class: 'small muted' }, timeAgo(a.at)))))
      : h('p', { class: 'muted small' }, 'Your changes will show here.'));

  // ---- Quick access ----
  const quick = h('section', { class: 'quick' },
    [['#tasks', '☐', 'Tasks'], ['#calendar', '▦', 'Calendar'], ['#goals', '◎', 'Goals'], ['#notes', '✎', 'Notes'], ['#wellbeing', '♥', 'Wellbeing'], ['#apps', '⧉', 'Apps']]
      .map(([href, icon, label]) => h('a', { href, class: 'quick-link' }, h('span', { class: 'quick-icon', 'aria-hidden': 'true' }, icon), h('span', {}, label))));

  const reminders = [];
  if (overdue.length) reminders.push(h('a', { href: '#tasks', class: 'reminder warn' }, `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`));
  if (!todayEntry) reminders.push(h('a', { href: '#wellbeing', class: 'reminder' }, 'Today\'s wellbeing check-in'));
  if (hd?.started && !hd.finished && !hd.loggedToday) reminders.push(h('button', { type: 'button', class: 'reminder', onclick: () => logHundredDay(hundred) }, `Log day ${hd.day} of your AI Skills Project`));
  if (!journalToday && new Date().getHours() >= 17) reminders.push(h('button', { type: 'button', class: 'reminder', onclick: newJournal }, 'Write today\'s journal'));

  mount(el,
    hero,
    reminders.length ? h('div', { class: 'reminders', 'aria-label': 'Reminders' }, reminders) : null,
    h('div', { class: 'dash-grid' }, checkin, taskTile, goalTile, upTile, actTile),
    quick);
}

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
