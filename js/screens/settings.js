import * as db from '../db.js';
import { h, mount, toast, today } from '../ui.js';
import { DEFAULT_HABITS } from './wellbeing.js';

export async function render(el, { applyTheme, currentTheme }) {
  const name = await db.getSetting('name', '');
  const habits = await db.getSetting('habits', DEFAULT_HABITS);
  const theme = currentTheme();

  const nameInput = h('input', { type: 'text', value: name, maxlength: 40, placeholder: 'Your first name', 'aria-label': 'Your name' });
  const habitsInput = h('textarea', { rows: 4, value: habits.join('\n'), 'aria-label': 'Habits to track' });
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const n = await db.importAll(JSON.parse(await f.text()));
      toast(`Imported ${n} record${n === 1 ? '' : 's'}`);
    } catch (err) { alert('Could not import: ' + err.message); }
    e.target.value = '';
  } });

  const seg = (v, label) => h('button', { type: 'button', class: 'seg' + (theme === v ? ' active' : ''), 'aria-pressed': String(theme === v),
    onclick: () => { applyTheme(v); render(el, { applyTheme, currentTheme }); } }, label);

  mount(el,
    h('div', { class: 'page-head' }, h('h2', {}, 'Settings')),
    h('section', { class: 'card settings-card' },
      h('h3', {}, 'Personal'),
      h('div', { class: 'setting-row' }, h('span', { class: 'setting-label' }, 'Your name'),
        h('form', { class: 'inline-add', onsubmit: async (e) => { e.preventDefault(); await db.setSetting('name', nameInput.value.trim()); toast('Saved'); } },
          nameInput, h('button', { class: 'btn btn-ghost small', type: 'submit' }, 'Save'))),
      h('div', { class: 'setting-row' },
        h('span', { class: 'setting-label' }, 'Appearance'),
        h('div', { class: 'segmented', role: 'group', 'aria-label': 'Appearance' }, seg('light', 'Light'), seg('dark', 'Dark')))),
    h('section', { class: 'card settings-card' },
      h('h3', {}, 'Wellbeing habits'),
      h('p', { class: 'muted small' }, 'One habit per line. These appear in your daily check-in.'),
      h('form', { class: 'form', onsubmit: async (e) => {
        e.preventDefault();
        const list = [...new Set(habitsInput.value.split('\n').map((s) => s.trim()).filter(Boolean))].slice(0, 20);
        await db.setSetting('habits', list.length ? list : DEFAULT_HABITS); toast('Habits saved');
      } }, habitsInput, h('div', { class: 'form-actions' }, h('span'), h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save habits')))),
    h('section', { class: 'card settings-card' },
      h('h3', {}, 'Your data'),
      h('p', { class: 'muted small' }, 'Everything is stored privately on this device. Download a backup regularly, and use it to move your data to another device.'),
      h('div', { class: 'btn-group wrap' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
          const blob = new Blob([JSON.stringify(await db.exportAll(), null, 2)], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `life-manager-backup-${today()}.json` });
          document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          toast('Backup downloaded');
        } }, 'Download backup'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => fileInput.click() }, 'Restore from backup'),
        fileInput),
      h('p', { class: 'muted small' }, 'Restoring merges with what is here: the newer version of each item wins.'),
      h('details', { class: 'danger-zone' }, h('summary', {}, 'Erase all data on this device'),
        h('p', { class: 'small' }, 'This permanently removes every task, goal, note and check-in from this device. Download a backup first.'),
        h('button', { class: 'btn btn-danger', type: 'button', onclick: async () => {
          if (prompt('Type ERASE to permanently delete all data on this device.') !== 'ERASE') return;
          await db.eraseAll(); toast('All data erased');
        } }, 'Erase everything'))));
}
