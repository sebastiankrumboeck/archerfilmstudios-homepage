import { buildMailto } from '../lib/calendar.js';
import { SOCIALS } from '../data/socials.js';

export function renderContact(el) {
  el.innerHTML = `
    <form class="max-w-xl space-y-4" data-contact-form>
      <input name="subject" required placeholder="Subject" class="w-full border border-paper/20 bg-transparent p-3" />
      <textarea name="body" required placeholder="Message" rows="5" class="w-full border border-paper/20 bg-transparent p-3"></textarea>
      <button class="border border-amber px-5 py-3 text-xs uppercase tracking-widest">Write email</button>
    </form>
    <p class="mt-6"><a class="text-amber" href="mailto:${SOCIALS.email}">${SOCIALS.email}</a></p>
    <p class="mt-2 text-sm"><a class="hover:text-amber" href="${SOCIALS.instagram}" target="_blank" rel="noreferrer">Instagram @archerfilmstudios ↗</a></p>`;
  el.querySelector('[data-contact-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    window.location.href = buildMailto({ subject: String(fd.get('subject')), body: String(fd.get('body')) });
  });
}
