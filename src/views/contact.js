import { api } from '../api/client.js';
import { SOCIALS } from '../data/socials.js';
import { isValidEmail } from '../lib/validators.js';

export function renderContact(el) {
  el.innerHTML = `
    <p class="mb-8 max-w-xl text-paper/70">Want to join a shoot, collaborate on a project, or just say hi? Send us a message — it lands directly in our inbox and we usually reply within a couple of days.</p>
    <form class="max-w-xl space-y-4" data-contact-form>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="text-xs uppercase text-paper/60">Name
          <input name="name" required maxlength="100" placeholder="Your name" autocomplete="name" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
        </label>
        <label class="text-xs uppercase text-paper/60">Email
          <input name="email" type="email" required placeholder="you@example.com" autocomplete="email" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
        </label>
      </div>
      <label class="block text-xs uppercase text-paper/60">Subject
        <input name="subject" required maxlength="150" placeholder="What is it about?" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
      </label>
      <label class="block text-xs uppercase text-paper/60">Message
        <textarea name="message" required rows="5" placeholder="Tell us more…" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case"></textarea>
      </label>
      <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" />
      <p data-status class="text-sm text-paper/60"></p>
      <button class="border border-amber px-5 py-3 text-xs uppercase tracking-widest">Send message</button>
    </form>
    <p class="mt-6 text-sm text-paper/60">Prefer your own mail app? <a class="text-amber" href="mailto:${SOCIALS.email}">${SOCIALS.email}</a></p>
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
      status.textContent = 'Please fill in your name, a valid email address, a subject and a message.';
      return;
    }
    const btn = form.querySelector('button');
    btn.disabled = true;
    status.textContent = 'Sending…';
    try {
      await api('/api/contact', { method: 'POST', body: JSON.stringify(payload) });
      status.textContent = 'Thank you for your message! We will get back to you soon.';
      form.reset();
    } catch (err) {
      status.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}
