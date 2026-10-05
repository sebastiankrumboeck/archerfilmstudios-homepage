import { api } from '../api/client.js';

export function renderAuth(el, mode, onDone) {
  const isRegister = mode === 'register';
  el.innerHTML = `
    <form class="max-w-md space-y-4" data-auth-form>
      ${isRegister ? '<input name="name" required placeholder="Name" class="w-full border border-paper/20 bg-transparent p-3" /><input name="function" list="functions" placeholder="Role in the club" class="w-full border border-paper/20 bg-transparent p-3" /><datalist id="functions"><option>Camera</option><option>Directing</option><option>Editing</option><option>Sound</option><option>Photo</option><option>Organization</option><option>Acting</option></datalist>' : ''}
      <input name="email" type="email" required placeholder="Email" class="w-full border border-paper/20 bg-transparent p-3" />
      <input name="password" type="password" required minlength="8" placeholder="Password (min 8 characters)" class="w-full border border-paper/20 bg-transparent p-3" />
      ${isRegister ? '<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" class="w-full border border-paper/20 bg-transparent p-3" /><p class="text-xs text-paper/60">Tip: save a photo from <a class="text-amber" href="https://instagram.com/archerfilmstudios" target="_blank" rel="noreferrer">instagram.com/archerfilmstudios</a> and upload it here.</p>' : ''}
      <p data-error class="text-sm text-red-400"></p>
      <button class="border border-amber px-5 py-3 text-xs uppercase tracking-widest">${isRegister ? 'Register' : 'Log in'}</button>
    </form>`;
  el.querySelector('[data-auth-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = isRegister
        ? await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), function: fd.get('function'), email: fd.get('email'), password: fd.get('password') }) })
        : await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }) });
      onDone?.(data.user);
      const file = fd.get('avatar');
      if (isRegister && file && file.size > 0) {
        if (file.size > 2 * 1024 * 1024) throw new Error('Image too large (max 2MB).');
        await fetch('/api/users/me/avatar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': file.type }, body: file });
      }
      if (!onDone) location.href = '/projects/';
    } catch (err) {
      el.querySelector('[data-error]').textContent = err.message;
    }
  });
}
