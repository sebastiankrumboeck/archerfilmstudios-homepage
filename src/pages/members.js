import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderMemberDetail, renderMemberList, renderOwnProfileForm } from '../views/members.js';

await mountLayout('members');
const view = document.querySelector('#app-view');
const params = new URLSearchParams(location.search);
const requestedId = params.get('id');

async function showList() {
  const { users } = await api('/api/users');
  renderMemberList(view, users);
}

async function showDetail(id) {
  let me = null;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  const targetId = id === 'me' ? me?.id : id;
  if (!targetId) {
    location.href = '/login/';
    return;
  }
  const data = await api(`/api/users/${encodeURIComponent(targetId)}`);
  renderMemberDetail(view, data);
  if (me && me.id === data.user.id) {
    renderOwnProfileForm(view, data.user, {
      onSave: async ({ name, function: fn }) => api(`/api/users/${encodeURIComponent(me.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, function: fn }),
      }),
      onSaved: () => showDetail(targetId),
    });
  }
}

try {
  if (requestedId) await showDetail(requestedId);
  else await showList();
} catch (err) {
  if (err.status === 401) location.href = '/login/';
  else if (err.status === 404) renderMemberDetail(view, null);
  else view.innerHTML = `<p class="text-red-400">${err.message}</p>`;
}
