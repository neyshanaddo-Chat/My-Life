import * as db from '../db.js';
import { h, mount, isoDate, today, addDays, addMonths, dueLabel, daysBetween, openSheet, field, toast, empty, timeAgo } from '../ui.js';

let filter = 'open'; // open | today | completed
let category = '';

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };
const RECUR_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export function sortTasks(a, b) {
  const ad = a.due || '9999', bd = b.due || '9999';
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
}

function nextDue(task) {
  const base = task.due && task.due >= today() ? task.due : today();
  if (task.recur === 'daily') return addDays(base, 1);
  if (task.recur === 'weekly') return addDays(base, 7);
  if (task.recur === 'monthly') return addMonths(base, 1);
  return null;
}

export async function toggleTask(task) {
  if (task.done) {
    await db.save('tasks', { id: task.id, done: false, completed_at: null }, { action: 'reopened', summary: task.title });
    return;
  }
  await db.save('tasks', { id: task.id, done: true, completed_at: new Date().toISOString() }, { action: 'completed', summary: task.title });
  if (task.recur && task.recur !== 'none') {
    const { id, created_at, updated_at, rev, completed_at, done, ...rest } = task;
    const due = nextDue(task);
    await db.save('tasks', { ...rest, done: false, completed_at: null, due }, { action: 'scheduled', summary: `${task.title} (next: ${dueLabel(due)})` });
    toast(`Done — next one ${dueLabel(due).toLowerCase()}`);
  } else toast('Task completed');
}

/** One task row (also used on the Dashboard). */
export function taskRow(task) {
  const overdue = !task.done && task.due && task.due < today();
  return h('div', { class: 'row task-row' + (task.done ? ' is-done' : '') },
    h('button', {
      class: 'check' + (task.done ? ' checked' : ''), type: 'button',
      'aria-label': task.done ? 'Mark not done' : 'Mark done', 'aria-pressed': String(!!task.done),
      onclick: () => toggleTask(task),
    }),
    h('button', { class: 'row-main', type: 'button', onclick: () => editTask(task) },
      h('span', { class: 'row-title' }, task.title),
      h('span', { class: 'row-meta' },
        task.priority === 'high' ? h('span', { class: 'pill pill-accent' }, 'High') : null,
        task.done && task.completed_at ? h('span', {}, 'Done ' + timeAgo(task.completed_at))
          : task.due ? h('span', { class: overdue ? 'overdue' : '' }, dueLabel(task.due)) : null,
        task.category ? h('span', {}, task.category) : null,
        task.recur && task.recur !== 'none' ? h('span', { title: 'Repeats' }, '↻ ' + RECUR_LABEL[task.recur]) : null)));
}

export async function editTask(task = {}, defaults = {}) {
  const isNew = !task.id;
  const goals = (await db.all('goals')).filter((g) => g.status !== 'achieved');
  const cats = [...new Set((await db.all('tasks')).map((t) => t.category).filter(Boolean))].sort();
  const t = { priority: 'normal', recur: 'none', ...defaults, ...task };

  openSheet(isNew ? 'New task' : 'Edit task', (close) => {
    const title = h('input', { type: 'text', required: true, maxlength: 200, value: t.title || '', placeholder: 'What needs doing?' });
    const due = h('input', { type: 'date', value: t.due || '' });
    const priority = h('select', { value: t.priority },
      h('option', { value: 'low' }, 'Low'), h('option', { value: 'normal' }, 'Normal'), h('option', { value: 'high' }, 'High'));
    const recur = h('select', { value: t.recur || 'none' },
      h('option', { value: 'none' }, 'Does not repeat'), h('option', { value: 'daily' }, 'Every day'),
      h('option', { value: 'weekly' }, 'Every week'), h('option', { value: 'monthly' }, 'Every month'));
    const cat = h('input', { type: 'text', value: t.category || '', list: 'cat-list', placeholder: 'e.g. Home, Work, Study', maxlength: 60 });
    const goal = h('select', { value: t.goal_id || '' }, h('option', { value: '' }, 'None'),
      goals.map((g) => h('option', { value: g.id }, g.title)));
    const notes = h('textarea', { rows: 3, value: t.notes || '', placeholder: 'Details (optional)' });

    const quick = h('div', { class: 'chips' },
      [['Today', 0], ['Tomorrow', 1], ['Next week', 7]].map(([l, n]) =>
        h('button', { type: 'button', class: 'chip', onclick: () => { due.value = addDays(today(), n); } }, l)),
      h('button', { type: 'button', class: 'chip', onclick: () => { due.value = ''; } }, 'No date'));

    const form = h('form', {
      class: 'form',
      onsubmit: async (e) => {
        e.preventDefault();
        if (!title.value.trim()) return title.focus();
        await db.save('tasks', {
          ...(isNew ? { done: false } : { id: t.id }),
          title: title.value.trim(), due: due.value || null, priority: priority.value, recur: recur.value,
          category: cat.value.trim() || null, goal_id: goal.value || null, notes: notes.value.trim(),
        });
        close();
        toast(isNew ? 'Task added' : 'Task saved');
      },
    },
      field('Task', title),
      field('Due', h('div', {}, due, quick)),
      h('div', { class: 'field-row' }, field('Priority', priority), field('Repeats', recur)),
      field('Category', h('div', {}, cat, h('datalist', { id: 'cat-list' }, cats.map((c) => h('option', { value: c }))))),
      goals.length ? field('Linked goal', goal) : null,
      field('Notes', notes),
      h('div', { class: 'form-actions' },
        !isNew ? h('button', { type: 'button', class: 'btn btn-danger-ghost', onclick: async () => {
          if (!confirm('Delete this task?')) return;
          await db.remove('tasks', t.id); close(); toast('Task deleted');
        } }, 'Delete') : h('span'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, isNew ? 'Add task' : 'Save')));
    return form;
  });
}

