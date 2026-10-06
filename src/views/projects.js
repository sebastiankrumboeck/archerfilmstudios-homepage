import { intensityColor, intensityLabel } from '../lib/intensity.js';
import { api } from '../api/client.js';

export function joinLabel(project, isMember) {
  const max = project.max_members ?? '∞';
  if (isMember) return 'Joined ✓';
  if (project.max_members != null && project.member_count >= project.max_members) return `Full (${project.max_members}/${project.max_members})`;
  return `Join (${project.member_count}/${max})`;
}

export function joinDisabled(project, isMember) {
  if (isMember) return false;
  return project.max_members != null && project.member_count >= project.max_members;
}

export function renderProjectCard(el, project, { isAdmin = false, isMember = false, onJoin = null, onEdit = null, onDelete = null, onLeave = null } = {}) {
  const color = intensityColor(project.intensity);
  const label = joinLabel({ ...project, isMember }, isMember);
  const disabled = joinDisabled(project, isMember) ? 'disabled' : '';
  const avatars = (project.members ?? []).map((m) => m.avatar_r2_key
    ? `<img src="/avatars/${m.avatar_r2_key.replace(/^avatars\//, '')}" alt="${esc(m.name)}" title="${esc(m.name)}" class="h-8 w-8 rounded-full object-cover" loading="lazy" />`
    : `<span title="${esc(m.name)}" class="grid h-8 w-8 place-items-center rounded-full bg-ink-soft text-xs">${esc((m.name ?? '?')[0])}</span>`).join('');
  el.innerHTML = `
    <article class="border-t-2 pt-3" style="border-color:${color}">
      <span class="inline-block px-2 py-1 text-xs" style="background:${color};color:#151412">${intensityLabel(project.intensity)}</span>
      <h3 class="mt-2 font-display text-2xl uppercase">${esc(project.title)}</h3>
      <p class="text-sm text-paper/70">${esc(project.description ?? '')}</p>
      <p class="mt-1 text-xs uppercase tracking-widest text-muted">${fmtDate(project.start_at)} → ${fmtDate(project.end_at)} · max ${project.max_members ?? '∞'}</p>
      <div class="mt-2 flex -space-x-2">${avatars}</div>
      <button type="button" data-join ${disabled} title="${isMember ? 'Click to leave the project' : ''}" class="mt-3 border border-amber px-4 py-2 text-xs uppercase tracking-widest">${label}</button>
      ${isAdmin ? '<button type="button" data-edit class="mt-3 ml-2 border border-paper/20 px-4 py-2 text-xs uppercase">Edit</button><button type="button" data-delete class="mt-3 ml-2 border border-paper/20 px-4 py-2 text-xs uppercase">Delete</button>' : ''}
    </article>`;
  el.querySelector('[data-join]')?.addEventListener('click', () => (isMember ? onLeave : onJoin)?.(project));
  el.querySelector('[data-edit]')?.addEventListener('click', () => onEdit?.(project));
  el.querySelector('[data-delete]')?.addEventListener('click', () => onDelete?.(project));
}

