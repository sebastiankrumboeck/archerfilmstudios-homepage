import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderIdeaForm, renderOwnIdeas } from '../views/ideen.js';

await mountLayout('ideenbox');
const view = document.querySelector('#app-view');

async function load() {
  const box = document.createElement('div');
  view.innerHTML = '';
  view.append(box);
  renderIdeaForm(box, {
    onSubmit: async ({ title, author_name, file }) => {
      const errEl = box.querySelector('[data-error]');
      try {
        if (file.size > 40 * 1024 * 1024) throw new Error('Datei zu groß (max. 40 MB).');
        if (file.type !== 'application/pdf') throw new Error('Nur PDF.');
        const { idea } = await api('/api/ideas', { method: 'POST', body: JSON.stringify({ title, author_name }) });
        const res = await fetch(`/api/ideas/${encodeURIComponent(idea.id)}/script`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || body?.ok === false) throw new Error(body?.error ?? `Fehler ${res.status}`);
        await load();
      } catch (err) {
        errEl.textContent = err.message;
      }
    },
  });
  try {
    const { ideas } = await api('/api/ideas/mine');
    renderOwnIdeas(view, ideas);
  } catch (err) {
    if (err.status === 401) location.href = '/login/';
    else {
      const p = document.createElement('p');
      p.className = 'mt-8 text-sm text-red-400';
      p.textContent = err.message;
      view.append(p);
    }
  }
}

try {
  await load();
} catch (err) {
  if (err.status === 401) location.href = '/login/';
  else view.innerHTML = `<p class="text-red-400">${err.message}</p>`;
}
