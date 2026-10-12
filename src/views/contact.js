import { api } from '../api/client.js';
import { SOCIALS } from '../data/socials.js';
import { isValidEmail } from '../lib/validators.js';
import { t } from '../i18n/index.js';

export function renderContact(el) {
  el.innerHTML = `
    <p class="mb-8 max-w-xl text-paper/70">${t('contact.intro')}</p>
    <form class="max-w-xl space-y-4" data-contact-form>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="text-xs uppercase text-paper/60">Name
          <input name="name" required maxlength="100" placeholder="${t('contact.namePh')}" autocomplete="name" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
        </label>
        <label class="text-xs uppercase text-paper/60">${t('contact.email')}
          <input name="email" type="email" required placeholder="you@example.com" autocomplete="email" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
        </label>
      </div>
      <label class="block text-xs uppercase text-paper/60">${t('contact.subject')}
        <input name="subject" required maxlength="150" placeholder="${t('contact.subjectPh')}" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
      </label>
      <label class="block text-xs uppercase text-paper/60">${t('contact.message')}
        <textarea name="message" required rows="5" placeholder="${t('contact.messagePh')}" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case"></textarea>
      </label>
      <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" />
      <p data-status class="text-sm text-paper/60"></p>
      <button class="border border-amber px-5 py-3 text-xs uppercase tracking-widest">${t('contact.send')}</button>
    </form>
    <p class="mt-6 text-sm text-paper/60">${t('contact.mailapp')} <a class="text-amber" href="mailto:${SOCIALS.email}">${SOCIALS.email}</a></p>
    <p class="mt-2 text-sm"><a class="hover:text-amber" href="${SOCIALS.instagram}" target="_blank" rel="noreferrer">Instagram @archerfilmstudios ↗</a></p>`;
  const form = el.querySelector('[data-contact-form]');
  const status = el.querySelector('[data-status]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      subject: String(fd.get('subject') ?? '').trim(),
      message: String(fd.get('message') ?? '').trim(),
      website: String(fd.get('website') ?? ''),
    };
    if (!payload.name || !isValidEmail(payload.email) || !payload.subject || !payload.message) {
      status.textContent = t('contact.invalid');
      return;
    }
    const btn = form.querySelector('button');
    btn.disabled = true;
    status.textContent = t('contact.sending');
    try {
      await api('/api/contact', { method: 'POST', body: JSON.stringify(payload) });
      status.textContent = t('contact.done');
      form.reset();
    } catch (err) {
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

export function rerenderContact(el) {
  const vals = {};
  const form = el.querySelector('[data-contact-form]');
  if (form) {
    for (const [k, v] of new FormData(form).entries()) vals[k] = String(v ?? '');
  }
  renderContact(el);
  for (const [k, v] of Object.entries(vals)) {
    const field = el.querySelector(`[name="${k}"]`);
    if (field && v) field.value = v;
  }
}
