import * as db from '../db.js';
import { h, mount, today, fmtDate, openSheet, field, toast, empty, timeAgo } from '../ui.js';

let query = '';
let type = '';

export const NOTE_TYPES = { note: 'Note', idea: 'Idea', journal: 'Journal', reflection: 'Reflection' };

export function editNote(n = {}, defaults = {}) {
  const isNew = !n.id;
  const v = { type: 'note', tags: [], ...defaults, ...n };
  openSheet(isNew ? 'New ' + NOTE_TYPES[v.type].toLowerCase() : 'Edit ' + NOTE_TYPES[v.type].toLowerCase(), (close) => {
    const kind = h('select', { value: v.type }, Object.entries(NOTE_TYPES).map(([k, l]) => h('option', { value: k }, l)));
    const title = h('input', { type: 'text', maxlength: 200, value: v.title || '', placeholder: 'Title' });
    const body = h('textarea', { rows: 10, class: 'note-body', value: v.body || '', placeholder: 'Write freely. Markdown works (# heading, - list, **bold**).' });
    const tags = h('input', { type: 'text', value: (v.tags || []).join(', '), placeholder: 'comma, separated, tags', maxlength: 200 });
    const pinned = h('input', { type: 'checkbox', checked: !!v.pinned });
    return h('form', { class: 'form', onsubmit: async (e) => {
      e.preventDefault();
      if (!title.value.trim() && !body.value.trim()) return body.focus();
      await db.save('notes', {
        ...(isNew ? {} : { id: v.id }),
        type: kind.value, title: title.value.trim(), body: body.value,
        tags: tags.value.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
        pinned: pinned.checked,
      }, { summary: title.value.trim() || NOTE_TYPES[kind.value] });
      close(); toast('Saved');
    } },
      h('div', { class: 'field-row' }, field('Type', kind), h('label', { class: 'field check-field' }, pinned, h('span', {}, 'Pin to top'))),
      field('Title', title), field('Text', body), field('Tags', tags),
      h('div', { class: 'form-actions' },
        !isNew ? h('button', { type: 'button', class: 'btn btn-danger-ghost', onclick: async () => {
          if (!confirm('Delete this note?')) return; await db.remove('notes', v.id); close(); toast('Note deleted');
        } }, 'Delete') : h('span'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save')));
  });
}

export function newJournal() {
  editNote({}, { type: 'journal', title: fmtDate(today(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) });
}

function excerpt(s, n = 140) {
  const t = (s || '').replace(/[#*_>`-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

export async function render(el) {
  const notes = await db.all('notes');
  const search = h('input', {
    type: 'search', class: 'search', placeholder: 'Search notes, journal, tags…', value: query, 'aria-label': 'Search notes',
    oninput: (e) => { query = e.target.value; renderList(); },
  });
  const listEl = h('div', { class: 'card-grid notes-grid' });

  function renderList() {
    const qq = query.toLowerCase();
    const items = notes
      .filter((n) => !type || n.type === type)
      .filter((n) => !qq || [n.title, n.body, ...(n.tags || [])].join(' ').toLowerCase().includes(qq))
      .sort((a, b) => (b.pinned - a.pinned) || b.updated_at.localeCompare(a.updated_at));
    mount(listEl, items.length ? items.map((n) => h('button', { type: 'button', class: 'card note-card', onclick: () => editNote(n) },
      h('div', { class: 'row-meta' }, h('span', { class: 'pill' + (n.type === 'journal' ? ' pill-accent' : '') }, NOTE_TYPES[n.type] || 'Note'),
        n.pinned ? h('span', {}, '📌') : null, h('span', {}, timeAgo(n.updated_at))),
      h('h3', {}, n.title || excerpt(n.body, 40) || 'Untitled'),
      n.body ? h('p', { class: 'muted small' }, excerpt(n.body)) : null,
      n.tags?.length ? h('div', { class: 'tags' }, n.tags.map((t) => h('span', { class: 'tag' }, '#' + t))) : null))
      : [empty('✎', notes.length ? 'No notes match.' : 'Capture notes, ideas, journal entries and reflections here.')]);
  }
  renderList();

  const chip = (k, l) => h('button', { type: 'button', class: 'chip' + (type === k ? ' active' : ''), 'aria-pressed': String(type === k),
    onclick: () => { type = k; render(el); } }, l);

  mount(el,
    h('div', { class: 'page-head' },
      h('div', {}, h('h2', {}, 'Notes & Journal'), h('p', { class: 'muted small' }, `${notes.length} entries`)),
      h('div', { class: 'btn-group' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: newJournal }, 'Journal entry'),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => editNote() }, '+ Note'))),
    search,
    h('div', { class: 'chips' }, chip('', 'All'), Object.entries(NOTE_TYPES).map(([k, l]) => chip(k, l + 's'))),
    listEl);
}
