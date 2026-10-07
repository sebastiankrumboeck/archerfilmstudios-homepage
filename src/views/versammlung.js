import { esc } from './projects.js';
import { formatEuro } from './finanzen.js';

export function renderAssemblies(el, assemblies = [], { selectedId = null, onSelect = null, onCreate = null, minutes = [], linkedMinutesId = null, onLinkMinutes = null } = {}) {
  el.innerHTML = '';
  const heading = document.createElement('h2');
  heading.className = 'font-display text-2xl uppercase';
  heading.textContent = 'Versammlungen';
  el.append(heading);
  const list = document.createElement('div');
  list.className = 'mt-2 grid gap-2';
  for (const a of assemblies) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-select', a.id);
    btn.className = `border p-3 text-left text-sm transition-colors hover:border-amber${a.id === selectedId ? ' border-amber' : ' border-paper/15'}`;
    if (a.id === selectedId) btn.setAttribute('aria-current', 'true');
    btn.textContent = `${a.title} — ${String(a.held_on).slice(0, 10)}`;
    btn.addEventListener('click', () => onSelect?.(a.id));
    list.append(btn);
  }
  el.append(list);
  const form = document.createElement('form');
  form.setAttribute('data-assembly-form', '');
  form.className = 'mt-4 grid max-w-xl gap-3 border border-paper/15 p-6';
  form.innerHTML = `
    <h3 class="font-display text-xl uppercase">Neue Versammlung</h3>
    <label class="text-xs uppercase text-paper/60">Titel
      <input name="title" required maxlength="150" value="Generalversammlung" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
    </label>
    <label class="text-xs uppercase text-paper/60">Datum
      <input name="held_on" type="date" required value="${new Date().toISOString().slice(0, 10)}" class="mt-1 w-full border border-paper/20 bg-transparent p-3" />
    </label>
    <p data-error class="text-sm text-red-400"></p>
    <button class="w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest">Erstellen</button>`;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onCreate?.({ title: String(fd.get('title') ?? '').trim(), held_on: String(fd.get('held_on') ?? '').trim() });
  });
  el.append(form);
  const minutesBox = document.createElement('div');
  minutesBox.className = 'mt-6';
  if (linkedMinutesId) {
    minutesBox.innerHTML = `<a class="border border-amber px-4 py-2 text-xs uppercase" href="/api/minutes/${encodeURIComponent(linkedMinutesId)}/file" target="_blank" rel="noreferrer">Mitschrift ansehen</a>`;
  } else if (minutes.length) {
    minutesBox.innerHTML = `
      <label class="text-xs uppercase text-paper/60">Mitschrift
        <select data-minutes class="ml-2 border border-paper/20 bg-transparent p-2 text-sm">
          ${minutes.map((m) => `<option value="${esc(m.id)}">${esc(m.title)}</option>`).join('')}
        </select>
      </label>
      <button type="button" data-link-minutes class="ml-2 border border-paper/20 px-4 py-2 text-xs uppercase">Verknüpfen</button>`;
    minutesBox.querySelector('[data-link-minutes]').addEventListener('click', () => {
      onLinkMinutes?.(minutesBox.querySelector('[data-minutes]').value);
    });
  } else {
    minutesBox.innerHTML = '<p class="text-sm text-paper/60">Noch keine Mitschrift verknüpft.</p>';
  }
  el.append(minutesBox);
}

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
