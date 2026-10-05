import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderVorstand } from '../views/vorstand.js';

await mountLayout('board');
const view = document.querySelector('#app-view');

async function load() {
  const { users, links } = await api('/api/users');
  let me;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  renderVorstand(view, users, {
    isAdmin: !!me?.is_admin,
    links: links ?? {},
    onVorstand: async (user, { is_vorstand, vorstand_title }) => {
      await api(`/api/users/${user.id}/vorstand`, {
        method: 'PATCH',
        body: JSON.stringify({ is_vorstand, vorstand_title }),
      });
      await load();
    },
    onPhoto: async (user, file) => {
      if (file.size > 2 * 1024 * 1024) throw new Error('Image too large (max 2MB).');
      await fetch(`/api/users/${user.id}/avatar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': file.type },
        body: file,
      }).then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || body?.ok === false) throw new Error(body?.error ?? `Fehler ${res.status}`);
      });
      await load();
    },
    onRename: async (user, { name, function: fn }) => {
      await api(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, function: fn }),
      });
      await load();
    },
    onAdmin: async (user, { is_admin }) => {
      await api(`/api/users/${user.id}/admin`, {
        method: 'PATCH',
        body: JSON.stringify({ is_admin }),
      });
      await load();
    },
    onLink: async (slot, userId) => {
      await api('/api/vorstand-links', {
        method: 'PUT',
        body: JSON.stringify({ slot, user_id: userId }),
      });
      await load();
    },
    onUnlink: async (slot) => {
      await api(`/api/vorstand-links/${encodeURIComponent(slot)}`, { method: 'DELETE' });
      await load();
    },
  });
}

try {
  await load();
} catch (err) {
  if (err.status === 401) location.href = '/login/';
  else view.innerHTML = `<p class="text-red-400">${err.message}</p>`;
}
