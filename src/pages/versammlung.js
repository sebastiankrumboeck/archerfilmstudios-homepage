import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderForbidden } from '../views/finanzen.js';
import { renderPack } from '../views/versammlung.js';

await mountLayout('versammlung');
const view = document.querySelector('#app-view');

function showForbidden() {
  renderForbidden(view);
  view.querySelector('p').textContent = 'Admins only.';
}

async function load(year) {
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
  const { pack } = await api(`/api/assembly-pack?year=${year}`);
  const { users } = await api('/api/users');
  let present = new Set((pack.attendance ?? []).filter((r) => r.present).map((r) => r.user_id));
  renderPack(view, pack, {
    members: users,
    onToggleAttendance: async (user_id, next) => {
      const nextSet = new Set(present);
      if (next) nextSet.add(user_id);
      else nextSet.delete(user_id);
      try {
        await api('/api/assembly-pack/attendance', { method: 'PATCH', body: JSON.stringify({ year, present: [...nextSet] }) });
        present = nextSet;
      } catch (err) {
        alert(err.message);
        await load(year);
      }
    },
  });
  const yearRow = document.createElement('div');
  yearRow.className = 'mb-6 flex items-center gap-3 text-sm';
  const label = document.createElement('label');
  label.className = 'text-xs uppercase text-paper/60';
  label.textContent = 'Jahr ';
  const select = document.createElement('select');
  select.className = 'border border-paper/20 bg-transparent p-2';
  const current = new Date().getFullYear();
  for (const y of [current, current - 1, current - 2]) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    if (y === year) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener('change', () => load(Number(select.value)));
  label.append(select);
  yearRow.append(label);
  view.prepend(yearRow);
}

try {
  await load(new Date().getFullYear());
} catch (err) {
  if (err.status === 401) location.href = '/login/';
  else {
    const p = document.createElement('p');
    p.className = 'text-red-400';
    p.textContent = err.message;
    view.append(p);
  }
}
