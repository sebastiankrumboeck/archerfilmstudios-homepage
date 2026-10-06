import { esc } from './projects.js';
import { api } from '../api/client.js';

export function posterSrc(key) {
  return key ? `/posters/${key.replace(/^posters\//, '')}` : '';
}

export function renderFilms(el, films = [], { isAdmin = false, onEdit = null, onDelete = null } = {}) {
  el.innerHTML = '';
  if (!films.length) {
    el.innerHTML = '<p class="text-paper/60">No films yet.</p>';
  }
  const grid = document.createElement('div');
  grid.className = 'grid gap-8 sm:grid-cols-2 lg:grid-cols-3';
  for (const f of films) {
    const card = document.createElement('article');
    card.innerHTML = `
      <a href="${esc(f.url)}" target="_blank" rel="noreferrer" class="block overflow-hidden border border-paper/15 transition-colors hover:border-amber">
        ${f.poster_r2_key
          ? `<img src="${posterSrc(f.poster_r2_key)}" alt="${esc(f.title)} film poster" class="aspect-[3/4] w-full object-cover" loading="lazy" />`
          : '<div class="grid aspect-[3/4] place-items-center bg-ink-soft px-6 text-center text-xs uppercase tracking-[0.2em] text-paper/40">Poster coming soon</div>'}
      </a>
      <h3 class="mt-3 font-display text-2xl uppercase">${esc(f.title)}</h3>
      ${isAdmin ? '<div class="mt-2 flex gap-2"><button type="button" data-edit class="border border-paper/20 px-4 py-2 text-xs uppercase">Edit</button><button type="button" data-delete class="border border-paper/20 px-4 py-2 text-xs uppercase">Delete</button></div>' : ''}`;
    card.querySelector('[data-edit]')?.addEventListener('click', () => onEdit?.(f));
    card.querySelector('[data-delete]')?.addEventListener('click', () => onDelete?.(f));
    grid.append(card);
  }
  el.append(grid);
}

export function renderFilmForm(el, { film = null, onSave = null, onCreate = null } = {}) {
  el.querySelector('[data-film-form]')?.remove();
  const editing = !!film;
  const form = document.createElement('form');
  form.setAttribute('data-film-form', '');
  form.className = 'mb-8 grid max-w-2xl gap-3';
  form.innerHTML = `
    <input name="title" required placeholder="Film title" value="${esc(film?.title ?? '').replace(/`/g, '&#96;')}" class="border border-paper/20 bg-transparent p-3" />
    <input name="url" type="url" required placeholder="Film website URL (https://…)" value="${esc(film?.url ?? '').replace(/`/g, '&#96;')}" class="border border-paper/20 bg-transparent p-3" />
    <label class="text-xs uppercase text-paper/60">Poster (jpg/png/webp, max 2MB) <input name="poster" type="file" accept="image/jpeg,image/png,image/webp" /></label>
    <p data-error class="text-sm text-red-400"></p>
    <button class="w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest">${editing ? 'Save' : 'Add film'}</button>`;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = { title: fd.get('title'), url: fd.get('url') };
    try {
      const data = editing
        ? await api(`/api/films/${film.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api('/api/films', { method: 'POST', body: JSON.stringify(payload) });
      const saved = data.film;
      const poster = form.querySelector('[name="poster"]').files?.[0];
      if (poster) {
        if (poster.size > 2 * 1024 * 1024) throw new Error('Image too large (max 2MB).');
        const res = await fetch(`/api/films/${saved.id}/poster`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': poster.type }, body: poster });
        const body = await res.json().catch(() => null);
        if (!res.ok || body?.ok === false) throw new Error(body?.error ?? `Error ${res.status}`);
      }
      (onSave ?? onCreate)?.(saved);
    } catch (err) {
      form.querySelector('[data-error]').textContent = err.message;
    }
  });
  el.prepend(form);
}
