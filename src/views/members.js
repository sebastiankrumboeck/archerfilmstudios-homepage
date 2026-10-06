import { esc } from './projects.js';

export function memberAvatar(user, cls = 'h-12 w-12') {
  if (user.avatar_r2_key) {
    return `<img src="/avatars/${user.avatar_r2_key.replace(/^avatars\//, '')}" alt="${esc(user.name)}" class="${cls} rounded-full object-cover" loading="lazy" />`;
  }
  return `<span class="grid ${cls} place-items-center rounded-full bg-ink-soft text-lg">${esc((user.name ?? '?')[0])}</span>`;
}

export function matchMember(user, query = '') {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  return `${user.name ?? ''} ${user.function ?? ''}`.toLowerCase().includes(q);
}

export function renderMemberList(el, users = [], { onSearch = null } = {}) {
  el.innerHTML = '';
  const search = document.createElement('input');
  search.setAttribute('data-member-search', '');
  search.type = 'search';
  search.placeholder = 'Search members…';
  search.className = 'mb-4 w-full max-w-md border border-paper/20 bg-transparent p-3';
  search.addEventListener('input', () => onSearch?.(search.value));
  el.append(search);
  if (!users.length) {
    el.innerHTML += '<p class="text-paper/60">No members yet.</p>';
    return;
  }
  const list = document.createElement('div');
  list.className = 'grid gap-4';
  for (const u of users) {
    const row = document.createElement('a');
    row.href = `/members/?id=${encodeURIComponent(u.id)}`;
    row.className = 'flex items-center gap-4 border border-paper/15 p-4 transition-colors hover:border-amber';
    row.innerHTML = `
      ${memberAvatar(u)}
      <span>
        <span class="block font-display text-xl uppercase">${esc(u.name)}</span>
        <span class="block text-sm text-paper/60">${esc(u.function ?? '')}</span>
      </span>`;
    list.append(row);
  }
  el.append(list);
}

export function renderMemberDetail(el, data) {
  el.innerHTML = '';
  if (!data?.user) {
    el.innerHTML = '<p class="text-red-400">Member not found.</p>';
    return;
  }
  const { user, projects } = data;
  const joined = projects?.joined ?? [];
  const headed = projects?.headed ?? [];
  const projectLinks = (items) => items.length
    ? `<ul class="mt-2 space-y-1">${items.map((p) => `<li><a class="text-amber" href="/projects/?id=${encodeURIComponent(p.id)}">${esc(p.title)}</a></li>`).join('')}</ul>`
    : '<p class="mt-2 text-sm text-paper/60">None yet.</p>';
  el.innerHTML = `
    <article class="border border-paper/15 p-6">
      ${memberAvatar(user, 'h-24 w-24')}
      <h2 class="mt-4 font-display text-3xl uppercase">${esc(user.name)}</h2>
      <p class="text-sm uppercase tracking-widest text-paper/60">${esc(user.function ?? '')}</p>
      ${user.is_vorstand ? `<p class="mt-1 text-sm uppercase text-amber">${esc(user.vorstand_title ?? 'Board')}</p>` : ''}
      <div class="mt-6 grid gap-6 sm:grid-cols-2">
        <section><h3 class="font-display text-xl uppercase">Projects</h3>${projectLinks(joined)}</section>
        <section><h3 class="font-display text-xl uppercase">Heads</h3>${projectLinks(headed)}</section>
      </div>
    </article>`;
}

export function renderOwnProfileForm(el, user, { onSave = null, onSaved = null } = {}) {
  const wrap = document.createElement('form');
  wrap.setAttribute('data-profile-form', '');
  wrap.className = 'mt-8 grid max-w-md gap-3 border border-paper/15 p-6';
  wrap.innerHTML = `
    <h3 class="font-display text-xl uppercase">Edit your profile</h3>
    <input name="name" required value="${esc(user.name ?? '').replace(/`/g, '&#96;')}" placeholder="Name" class="border border-paper/20 bg-transparent p-3" />
    <input name="function" value="${esc(user.function ?? '').replace(/`/g, '&#96;')}" placeholder="Role in the club" class="border border-paper/20 bg-transparent p-3" />
    <label class="text-xs uppercase text-paper/60">Photo <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" /></label>
    <p data-error class="text-sm text-red-400"></p>
    <button class="w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest">Save profile</button>`;
  wrap.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(wrap);
    const errEl = wrap.querySelector('[data-error]');
    try {
      const data = await onSave?.({ name: fd.get('name'), function: fd.get('function') });
      const file = wrap.querySelector('[name="avatar"]').files?.[0];
      if (file && file.size > 0) {
        if (file.size > 2 * 1024 * 1024) throw new Error('Image too large (max 2MB).');
        const res = await fetch('/api/users/me/avatar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': file.type }, body: file });
        if (!res.ok) throw new Error(`Photo upload failed (${res.status}).`);
      }
      onSaved?.(data);
      return data;
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
  el.append(wrap);
}
