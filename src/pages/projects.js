import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderProjectDetail, renderProjectGallery, renderProjects, renderProjectForm } from '../views/projects.js';

await mountLayout('projects');
const view = document.querySelector('#app-view');
const requestedId = new URLSearchParams(location.search).get('id');

async function joinLeave(project, join) {
  try {
    if (join) await api(`/api/projects/${project.id}/join`, { method: 'POST', body: '{}' });
    else await api(`/api/projects/${project.id}/join`, { method: 'DELETE' });
    await loadDetail(project.id);
  } catch (err) {
    if (err.status === 401) location.href = '/login/';
    else alert(err.message);
  }
}

async function loadDetail(id) {
  const data = await api(`/api/projects/${encodeURIComponent(id)}`);
  let users = [];
  if (data.canEdit) {
    try {
      ({ users } = await api('/api/users'));
    } catch {
      users = [];
    }
  }
  renderProjectDetail(view, data, {
    isAdmin: data.canEdit,
    isMember: data.isMember,
    users,
    onJoin: (project) => joinLeave(project, true),
    onLeave: (project) => joinLeave(project, false),
    onAssignHead: async (headId) => {
      try {
        await api(`/api/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ head_user_id: headId }) });
        await loadDetail(id);
      } catch (err) {
        alert(err.message);
      }
    },
    onEdit: (project) => renderProjectForm(view, { project, users, onSave: () => loadDetail(id) }),
    onDelete: async (project) => {
      if (!confirm(`Really delete "${project.title}"?`)) return;
      try {
        await api(`/api/projects/${project.id}`, { method: 'DELETE' });
        location.href = '/projects/';
      } catch (err) {
        alert(err.message);
      }
    },
  });
  let me = null;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  const gallery = document.createElement('div');
  view.append(gallery);
  const renderGallery = async () => {
    const { photos } = await api(`/api/projects/${encodeURIComponent(id)}/photos`);
    renderProjectGallery(gallery, photos, {
      canUpload: data.isMember || data.canEdit,
      canDeleteFor: (p) => data.canEdit || p.uploaded_by === me?.id,
      onUpload: async (file) => {
        if (file.size > 2 * 1024 * 1024) throw new Error('Image too large (max 2MB).');
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}/photos`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || body?.ok === false) throw new Error(body?.error ?? `Fehler ${res.status}`);
        await renderGallery();
      },
      onDelete: async (photo) => {
        await api(`/api/photos/${photo.id}`, { method: 'DELETE' });
        await renderGallery();
      },
    });
  };
  try {
    await renderGallery();
  } catch (err) {
    const p = document.createElement('p');
    p.className = 'mt-8 text-sm text-red-400';
    p.textContent = err.message;
    gallery.append(p);
  }
}

async function load() {
  const { projects } = await api('/api/projects');
  let me;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  let users = [];
  if (me?.is_admin) {
    try {
      ({ users } = await api('/api/users'));
    } catch {
      users = [];
    }
  }
  renderProjects(view, projects, {
    myId: me?.id,
    isAdmin: !!me?.is_admin,
    users,
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
    onEdit: (project) => renderProjectForm(view, { project, users, onSave: () => load() }),
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
  if (requestedId) await loadDetail(requestedId);
  else await load();
} catch (err) {
  if (err.status === 401) location.href = '/login/';
  else if (err.status === 404) {
    view.innerHTML = requestedId ? '<p class="text-red-400">Project not found.</p>' : `<p class="text-red-400">${err.message}</p>`;
  } else view.innerHTML = `<p class="text-red-400">${err.message}</p>`;
}
