import { intensityColor, intensityLabel } from '../lib/intensity.js';
import { api } from '../api/client.js';

export function joinLabel(project, isMember) {
  const max = project.max_members ?? '∞';
  if (isMember) return 'Abmelden';
  if (project.max_members != null && project.member_count >= project.max_members) return `Voll (${project.max_members}/${project.max_members})`;
  return `Teilnehmen (${project.member_count}/${max})`;
}

export function joinDisabled(project, isMember) {
  if (isMember) return false;
  return project.max_members != null && project.member_count >= project.max_members;
}

export function renderProjectCard(el, project, { isAdmin = false, isMember = false, bannedUntil = null, onJoin = null, onEdit = null, onDelete = null, onLeave = null } = {}) {
  const color = intensityColor(project.intensity);
  const label = joinLabel({ ...project, isMember }, isMember);
  const ban = !isMember ? banLabel(bannedUntil) : null;
  const disabled = (!ban && joinDisabled(project, isMember)) || !!ban ? 'disabled' : '';
  const buttonLabel = ban ?? label;
  const buttonTitle = ban ?? (isMember ? 'Klicke, um dich abzumelden' : '');
  const avatars = (project.members ?? []).map((m) => m.avatar_r2_key
    ? `<img src="/avatars/${m.avatar_r2_key.replace(/^avatars\//, '')}" alt="${esc(m.name)}" title="${esc(m.name)}" class="h-8 w-8 rounded-full object-cover" loading="lazy" />`
    : `<span title="${esc(m.name)}" class="grid h-8 w-8 place-items-center rounded-full bg-ink-soft text-xs">${esc((m.name ?? '?')[0])}</span>`).join('');
  el.innerHTML = `
    <article class="border-t-2 pt-3" style="border-color:${color}">
      <span class="inline-block px-2 py-1 text-xs" style="background:${color};color:#151412">${intensityLabel(project.intensity)}</span>
      <h3 class="mt-2 font-display text-2xl uppercase"><a class="transition-colors hover:text-amber" href="/projects/?id=${encodeURIComponent(project.id)}">${esc(project.title)}</a></h3>
      <p class="text-sm text-paper/70">${esc(project.description ?? '')}</p>
      <p class="mt-1 text-xs uppercase tracking-widest text-muted">${fmtDate(project.start_at)} → ${fmtDate(project.end_at)} · max ${project.max_members ?? '∞'}</p>
      <div class="mt-2 flex -space-x-2">${avatars}</div>
      <button type="button" data-join ${disabled} title="${buttonTitle}" class="mt-3 border border-amber px-4 py-2 text-xs uppercase tracking-widest">${buttonLabel}</button>
      ${isAdmin ? '<button type="button" data-edit class="mt-3 ml-2 border border-paper/20 px-4 py-2 text-xs uppercase">Edit</button><button type="button" data-delete class="mt-3 ml-2 border border-paper/20 px-4 py-2 text-xs uppercase">Delete</button>' : ''}
    </article>`;
  el.querySelector('[data-join]')?.addEventListener('click', () => {
    if (banLabel(bannedUntil) && !isMember) return;
    if (isMember) openLeaveModal(project, onLeave);
    else if (!joinDisabled(project, isMember)) openJoinModal(project, onJoin);
  });
  el.querySelector('[data-edit]')?.addEventListener('click', () => onEdit?.(project));
  el.querySelector('[data-delete]')?.addEventListener('click', () => onDelete?.(project));
}

