import { esc } from './projects.js';
import { formatEuro } from './finanzen.js';

export function renderPack(el, pack, { members = [], onToggleAttendance = null } = {}) {
  el.innerHTML = '';
  const present = new Set((pack.attendance ?? []).filter((r) => r.present).map((r) => r.user_id));
  el.innerHTML = `
    <div class="mb-6 flex flex-wrap items-center gap-4">
      <h2 class="font-display text-3xl uppercase">Jahresbericht ${esc(String(pack.year))}</h2>
      <button type="button" data-print class="border border-paper/20 px-4 py-2 text-xs uppercase">Drucken</button>
    </div>
    <section class="mb-8">
      <h3 class="font-display text-xl uppercase">Mitglieder (${pack.member_count})</h3>
      <p class="mt-2 text-sm text-paper/60">Neu: ${pack.new_members.length ? pack.new_members.map((m) => esc(m.name)).join(', ') : '–'}</p>
    </section>
    <section class="mb-8">
      <h3 class="font-display text-xl uppercase">Projekte (${pack.projects.length})</h3>
      <ul class="mt-2 space-y-1 text-sm">
        ${pack.projects.map((p) => `<li>${esc(p.title)} — ${esc(String(p.start_at).slice(0, 10))} (${p.member_count} dabei)</li>`).join('') || '<li class="text-paper/60">–</li>'}
      </ul>
    </section>
    <section class="mb-8">
      <h3 class="font-display text-xl uppercase">Finanzen</h3>
      <dl class="mt-2 space-y-1 text-sm">
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Fakturiert</dt><dd class="font-semibold">${esc(formatEuro(pack.finance.invoiced_cents))}</dd></div>
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Bezahlt</dt><dd>${esc(formatEuro(pack.finance.paid_cents))}</dd></div>
        <div class="flex justify-between gap-4"><dt class="uppercase text-paper/60">Offen</dt><dd>${esc(formatEuro(pack.finance.open_cents))} (${pack.finance.count_open} Rechnung(en))</dd></div>
      </dl>
    </section>
    <section class="mb-8">
      <h3 class="font-display text-xl uppercase">Offene Rechnungen (${pack.open_invoices.length})</h3>
      <ul class="mt-2 space-y-1 text-sm">
        ${pack.open_invoices.map((r) => `<li>${esc(r.user_name)} — ${esc(r.reason)} (${esc(formatEuro(r.amount_cents))})</li>`).join('') || '<li class="text-paper/60">–</li>'}
      </ul>
    </section>
    <section>
      <h3 class="font-display text-xl uppercase">Anwesenheit</h3>
      <div class="mt-2 grid gap-2">
        ${members.map((m) => `
          <label class="flex items-center gap-3 border border-paper/15 p-3 text-sm">
            <input type="checkbox" data-attendance data-user="${esc(m.id)}"${present.has(m.id) ? ' checked' : ''} />
            ${esc(m.name)}
          </label>`).join('')}
      </div>
    </section>`;
  el.querySelector('[data-print]').addEventListener('click', () => window.print());
  for (const box of el.querySelectorAll('[data-attendance]')) {
    box.addEventListener('change', () => onToggleAttendance?.(box.dataset.user, box.checked));
  }
}
