import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderFilmForm, renderFilms } from '../views/films.js';

await mountLayout('films');
const view = document.querySelector('#app-view');

async function load() {
  const { films } = await api('/api/films');
  let me;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  const isAdmin = !!me?.is_admin;
  const opts = {
    isAdmin,
    onCreate: () => load(),
    onEdit: (film) => renderFilmForm(view, { film, onSave: () => load() }),
    onDelete: async (film) => {
      if (!confirm(`Really delete "${film.title}"?`)) return;
      try {
        await api(`/api/films/${film.id}`, { method: 'DELETE' });
        await load();
      } catch (err) {
        alert(err.message);
      }
    },
  };
  if (me?.is_admin) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mb-6 border border-amber px-5 py-3 text-xs uppercase tracking-widest';
    btn.textContent = '+ Add film';
    btn.addEventListener('click', () => renderFilmForm(view, opts));
    view.innerHTML = '';
    view.append(btn);
    const list = document.createElement('div');
    renderFilms(list, films, opts);
    view.append(list);
  } else {
    renderFilms(view, films, opts);
  }
}

try {
  await load();
} catch (err) {
  view.innerHTML = `<p class="text-red-400">${err.message}</p>`;
}