export function renderProjectDetail(el, data, { isAdmin = false, isMember = false, users = [], bannedUntil = null, onJoin = null, onLeave = null, onAssignHead = null, onEdit = null, onDelete = null } = {}) {
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
  const ban = !member ? banLabel(bannedUntil) : null;
  const disabled = (!ban && joinDisabled(counted, member)) || !!ban ? 'disabled' : '';
  const buttonLabel = ban ?? label;
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
      <button type="button" data-join ${disabled} class="mt-4 border border-amber px-4 py-2 text-xs uppercase tracking-widest">${buttonLabel}</button>
      ${admin ? '<button type="button" data-edit class="mt-4 ml-2 border border-paper/20 px-4 py-2 text-xs uppercase">Edit</button><button type="button" data-delete class="mt-4 ml-2 border border-paper/20 px-4 py-2 text-xs uppercase">Delete</button>' : ''}
      ${headSelect}
    </article>`;
  el.querySelector('[data-join]')?.addEventListener('click', () => {
    if (banLabel(bannedUntil) && !member) return;
    if (member) openLeaveModal(project, onLeave);
    else if (!joinDisabled(counted, member)) openJoinModal(project, onJoin);
  });
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

export function renderAbsenceDecision(el, absence, { onApprove = null, onReject = null } = {}) {
  el.innerHTML = '';
  if (!absence) {
    el.innerHTML = '<p class="text-red-400">Nicht gefunden.</p>';
    return;
  }
  const wrap = document.createElement('article');
  wrap.className = 'border border-paper/15 p-6';
  const decided = absence.status !== 'pending';
  wrap.innerHTML = `
    <h2 class="font-display text-2xl uppercase">Späte Abmeldung</h2>
    <p class="mt-2 text-sm text-paper/70">${esc(absence.user_name)} hat sich vom Projekt „${esc(absence.project_title)}“ abgemeldet.</p>
    <p class="mt-4 text-xs uppercase tracking-widest text-paper/60">Grund</p>
    <p class="mt-1 border border-paper/15 p-3 text-sm">${esc(absence.reason)}</p>
    ${decided
      ? `<p class="mt-6 border border-paper/20 px-4 py-3 text-sm uppercase tracking-widest text-paper/70">Bereits entschieden: ${esc(absence.status)}</p>`
      : `<div class="mt-6 flex gap-3">
          <button type="button" data-approve class="border border-amber px-4 py-2 text-xs uppercase tracking-widest">Genehmigen</button>
          <button type="button" data-reject class="border border-paper/20 px-4 py-2 text-xs uppercase tracking-widest">Ablehnen</button>
        </div>
        <div data-reject-form hidden class="mt-4">
          <label class="block text-xs uppercase text-paper/60">Begründung der Ablehnung
            <textarea data-note rows="4" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case"></textarea>
          </label>
          <p data-decision-error class="mt-2 text-sm text-red-400"></p>
          <button type="button" data-decide class="mt-3 border border-amber px-4 py-2 text-xs uppercase tracking-widest">Ablehnung senden</button>
        </div>`}`;
  if (!decided) {
    wrap.querySelector('[data-approve]').addEventListener('click', () => onApprove?.(absence.id));
    const form = wrap.querySelector('[data-reject-form]');
    wrap.querySelector('[data-reject]').addEventListener('click', () => {
      form.hidden = false;
    });
    wrap.querySelector('[data-decide]').addEventListener('click', () => {
      const note = wrap.querySelector('[data-note]').value.trim();
      if (!note) {
        wrap.querySelector('[data-decision-error]').textContent = 'Bitte begründe die Ablehnung.';
        return;
      }
      onReject?.(absence.id, note);
    });
  }
  el.append(wrap);
}

export function renderAbsenceDecided(el, { approved }) {
  el.innerHTML = approved
    ? '<p class="border border-amber px-4 py-3 text-sm uppercase tracking-widest text-amber">Genehmigt. Die Person wurde per E-Mail informiert.</p>'
    : '<p class="border border-amber px-4 py-3 text-sm uppercase tracking-widest text-amber">Abgelehnt. Die Person wurde per E-Mail informiert und ist 2 Wochen gesperrt.</p>';
}

export const CALL_SHEET_ROLES = ['Kamera', 'Ton', 'Regie', 'Schnitt', 'Foto', 'Schauspiel', 'Organisation', 'Fahrer'];

export function renderCallSheet(el, { sheet = {}, roles = [] } = {}, { canEdit = false, onEdit = null, onPublish = null } = {}) {
  const published = !!sheet?.published_at;
  const byRole = new Map((roles ?? []).map((r) => [r.role, r]));
  const rows = CALL_SHEET_ROLES.map((role) => {
    const r = byRole.get(role);
    return `<div class="flex justify-between gap-4 border-b border-paper/10 py-2"><dt class="uppercase text-paper/60">${esc(role)}</dt><dd>${r?.user_name ? esc(r.user_name) : '<span class="text-paper/40">unbesetzt</span>'}</dd></div>`;
  }).join('');
  el.innerHTML = `
    <section data-print-area class="mt-8 border border-paper/15 p-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h3 class="font-display text-2xl uppercase">Call Sheet${published ? '' : ' <span class="text-sm text-paper/40">(Entwurf)</span>'}</h3>
        <button type="button" data-print-sheet class="border border-paper/20 px-4 py-2 text-xs uppercase">Drucken</button>
      </div>
      <dl class="mt-4 space-y-1 text-sm">
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Call-Time</dt><dd>${sheet?.call_time ? esc(fmtDate(sheet.call_time)) : '–'}</dd></div>
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Treffpunkt</dt><dd>${sheet?.meeting_point ? esc(sheet.meeting_point) : '–'}</dd></div>
      </dl>
      <h4 class="mt-6 font-display text-xl uppercase">Rollen</h4>
      <dl class="mt-2 text-sm">${rows}</dl>
      <h4 class="mt-6 font-display text-xl uppercase">Tagesablauf</h4>
      <p class="mt-2 whitespace-pre-line text-sm text-paper/70">${sheet?.schedule ? esc(sheet.schedule) : '–'}</p>
      <h4 class="mt-6 font-display text-xl uppercase">Logistik</h4>
      <p class="mt-2 whitespace-pre-line text-sm text-paper/70">${sheet?.logistics ? esc(sheet.logistics) : '–'}</p>
      <h4 class="mt-6 font-display text-xl uppercase">Notfallkontakte</h4>
      <p class="mt-2 whitespace-pre-line text-sm text-paper/70">${sheet?.emergency_contacts ? esc(sheet.emergency_contacts) : '–'}</p>
      ${canEdit ? `<div class="mt-6 flex gap-3">
        <button type="button" data-edit-sheet class="border border-paper/20 px-4 py-2 text-xs uppercase tracking-widest">Bearbeiten</button>
        ${published ? '' : '<button type="button" data-publish-sheet class="border border-amber px-4 py-2 text-xs uppercase tracking-widest">Veröffentlichen</button>'}
      </div>` : ''}
    </section>`;
  el.querySelector('[data-print-sheet]').addEventListener('click', () => window.print());
  el.querySelector('[data-edit-sheet]')?.addEventListener('click', () => onEdit?.());
  el.querySelector('[data-publish-sheet]')?.addEventListener('click', () => onPublish?.());
}

export function renderCallSheetForm(el, { sheet = {}, roles = [], members = [] } = {}, { onSave = null } = {}) {
  const byRole = new Map((roles ?? []).map((r) => [r.role, r?.user_id ?? '']));
  const roleSelects = CALL_SHEET_ROLES.map((role) => `
    <label class="text-xs uppercase text-paper/60">${esc(role)}
      <select data-role="${esc(role)}" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case">
        <option value="">unbesetzt</option>
        ${(members ?? []).map((m) => `<option value="${esc(m.id)}"${byRole.get(role) === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}
      </select>
    </label>`).join('');
  el.innerHTML = `
    <form data-callsheet-form class="mt-8 grid max-w-2xl gap-3 border border-paper/15 p-6">
      <h3 class="font-display text-xl uppercase">Call Sheet bearbeiten</h3>
      <label class="text-xs uppercase text-paper/60">Call-Time
        <input name="call_time" type="datetime-local" value="${esc(toLocalInput(sheet?.call_time))}" class="mt-1 w-full border border-paper/20 bg-transparent p-3" />
      </label>
      <label class="text-xs uppercase text-paper/60">Treffpunkt
        <input name="meeting_point" maxlength="5000" value="${esc(sheet?.meeting_point ?? '').replace(/`/g, '&#96;')}" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
      </label>
      <label class="text-xs uppercase text-paper/60">Tagesablauf
        <textarea name="schedule" rows="4" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case">${esc(sheet?.schedule ?? '')}</textarea>
      </label>
      <label class="text-xs uppercase text-paper/60">Logistik-Infos
        <textarea name="logistics" rows="3" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case">${esc(sheet?.logistics ?? '')}</textarea>
      </label>
      <label class="text-xs uppercase text-paper/60">Notfallkontakte
        <textarea name="emergency_contacts" rows="3" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case">${esc(sheet?.emergency_contacts ?? '')}</textarea>
      </label>
      <div class="grid gap-3 sm:grid-cols-2">${roleSelects}</div>
      <p data-error class="text-sm text-red-400"></p>
      <button class="w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest">Speichern</button>
    </form>`;
  el.querySelector('[data-callsheet-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rawTime = String(fd.get('call_time') ?? '');
    onSave?.({
      call_time: rawTime ? new Date(rawTime).toISOString() : null,
      meeting_point: String(fd.get('meeting_point') ?? ''),
      schedule: String(fd.get('schedule') ?? ''),
      logistics: String(fd.get('logistics') ?? ''),
      emergency_contacts: String(fd.get('emergency_contacts') ?? ''),
      roles: CALL_SHEET_ROLES.map((role) => ({ role, user_id: el.querySelector(`select[data-role="${role}"]`).value || null })),
    });
  });
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

export const ABMELDEFRIST_MS = 3 * 864e5;

export function isLateLeave(project, nowMs = Date.now()) {
  return Date.parse(project.start_at) - ABMELDEFRIST_MS < nowMs;
}

export function deDate(iso) {
  const d = String(iso ?? '');
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
}

export function banLabel(bannedUntil, nowMs = Date.now()) {
  if (!bannedUntil || Date.parse(bannedUntil) <= nowMs) return null;
  return `Gesperrt bis ${deDate(bannedUntil)}`;
}

export function openModal({ title, bodyHTML, confirmLabel, onConfirm }) {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-modal-overlay', '');
  overlay.className = 'fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4';
  overlay.innerHTML = `
    <div role="dialog" aria-modal="true" aria-label="${esc(title)}" class="w-full max-w-md border border-paper/20 bg-ink p-6">
      <h3 class="font-display text-2xl uppercase">${esc(title)}</h3>
      <div class="mt-4 text-sm leading-relaxed text-paper/70">${bodyHTML}</div>
      <p data-modal-error class="mt-2 text-sm text-red-400"></p>
      <div class="mt-6 flex gap-3">
        <button type="button" data-modal-confirm class="border border-amber px-4 py-2 text-xs uppercase tracking-widest">${esc(confirmLabel)}</button>
        <button type="button" data-modal-cancel class="border border-paper/20 px-4 py-2 text-xs uppercase tracking-widest">Abbrechen</button>
      </div>
    </div>`;
  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('[data-modal-cancel]').addEventListener('click', close);
  overlay.querySelector('[data-modal-confirm]').addEventListener('click', () => onConfirm?.({ el: overlay, close }));
  document.body.append(overlay);
  return { el: overlay, close };
}

export function openJoinModal(project, onJoin) {
  openModal({
    title: 'Teilnehmen',
    bodyHTML: `<p>Möchtest du am Projekt „${esc(project.title)}“ teilnehmen?</p>`,
    confirmLabel: 'Teilnahme bestätigen',
    onConfirm: ({ close }) => {
      close();
      onJoin?.(project);
    },
  });
}

export function openLeaveModal(project, onLeave) {
  const late = isLateLeave(project);
  openModal({
    title: 'Abmelden',
    bodyHTML: late
      ? `<p class="border border-red-400/50 px-3 py-2 text-red-400">Die Abmeldefrist (3 Tage vor Beginn) ist abgelaufen. Eine Abmeldung kann Konsequenzen haben – der Vorstand prüft deinen Grund.</p>
        <label class="mt-4 block text-xs uppercase text-paper/60">Warum kannst du nicht teilnehmen?
          <textarea data-reason rows="4" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case"></textarea>
        </label>`
      : `<p>Du kannst dich bis 3 Tage vor Projektbeginn folgenlos abmelden. Möchtest du dich wirklich vom Projekt „${esc(project.title)}“ abmelden?</p>`,
    confirmLabel: 'Abmelden',
    onConfirm: ({ el, close }) => {
      if (!late) {
        close();
        onLeave?.(project, { reason: '' });
        return;
      }
      const reason = el.querySelector('[data-reason]').value.trim();
      if (!reason) {
        el.querySelector('[data-modal-error]').textContent = 'Bitte gib einen Grund an.';
        return;
      }
      close();
      onLeave?.(project, { reason });
    },
  });
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