export function renderProjectDetail(el, data, { isAdmin = false, isMember = false, users = [], onJoin = null, onLeave = null, onAssignHead = null, onEdit = null, onDelete = null } = {}) {
  el.innerHTML = '';
  if (!data?.project) {
    el.innerHTML = '<p class="text-red-400">Project not found.</p>';
    return;
  }
  const { project, head, members = [], creator } = data;
  const member = isMember || data.isMember === true;
  const admin = isAdmin || data.canEdit === true;
  const color = intensityColor(project.intensity);
  const counted = { ...project, member_count: data.member_count ?? members.length };
  const label = joinLabel(counted, member);
  const disabled = joinDisabled(counted, member) ? 'disabled' : '';
  const chips = members.map((m) => `
    <a href="/members/?id=${encodeURIComponent(m.id)}" title="${esc(m.name)}" class="flex items-center gap-2 border border-paper/15 px-3 py-1 text-sm transition-colors hover:border-amber">
      ${m.avatar_r2_key
        ? `<img src="/avatars/${m.avatar_r2_key.replace(/^avatars\//, '')}" alt="${esc(m.name)}" class="h-6 w-6 rounded-full object-cover" loading="lazy" />`
        : `<span class="grid h-6 w-6 place-items-center rounded-full bg-ink-soft text-xs">${esc((m.name ?? '?')[0])}</span>`}
      ${esc(m.name)}
    </a>`).join('');
  const headLine = head
    ? `<p class="mt-2 text-sm uppercase tracking-widest">Head: ${esc(head.name)}</p>`
    : `<p class="mt-2 text-sm uppercase tracking-widest text-paper/60">Organized by ${creator ? `<a class="text-amber" href="/members/?id=${encodeURIComponent(creator.id)}">${esc(creator.name)}</a>` : 'the club'}</p>`;
  const candidates = users.length ? users : members;
  const headSelect = admin ? `
    <label class="mt-4 block text-xs uppercase text-paper/60">Project head
      <select data-head class="ml-2 border border-paper/20 bg-transparent p-2 text-sm text-paper">
        <option value="">No head</option>
        ${candidates.map((u) => `<option value="${esc(u.id)}"${project.head_user_id === u.id ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}
      </select>
    </label>` : '';
  el.innerHTML = `
    <article class="border-t-2 pt-3" style="border-color:${color}">
      <span class="inline-block px-2 py-1 text-xs" style="background:${color};color:#151412">${intensityLabel(project.intensity)}</span>
      <h2 class="mt-2 font-display text-3xl uppercase">${esc(project.title)}</h2>
      <p class="mt-2 text-paper/70">${esc(project.description ?? '')}</p>
      <p class="mt-2 text-xs uppercase tracking-widest text-muted">${fmtDate(project.start_at)} → ${fmtDate(project.end_at)} · ${esc(project.location ?? '')} · max ${project.max_members ?? '∞'} · ${members.length} joined</p>
      ${headLine}
      <div class="mt-4 flex flex-wrap gap-2">${chips || '<span class="text-sm text-paper/60">No members yet.</span>'}</div>
      <button type="button" data-join ${disabled} class="mt-4 border border-amber px-4 py-2 text-xs uppercase tracking-widest">${label}</button>
      ${admin ? '<button type="button" data-edit class="mt-4 ml-2 border border-paper/20 px-4 py-2 text-xs uppercase">Edit</button><button type="button" data-delete class="mt-4 ml-2 border border-paper/20 px-4 py-2 text-xs uppercase">Delete</button>' : ''}
      ${headSelect}
    </article>`;
  el.querySelector('[data-join]')?.addEventListener('click', () => (member ? onLeave : onJoin)?.(project));
  el.querySelector('[data-edit]')?.addEventListener('click', () => onEdit?.(project));
  el.querySelector('[data-delete]')?.addEventListener('click', () => onDelete?.(project));
  el.querySelector('[data-head]')?.addEventListener('change', (e) => onAssignHead?.(e.target.value || null));
}

export function renderProjects(el, projects, opts = {}) {
  el.innerHTML = '';
  if (opts.isAdmin) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mb-6 border border-amber px-5 py-3 text-xs uppercase tracking-widest';
    btn.textContent = '+ New project';
    btn.addEventListener('click', () => renderProjectForm(el, opts));
    el.append(btn);
  }
  const wrap = document.createElement('div');
  wrap.className = 'grid gap-8 md:grid-cols-2';
  for (const p of projects) {
    const card = document.createElement('div');
    renderProjectCard(card, p, { ...opts, isMember: opts.myId ? (p.members ?? []).some((m) => m.id === opts.myId) : false });
    wrap.append(card);
  }
  el.append(wrap);
}

export function renderProjectForm(el, { project = null, users = [], onSave = null, onCreate = null } = {}) {
  el.querySelector('[data-project-form]')?.remove();
  const editing = !!project;
  const form = document.createElement('form');
  form.setAttribute('data-project-form', '');
  form.className = 'mb-8 grid max-w-2xl gap-3';
  const headOptions = users.map((u) => `<option value="${esc(u.id)}"${project?.head_user_id === u.id ? ' selected' : ''}>${esc(u.name)}</option>`).join('');
  form.innerHTML = `
    <input name="title" required placeholder="Title" value="${escAttr(project?.title ?? '')}" class="border border-paper/20 bg-transparent p-3" />
    <textarea name="description" placeholder="Description" class="border border-paper/20 bg-transparent p-3">${esc(project?.description ?? '')}</textarea>
    <label class="text-xs uppercase">Intensity (1-5) <input name="intensity" type="number" min="1" max="5" required value="${project?.intensity ?? ''}" class="border border-paper/20 bg-transparent p-3" /></label>
    <input name="location" placeholder="Location" value="${escAttr(project?.location ?? '')}" class="border border-paper/20 bg-transparent p-3" />
    ${users.length ? `<label class="text-xs uppercase">Project head <select name="head_user_id" class="border border-paper/20 bg-transparent p-3"><option value="">No head</option>${headOptions}</select></label>` : ''}
    <label class="text-xs uppercase">Start <input name="start_at" type="datetime-local" required value="${toLocalInput(project?.start_at)}" class="border border-paper/20 bg-transparent p-3" /></label>
    <label class="text-xs uppercase">End <input name="end_at" type="datetime-local" required value="${toLocalInput(project?.end_at)}" class="border border-paper/20 bg-transparent p-3" /></label>
    <input name="max_members" type="number" min="1" placeholder="Max members" value="${project?.max_members ?? ''}" class="border border-paper/20 bg-transparent p-3" />
    <p data-error class="text-sm text-red-400"></p>
    <button class="w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest">${editing ? 'Save' : 'Create project'}</button>`;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const headSelect = form.querySelector('[name="head_user_id"]');
    const payload = {
      title: fd.get('title'), description: fd.get('description'), intensity: Number(fd.get('intensity')),
      location: fd.get('location'), start_at: new Date(fd.get('start_at')).toISOString(),
      end_at: new Date(fd.get('end_at')).toISOString(), max_members: fd.get('max_members') ? Number(fd.get('max_members')) : null,
      ...(headSelect ? { head_user_id: headSelect.value || null } : {}),
    };
    try {
      const data = editing
        ? await api(`/api/projects/${project.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await api('/api/projects', { method: 'POST', body: JSON.stringify(payload) });
      (onSave ?? onCreate)?.(data.project);
    } catch (err) { form.querySelector('[data-error]').textContent = err.message; }
  });
  el.prepend(form);
}

