import { esc } from './projects.js';
import { SOCIALS } from '../data/socials.js';

export function avatarSrc(key) {
  return key ? `/avatars/${key.replace(/^avatars\//, '')}` : '';
}

export function renderVorstand(el, users = [], { isAdmin = false, onVorstand = null, onPhoto = null } = {}) {
  el.innerHTML = '';
  const board = users.filter((u) => u.is_vorstand);
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
      rows.append(row);
    }
    el.append(manage);
  }
}
