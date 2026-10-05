import { esc } from './projects.js';
import { SOCIALS } from '../data/socials.js';

export function avatarSrc(key) {
  return key ? `/avatars/${key.replace(/^avatars\//, '')}` : '';
}

export const VORSTAND_STATIC = [
  { slot: 'obmann', name: 'Sebastian Krumböck', title: 'Obmann' },
  { slot: 'obmann-stellvertreterin', name: 'Maja Höllerer', title: 'Obmann Stellvertreterin' },
  { slot: 'kassier', name: 'Klemens Ruhrhofer', title: 'Kassier' },
  { slot: 'kassier-stellvertreter', name: 'Lucia Mickova', title: 'Kassier Stellvertreter' },
  { slot: 'schriftfuehrer', name: 'Simon Kranawetter', title: 'Schriftführer' },
  { slot: 'schriftfuehrer-stellvertreter', name: 'Alexander Ebner', title: 'Schriftführer Stellvertreter' },
];

function staticSlotCard(s, users, { isAdmin, onLink }) {
  const card = document.createElement('article');
  card.setAttribute('data-slot', s.slot);
  card.className = 'border border-paper/15 p-5';
  const options = users.map((u) => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
  card.innerHTML = `
    <div class="h-24 w-24 rounded-full bg-ink-soft"></div>
    <h3 class="mt-3 font-display text-xl uppercase">${esc(s.name)}</h3>
    <p class="text-amber text-sm uppercase">${esc(s.title)}</p>
    ${isAdmin ? `<label class="mt-3 block text-xs uppercase text-paper/60">Link to member account
      <span class="mt-1 flex gap-2">
        <select data-link class="border border-paper/20 bg-transparent p-2 text-sm normal-case"><option value="">Select member…</option>${options}</select>
        <button type="button" data-do-link class="border border-amber px-3 py-1 text-xs uppercase">Link</button>
      </span></label>` : ''}`;
  card.querySelector('[data-do-link]')?.addEventListener('click', () => {
    const id = card.querySelector('[data-link]').value;
    if (id) onLink?.(s.slot, id);
  });
  return card;
}

function linkedSlotCard(u, title, { isAdmin, onUnlink, slot }) {
  const card = document.createElement('article');
  card.setAttribute('data-slot', slot);
  card.className = 'border border-amber/40 p-5';
  card.innerHTML = `
    <a href="/members/?id=${encodeURIComponent(u.id)}">
      ${u.avatar_r2_key ? `<img src="${avatarSrc(u.avatar_r2_key)}" alt="${esc(u.name)}" class="h-24 w-24 rounded-full object-cover" loading="lazy" />` : '<div class="h-24 w-24 rounded-full bg-ink-soft"></div>'}
    </a>
    <h3 class="mt-3 font-display text-xl uppercase"><a href="/members/?id=${encodeURIComponent(u.id)}">${esc(u.name)}</a></h3>
    <p class="text-amber text-sm uppercase">${esc(title)}</p>
    <p class="mt-1 text-sm text-paper/60">${esc(u.function ?? '')}</p>
    ${isAdmin ? '<button type="button" data-unlink class="mt-3 border border-paper/20 px-3 py-1 text-xs uppercase">Unlink</button>' : ''}`;
  card.querySelector('[data-unlink]')?.addEventListener('click', () => onUnlink?.(slot));
  return card;
}

export function renderVorstand(el, users = [], { isAdmin = false, links = {}, onVorstand = null, onPhoto = null, onRename = null, onAdmin = null, onLink = null, onUnlink = null } = {}) {
  el.innerHTML = '';
  const byId = new Map(users.map((u) => [u.id, u]));
  const claimed = new Set(Object.values(links ?? {}));
  const heading = document.createElement('h2');
  heading.className = 'font-display text-2xl uppercase';
  heading.textContent = 'Vorstand';
  el.append(heading);
  const slots = document.createElement('div');
  slots.className = 'mt-4 grid gap-6 sm:grid-cols-3';
  for (const s of VORSTAND_STATIC) {
    const linked = byId.get(links?.[s.slot]);
    slots.append(linked
      ? linkedSlotCard(linked, s.title, { isAdmin, onUnlink, slot: s.slot })
      : staticSlotCard(s, users, { isAdmin, onLink }));
  }
  el.append(slots);

  const board = users.filter((u) => u.is_vorstand && !claimed.has(u.id));
  const grid = document.createElement('div');
  grid.className = 'grid gap-6 sm:grid-cols-3';
  for (const v of board) {
    const card = document.createElement('article');
    card.className = 'border border-paper/15 p-5';
    card.innerHTML = `
      ${v.avatar_r2_key ? `<img src="${avatarSrc(v.avatar_r2_key)}" alt="${esc(v.name)}" class="h-24 w-24 rounded-full object-cover" loading="lazy" />` : '<div class="h-24 w-24 rounded-full bg-ink-soft"></div>'}
      <h3 class="mt-3 font-display text-xl uppercase">${esc(v.name)}</h3>
      <p class="text-amber text-sm uppercase">${esc(v.vorstand_title ?? '')}</p>
      <p class="mt-1 text-sm text-paper/60">${esc(v.function ?? '')}</p>`;
    grid.append(card);
  }
  el.append(grid);

  if (isAdmin) {
    const manage = document.createElement('section');
    manage.className = 'mt-12';
    manage.innerHTML = `
      <h2 class="font-display text-2xl uppercase">Manage board</h2>
      <p class="mt-2 text-sm text-paper/60">Photos: save an image from <a class="text-amber" href="${SOCIALS.instagram}" target="_blank" rel="noreferrer">instagram.com/archerfilmstudios</a> and upload it here (jpg/png/webp, max 2MB).</p>
      <div data-rows class="mt-4 grid gap-4"></div>
      <p data-error class="text-sm text-red-400"></p>`;
    const rows = manage.querySelector('[data-rows]');
    for (const u of users) {
      const row = document.createElement('div');
      row.setAttribute('data-user', u.id);
      row.className = 'flex flex-wrap items-center gap-3 border border-paper/15 p-3 text-sm';
      row.innerHTML = `
        <span class="font-semibold">${esc(u.name)}</span>
        <span class="text-paper/60">${esc(u.function ?? '')}</span>
        ${u.is_vorstand
          ? `<span class="text-amber text-xs uppercase">${esc(u.vorstand_title ?? 'Board')}</span>
             <button type="button" data-remove class="border border-paper/20 px-3 py-1 text-xs uppercase">Remove</button>`
          : `<input data-title placeholder="Title (e.g. Director)" value="" class="border border-paper/20 bg-transparent p-2 text-sm" />
             <button type="button" data-add class="border border-amber px-3 py-1 text-xs uppercase">Add to board</button>`}
        <input data-name value="${esc(u.name ?? '').replace(/`/g, '&#96;')}" placeholder="Name" class="border border-paper/20 bg-transparent p-2 text-sm" />
        <input data-function value="${esc(u.function ?? '').replace(/`/g, '&#96;')}" placeholder="Role" class="border border-paper/20 bg-transparent p-2 text-sm" />
        <button type="button" data-save class="border border-paper/20 px-3 py-1 text-xs uppercase">Save name</button>
        ${u.is_admin
          ? '<button type="button" data-demote class="border border-paper/20 px-3 py-1 text-xs uppercase">Remove admin</button>'
          : '<button type="button" data-promote class="border border-amber px-3 py-1 text-xs uppercase">Make admin</button>'}
        <label class="text-xs uppercase text-paper/60">Photo <input data-photo type="file" accept="image/jpeg,image/png,image/webp" /></label>`;
      row.querySelector('[data-add]')?.addEventListener('click', async () => {
        try {
          await onVorstand?.(u, { is_vorstand: true, vorstand_title: row.querySelector('[data-title]').value || 'Vorstand' });
        } catch (err) {
          manage.querySelector('[data-error]').textContent = err.message;
        }
      });
      row.querySelector('[data-remove]')?.addEventListener('click', async () => {
        try {
          await onVorstand?.(u, { is_vorstand: false, vorstand_title: null });
        } catch (err) {
          manage.querySelector('[data-error]').textContent = err.message;
        }
      });
      row.querySelector('[data-photo]')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          await onPhoto?.(u, file);
        } catch (err) {
          manage.querySelector('[data-error]').textContent = err.message;
        }
      });
      row.querySelector('[data-save]')?.addEventListener('click', async () => {
        try {
          await onRename?.(u, { name: row.querySelector('[data-name]').value, function: row.querySelector('[data-function]').value });
        } catch (err) {
          manage.querySelector('[data-error]').textContent = err.message;
        }
      });
      row.querySelector('[data-promote]')?.addEventListener('click', async () => {
        try {
          await onAdmin?.(u, { is_admin: true });
        } catch (err) {
          manage.querySelector('[data-error]').textContent = err.message;
        }
      });
      row.querySelector('[data-demote]')?.addEventListener('click', async () => {
        try {
          await onAdmin?.(u, { is_admin: false });
        } catch (err) {
          manage.querySelector('[data-error]').textContent = err.message;
        }
      });
      rows.append(row);
    }
    el.append(manage);
  }
}