export function renderReminderToggle(el, { enabled = true, canToggle = false, onToggle = null } = {}) {
  el.innerHTML = '';
  if (!canToggle) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('data-reminder-toggle', '');
  btn.className = 'mt-4 border border-paper/20 px-4 py-2 text-xs uppercase';
  btn.textContent = enabled ? 'Turn reminders off' : 'Turn reminders on';
  btn.title = enabled ? 'Members get an email reminder before this shoot' : 'No reminder emails for this shoot';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await onToggle?.(!enabled);
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  });
  el.append(btn);
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderProjectGallery(el, photos = [], { canUpload = false, canDeleteFor = null, onUpload = null, onDelete = null } = {}) {
  el.innerHTML = '';
  const section = document.createElement('section');
  section.className = 'mt-8';
  const title = document.createElement('h3');
  title.className = 'font-display text-xl uppercase';
  title.textContent = 'Gallery';
  section.append(title);
  if (!photos.length) {
    const empty = document.createElement('p');
    empty.className = 'mt-2 text-sm text-paper/60';
    empty.textContent = 'No photos yet — be the first to upload!';
    section.append(empty);
  }
  const grid = document.createElement('div');
  grid.className = 'mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3';
  for (const photo of photos) {
    const fig = document.createElement('figure');
    fig.className = 'relative';
    const img = document.createElement('img');
    img.src = `/gallery/${String(photo.r2_key).replace(/^galleries\//, '')}`;
    img.alt = 'Project photo';
    img.loading = 'lazy';
    img.className = 'h-48 w-full object-cover';
    fig.append(img);
    if (canDeleteFor?.(photo)) {
      const del = document.createElement('button');
      del.type = 'button';
      del.setAttribute('data-delete', photo.id);
      del.className = 'absolute right-1 top-1 border border-paper/20 bg-ink/70 px-2 py-1 text-xs uppercase';
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        if (!confirm('Really delete this photo?')) return;
        try {
          await onDelete?.(photo);
        } catch (err) {
          status.textContent = err.message;
        }
      });
      fig.append(del);
    }
    grid.append(fig);
  }
  section.append(grid);
  if (canUpload) {
    const row = document.createElement('div');
    row.className = 'mt-4 flex flex-wrap items-center gap-2';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.className = 'text-sm';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-upload', '');
    btn.className = 'border border-amber px-4 py-2 text-xs uppercase tracking-widest';
    btn.textContent = 'Upload photo';
    btn.addEventListener('click', async () => {
      const file = input.files?.[0];
      if (!file) {
        status.textContent = 'Choose a photo first.';
        return;
      }
      btn.disabled = true;
      try {
        await onUpload?.(file);
        status.textContent = '';
        input.value = '';
      } catch (err) {
        status.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
    row.append(input, btn);
    section.append(row);
  }
  const status = document.createElement('p');
  status.setAttribute('data-status', '');
  status.className = 'mt-2 text-sm text-paper/60';
  section.append(status);
  el.append(section);
}

function escAttr(value) {
  return esc(value).replace(/`/g, '&#96;');
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}