export async function render(el) {
  const tasks = await db.all('tasks');
  const cats = [...new Set(tasks.map((t) => t.category).filter(Boolean))].sort();
  if (category && !cats.includes(category)) category = '';

  let list = tasks.filter((t) => !category || t.category === category);
  const t0 = today();
  if (filter === 'completed') list = list.filter((t) => t.done).sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  else if (filter === 'today') list = list.filter((t) => !t.done && t.due && t.due <= t0).sort(sortTasks);
  else list = list.filter((t) => !t.done).sort(sortTasks);

  const doneThisWeek = tasks.filter((t) => t.done && t.completed_at && daysBetween(isoDate(new Date(t.completed_at)), t0) < 7).length;

  const tab = (id, label) => h('button', {
    type: 'button', class: 'seg' + (filter === id ? ' active' : ''), 'aria-pressed': String(filter === id),
    onclick: () => { filter = id; render(el); },
  }, label);

  let body;
  if (!list.length) {
    body = filter === 'completed' ? empty('✓', 'Nothing completed yet. Finished tasks are kept here as your history.')
      : empty('☐', filter === 'today' ? 'Nothing due today.' : 'No open tasks. Enjoy it, or add one.',
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => editTask() }, '+ Add task'));
  } else if (filter === 'open') {
    const groups = [
      ['Overdue', list.filter((t) => t.due && t.due < t0)],
      ['Today', list.filter((t) => t.due === t0)],
      ['Upcoming', list.filter((t) => t.due && t.due > t0)],
      ['Anytime', list.filter((t) => !t.due)],
    ].filter(([, g]) => g.length);
    body = groups.map(([name, g]) => h('div', { class: 'group' },
      h('h3', { class: 'group-title' + (name === 'Overdue' ? ' overdue' : '') }, name, h('span', { class: 'count' }, g.length)),
      h('div', { class: 'card list' }, g.map(taskRow))));
  } else {
    body = h('div', { class: 'card list' }, list.map(taskRow));
  }

  mount(el,
    h('div', { class: 'page-head' },
      h('div', {}, h('h2', {}, 'Tasks'), h('p', { class: 'muted small' }, `${doneThisWeek} completed in the last 7 days`)),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => editTask() }, '+ Add task')),
    h('div', { class: 'toolbar' },
      h('div', { class: 'segmented' }, tab('open', 'Open'), tab('today', 'Due today'), tab('completed', 'Completed')),
      cats.length ? h('select', { class: 'select-sm', 'aria-label': 'Category', value: category, onchange: (e) => { category = e.target.value; render(el); } },
        h('option', { value: '' }, 'All categories'), cats.map((c) => h('option', { value: c }, c))) : null),
    body);
}
