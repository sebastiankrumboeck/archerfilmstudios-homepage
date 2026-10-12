import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderAbsenceDecided, renderAbsenceDecision, renderCallSheet, renderCallSheetForm, renderOpenRoles, renderProjectDetail, renderProjectGallery, renderProjects, renderProjectForm, renderReminderToggle } from '../views/projects.js';

await mountLayout('projects');
const view = document.querySelector('#app-view');
const params = new URLSearchParams(location.search);
const requestedId = params.get('id');
const absenceId = params.get('absence');

function loginHref() {
  return `/login/?next=${encodeURIComponent(location.pathname + location.search)}`;
}

async function joinLeave(project, join, reason = '') {
  try {
    if (join) await api(`/api/projects/${project.id}/join`, { method: 'POST', body: '{}' });
    else await api(`/api/projects/${project.id}/join`, { method: 'DELETE', body: JSON.stringify({ reason }) });
    await loadDetail(project.id);
  } catch (err) {
    if (err.status === 401) location.href = loginHref();
    else alert(err.message);
  }
}

async function loadAbsence(id) {
  const { absences } = await api('/api/absences');
  const found = (absences ?? []).find((a) => a.id === id);
  if (!found) {
    view.innerHTML = '<p class="text-red-400">Nicht gefunden.</p>';
    return;
  }
  renderAbsenceDecision(view, found, {
    onApprove: async () => {
      try {
        await api(`/api/absences/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ approved: true }) });
        renderAbsenceDecided(view, { approved: true });
      } catch (err) {
        if (err.status === 401) location.href = loginHref();
        else alert(err.message);
      }
    },
    onReject: async (absenceId, note) => {
      try {
        await api(`/api/absences/${encodeURIComponent(absenceId)}/decision`, { method: 'POST', body: JSON.stringify({ approved: false, note }) });
        renderAbsenceDecided(view, { approved: false });
      } catch (err) {
        if (err.status === 401) location.href = loginHref();
        else alert(err.message);
      }
    },
  });
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
  let me = null;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  renderProjectDetail(view, data, {
    isAdmin: data.canEdit,
    isMember: data.isMember,
    users,
    bannedUntil: me?.banned_until ?? null,
    onJoin: (project) => joinLeave(project, true),
    onLeave: (project, { reason } = {}) => joinLeave(project, false, reason),
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
  const reminderBox = document.createElement('div');
  view.append(reminderBox);
  renderReminderToggle(reminderBox, {
    enabled: data.project.reminders_enabled !== 0,
    canToggle: !!me && (data.canEdit || data.head?.id === me.id),
    onToggle: async (next) => {
      await api(`/api/projects/${encodeURIComponent(id)}/reminders`, { method: 'PATCH', body: JSON.stringify({ enabled: next }) });
      await loadDetail(id);
    },
  });
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
  const canSheet = !!me && (data.canEdit || data.head?.id === me.id);
  let sheetUsers = users;
  if (canSheet && !data.canEdit) {
    try {
      ({ users: sheetUsers } = await api('/api/users'));
    } catch {
      sheetUsers = [];
    }
  }
  const sheetBox = document.createElement('div');
  view.append(sheetBox);
  const rolesBox = document.createElement('div');
  view.append(rolesBox);
  async function refreshSheet(editing = false) {
    try {
      const res = await api(`/api/projects/${encodeURIComponent(id)}/callsheet`);
      let { sheet, roles } = res;
      if (sheet.call_time == null && sheet.meeting_point == null) {
        sheet = { ...sheet, call_time: data.project.start_at ?? null, meeting_point: data.project.location ?? null };
      }
      if (editing && canSheet) {
        renderCallSheetForm(sheetBox, { sheet, roles, members: sheetUsers }, {
          onSave: async (payload) => {
            try {
              await api(`/api/projects/${encodeURIComponent(id)}/callsheet`, { method: 'PUT', body: JSON.stringify(payload) });
              await refreshSheet(false);
            } catch (err) {
              sheetBox.querySelector('[data-error]').textContent = err.message;
            }
          },
        });
      } else {
        renderCallSheet(sheetBox, { sheet, roles }, {
          canEdit: canSheet,
          onEdit: () => refreshSheet(true),
          onPublish: async () => {
            try {
              await api(`/api/projects/${encodeURIComponent(id)}/callsheet/publish`, { method: 'POST', body: '{}' });
              await refreshSheet(false);
              alert('Call Sheet veröffentlicht. Alle Mitglieder wurden per E-Mail informiert.');
            } catch (err) {
              alert(err.message);
            }
          },
        });
      }
      renderOpenRoles(rolesBox, { roles, applications: res.applications ?? [] }, {
        isHeadOrAdmin: canSheet,
        onApply: async (role) => {
          try {
            await api(`/api/projects/${encodeURIComponent(id)}/roles/apply`, { method: 'POST', body: JSON.stringify({ role }) });
            await refreshSheet(false);
          } catch (err) {
            alert(err.message);
          }
        },
        onDecide: async (applicationId, approved) => {
          try {
            await api(`/api/role-applications/${encodeURIComponent(applicationId)}/decision`, { method: 'POST', body: JSON.stringify({ approved }) });
            await refreshSheet(false);
          } catch (err) {
            alert(err.message);
          }
        },
      });
    } catch (err) {
      const p = document.createElement('p');
      p.className = 'mt-8 text-sm text-red-400';
      p.textContent = err.message;
      sheetBox.append(p);
    }
  }
  await refreshSheet(false);
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
    bannedUntil: me?.banned_until ?? null,
    onJoin: async (project) => {
      try {
        await api(`/api/projects/${project.id}/join`, { method: 'POST', body: '{}' });
        await load();
      } catch (err) {
        if (err.status === 401) location.href = loginHref();
        else alert(err.message);
      }
    },
    onLeave: async (project, { reason } = {}) => {
      try {
        await api(`/api/projects/${project.id}/join`, { method: 'DELETE', body: JSON.stringify({ reason: reason ?? '' }) });
        await load();
      } catch (err) {
        if (err.status === 401) location.href = loginHref();
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
  if (absenceId) await loadAbsence(absenceId);
  else if (requestedId) await loadDetail(requestedId);
  else await load();
} catch (err) {
  if (err.status === 401) location.href = loginHref();
  else if (err.status === 403) view.innerHTML = '<p class="text-red-400">Nur für Vorstandsmitglieder.</p>';
  else if (err.status === 404) {
    view.innerHTML = requestedId ? '<p class="text-red-400">Project not found.</p>' : `<p class="text-red-400">${err.message}</p>`;
  } else view.innerHTML = `<p class="text-red-400">${err.message}</p>`;
}
