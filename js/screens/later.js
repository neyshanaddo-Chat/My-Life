// Sections planned for later stages. They show what is coming so the
// navigation is complete from day one. See docs/ROADMAP.md.
import { h, mount } from '../ui.js';

const APPS = [
  ['Calendar', 'Google / Outlook / CalDAV events in your calendar and dashboard', 'Stage 2–4'],
  ['Obsidian', 'Two-way sync between your notes and an Obsidian vault folder', 'Stage 4'],
  ['To-do app', 'Share tasks with your separate to-do app', 'Stage 4'],
  ['Clock app', 'Alarms, timers and routines linked to your schedule', 'Stage 4'],
  ['n8n', 'Automations triggered by your tasks, goals and check-ins', 'Stage 4'],
  ['AI-TOS', 'Your Hostinger AI agent — propose-only access by default', 'Stage 5'],
];

const RULES = [
  ['Automatic', 'Low-risk data that syncs straight away (e.g. a task created on another app).'],
  ['Needs my approval', 'Changes wait here until you approve or reject them.'],
  ['Restricted', 'Never shared — wellbeing and journal start here for every app and AI agent.'],
];

export function calendar(el) {
  mount(el,
    h('div', { class: 'page-head' }, h('h2', {}, 'Calendar')),
    h('section', { class: 'card coming' },
      h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, '▦'),
      h('h3', {}, 'Coming in Stage 2'),
      h('p', { class: 'muted' }, 'Day, week and month views, appointments, reminders and recurring events. Tasks with due dates already appear on your dashboard.'),
      h('a', { href: '#tasks', class: 'btn btn-ghost' }, 'Go to tasks')));
}

export function apps(el) {
  mount(el,
    h('div', { class: 'page-head' }, h('div', {}, h('h2', {}, 'Connected Apps'),
      h('p', { class: 'muted small' }, 'Apps in your Personal Operating System. Connections arrive once the Personal Data Hub is running (Stage 3).'))),
    h('div', { class: 'card list' },
      h('div', { class: 'row app-row' }, h('span', { class: 'app-dot on', 'aria-hidden': 'true' }),
        h('div', { class: 'row-main static' }, h('span', { class: 'row-title' }, 'Personal Life Manager'), h('span', { class: 'row-meta' }, h('span', {}, 'This app · data stored on this device'))),
        h('span', { class: 'pill pill-accent' }, 'Active')),
      APPS.map(([name, desc, stage]) => h('div', { class: 'row app-row' }, h('span', { class: 'app-dot', 'aria-hidden': 'true' }),
        h('div', { class: 'row-main static' }, h('span', { class: 'row-title' }, name), h('span', { class: 'row-meta' }, h('span', {}, desc))),
        h('span', { class: 'pill' }, stage)))));
}

export function sync(el) {
  mount(el,
    h('div', { class: 'page-head' }, h('div', {}, h('h2', {}, 'Sync & Verification'),
      h('p', { class: 'muted small' }, 'Where you will control what moves between your apps and AI agents.'))),
    h('section', { class: 'card' },
      h('h3', {}, 'How permissions will work'),
      h('p', { class: 'muted small' }, 'Each app or agent gets its own rules for each kind of data (tasks, goals, notes, wellbeing…): whether it can read it, and how its changes are handled:'),
      h('ul', { class: 'rules' }, RULES.map(([t, d]) => h('li', {}, h('strong', {}, t), h('span', { class: 'muted small' }, d)))),
      h('p', { class: 'muted small' }, 'These rules will be enforced by the Personal Data Hub itself, not just this screen, and every transfer will be recorded with its source, destination, requester, decision and outcome. AI agents start with propose-only access.')),
    h('section', { class: 'card coming' },
      h('h3', {}, 'Pending approvals'), h('p', { class: 'muted' }, 'Nothing to review — no apps are connected yet.')),
    h('section', { class: 'card coming' },
      h('h3', {}, 'Transfer history'), h('p', { class: 'muted' }, 'Transfers will be listed here. For now, changes on this device appear in Recent activity on the dashboard.')));
}
