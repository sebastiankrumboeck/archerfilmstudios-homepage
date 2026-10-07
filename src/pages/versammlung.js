import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderForbidden } from '../views/finanzen.js';
import { renderAssemblies, renderPack } from '../views/versammlung.js';

await mountLayout('versammlung');
const view = document.querySelector('#app-view');

function showForbidden() {
  renderForbidden(view);
  view.querySelector('p').textContent = 'Admins only.';
}

let selectedId = null;

async function loadAssemblies() {
  const { assemblies } = await api('/api/assemblies');
  if (!assemblies.some((a) => a.id === selectedId)) {
    selectedId = assemblies[0]?.id ?? null;
  }
  return assemblies;
}

async function load() {
  let me;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  if (!me?.is_admin) {
    showForbidden();
    return;
  }
  const assemblies = await loadAssemblies();
  const top = document.createElement('div');
  view.innerHTML = '';
  view.append(top);
  const { minutes } = await api('/api/minutes');
  const selected = assemblies.find((a) => a.id === selectedId) ?? null;
  renderAssemblies(top, assemblies, {
    selectedId,
    onSelect: async (id) => {
      selectedId = id;
      await load();
    },
    onCreate: async (payload) => {
      try {
        const { assembly } = await api('/api/assemblies', { method: 'POST', body: JSON.stringify(payload) });
        selectedId = assembly.id;
        await load();
      } catch (err) {
        alert(err.message);
      }
    },
    minutes,
    linkedMinutesId: selected?.minutes_id ?? null,
    onLinkMinutes: async (minutes_id) => {
      try {
        await api(`/api/assemblies/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ minutes_id }) });
        await load();
      } catch (err) {
        alert(err.message);
      }
    },
  });
  if (!selected) return;
  const { pack } = await api(`/api/assembly-pack?assembly=${selected.id}`);
  const { users } = await api('/api/users');
  let present = new Set((pack.attendance ?? []).filter((r) => r.present).map((r) => r.user_id));
  const packBox = document.createElement('div');
  packBox.className = 'mt-10';
  view.append(packBox);
  renderPack(packBox, pack, {
    members: users,
    onToggleAttendance: async (user_id, next) => {
      const nextSet = new Set(present);
      if (next) nextSet.add(user_id);
      else nextSet.delete(user_id);
      try {
        await api('/api/assembly-pack/attendance', { method: 'PATCH', body: JSON.stringify({ assembly: selected.id, present: [...nextSet] }) });
        present = nextSet;
      } catch (err) {
        alert(err.message);
        await load();
      }
    },
  });
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'mt-6 border border-paper/20 px-4 py-2 text-xs uppercase';
  del.textContent = 'Versammlung löschen';
  del.addEventListener('click', async () => {
    if (!confirm(`Versammlung "${selected.title}" wirklich löschen?`)) return;
    try {
      await api(`/api/assemblies/${selected.id}`, { method: 'DELETE' });
      selectedId = null;
      await load();
    } catch (err) {
      alert(err.message);
    }
  });
  view.append(del);
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
