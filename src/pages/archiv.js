import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderForbidden } from '../views/finanzen.js';
import { renderArchive } from '../views/archiv.js';

await mountLayout('archiv');
const view = document.querySelector('#app-view');

async function load() {
  let me;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  if (!me?.is_admin && !me?.is_vorstand) {
    renderForbidden(view);
    view.querySelector('p').textContent = 'Vorstand only.';
    return;
  }
  const { documents } = await api('/api/archive');
  renderArchive(view, documents, {
    onUpload: async (title, file) => {
      if (file.size > 10 * 1024 * 1024) throw new Error('Datei zu groß (max. 10MB).');
      const res = await fetch(`/api/archive?title=${encodeURIComponent(title)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.ok === false) throw new Error(body?.error ?? `Fehler ${res.status}`);
      await load();
    },
    onDelete: async (document) => {
      await api(`/api/archive/${document.id}`, { method: 'DELETE' });
      await load();
    },
  });
}

try {
  await load();
} catch (err) {
  if (err.status === 401) location.href = '/login/';
  else {
    const p = document.createElement('p');
    p.className = 'text-red-400';
    p.textContent = err.message;
    view.append(p);
  }
}
