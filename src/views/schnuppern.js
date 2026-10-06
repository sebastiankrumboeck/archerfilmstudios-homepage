import { api } from '../api/client.js';
import { isValidEmail } from '../lib/validators.js';

export function renderTrialForm(el, { onSignup = null } = {}) {
  el.innerHTML = `
    <form class="max-w-xl space-y-4" data-trial-form>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="text-xs uppercase text-paper/60">Name
          <input name="name" required maxlength="100" placeholder="Your name" autocomplete="name" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
        </label>
        <label class="text-xs uppercase text-paper/60">Email
          <input name="email" type="email" required placeholder="you@example.com" autocomplete="email" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
        </label>
      </div>
      <label class="block text-xs uppercase text-paper/60">Note
        <textarea name="note" rows="4" maxlength="1000" placeholder="Anything we should know? (optional)" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case"></textarea>
      </label>
      <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" />
      <p data-status class="text-sm text-paper/60"></p>
      <button class="border border-amber px-5 py-3 text-xs uppercase tracking-widest">Sign me up</button>
    </form>`;
  const form = el.querySelector('[data-trial-form]');
  const status = el.querySelector('[data-status]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      note: String(fd.get('note') ?? '').trim(),
      website: String(fd.get('website') ?? ''),
    };
    if (!payload.name || !isValidEmail(payload.email)) {
      status.textContent = 'Please fill in your name, a valid email address.';
      return;
    }
    const btn = form.querySelector('button');
    btn.disabled = true;
    status.textContent = 'Sending…';
    try {
      const data = await api('/api/trial-signups', { method: 'POST', body: JSON.stringify(payload) });
      status.textContent = 'Thank you! We will invite you to the next Schnuppern meetup.';
      form.reset();
      onSignup?.(data.signup);
    } catch (err) {
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}
