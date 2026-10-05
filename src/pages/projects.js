import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderProjects, renderProjectForm } from '../views/projects.js';

await mountLayout('projects');
const view = document.querySelector('#app-view');

async function load() {
  const { projects } = await api('/api/projects');
  let me;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  renderProjects(view, projects, {
    myId: me?.id,
    isAdmin: !!me?.is_admin,
    onJoin: async (project) => {
      try {
        await api(`/api/projects/${project.id}/join`, { method: 'POST', body: '{}' });
        await load();
      } catch (err) {
        if (err.status === 401) location.href = '/login/';
        else alert(err.message);
      }
    },
    onLeave: async (project) => {
      try {
        await api(`/api/projects/${project.id}/join`, { method: 'DELETE' });
        await load();
      } catch (err) {
        if (err.status === 401) location.href = '/login/';
        else alert(err.message);
      }
    },
    onCreate: () => load(),
    onEdit: (project) => renderProjectForm(view, { project, onSave: () => load() }),
    onDelete: async (project) => {
      if (!confirm(`Really delete "${project.title}"?`)) return;
      try {
        await api(`/api/projects/${project.id}`, { method: 'DELETE' });
        await load();
      } catch (err) {
        alert(err.message);
      }
    },
  });
}

try {
  await load();
} catch (err) {
  if (err.status === 401) location.href = '/login/';
  else view.innerHTML = `<p class="text-red-400">${err.message}</p>`;
}
