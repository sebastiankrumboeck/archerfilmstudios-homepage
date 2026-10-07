import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderMinutes } from '../views/mitschriften.js';
import { renderDecisions } from '../views/beschluesse.js';

await mountLayout('mitschriften');
const view = document.querySelector('#app-view');

async function load() {
  let me = null;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  const { minutes, canUpload } = await api('/api/minutes');
  const isAdmin = !!me?.is_admin;
  renderMinutes(view, minutes, {    canUpload,
    canDeleteFor: (m) => isAdmin || m.uploaded_by === me?.id,
    onUpload: async (title, file) => {
      if (file.size > 10 * 1024 * 1024) throw new Error('Datei zu groß (max. 10MB).');
      const res = await fetch(`/api/minutes?title=${encodeURIComponent(title)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || body?.ok === false) throw new Error(body?.error ?? `Fehler ${res.status}`);
      await load();
    },
    onDelete: async (minute) => {
      await api(`/api/minutes/${minute.id}`, { method: 'DELETE' });
      await load();
    },
  });
  const { decisions } = await api('/api/decisions');
  const decisionBox = document.createElement('div');
  view.append(decisionBox);
  renderDecisions(decisionBox, decisions, {
    canManage: isAdmin,
    onAdd: async (payload) => {
      await api('/api/decisions', { method: 'POST', body: JSON.stringify(payload) });
      await load();
    },
    onDelete: async (decision) => {
      await api(`/api/decisions/${decision.id}`, { method: 'DELETE' });
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
