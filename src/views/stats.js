export function renderStats(el, stats) {
  el.innerHTML = '';
  const max = Math.max(1, ...stats.joins_by_year.map((r) => r.count));
  el.innerHTML = `
    <h2 class="font-display text-2xl uppercase">Statistiken</h2>
    <dl class="mt-4 grid gap-3 sm:grid-cols-4">
      <div class="border border-paper/15 p-4"><dt class="text-xs uppercase text-paper/60">Mitglieder</dt><dd class="font-display text-3xl">${stats.total_members}</dd></div>
      <div class="border border-paper/15 p-4"><dt class="text-xs uppercase text-paper/60">Neu dieses Jahr</dt><dd class="font-display text-3xl">${stats.new_this_year}</dd></div>
      <div class="border border-paper/15 p-4"><dt class="text-xs uppercase text-paper/60">Projekte dieses Jahr</dt><dd class="font-display text-3xl">${stats.projects_this_year}</dd></div>
      <div class="border border-paper/15 p-4"><dt class="text-xs uppercase text-paper/60">Teilnahmen dieses Jahr</dt><dd class="font-display text-3xl">${stats.participations_this_year}</dd></div>
    </dl>
    <h3 class="mt-8 font-display text-xl uppercase">Beitritte pro Jahr</h3>
    <div class="mt-2 grid gap-2">
      ${stats.joins_by_year.map((r) => `
        <div class="flex items-center gap-3 text-sm">
          <span class="w-12 text-paper/60">${r.year}</span>
          <span data-year-bar class="block h-4 bg-amber" style="width:${Math.round((r.count / max) * 100)}%"></span>
          <span>${r.count}</span>
        </div>`).join('') || '<p class="text-sm text-paper/60">–</p>'}
    </div>
    <h3 class="mt-8 font-display text-xl uppercase">Länger nicht dabei</h3>
    <div class="mt-2 grid gap-2">
      ${stats.inactive.map((m) => `
        <div class="flex flex-wrap items-center gap-3 border border-paper/15 p-3 text-sm" data-inactive="${m.id}">
          <span class="font-semibold">${escapeHtml(m.name)}</span>
          <span class="text-xs uppercase tracking-widest text-paper/60">${escapeHtml(m.last_active)}</span>
        </div>`).join('') || '<p class="text-sm text-paper/60">Alle dabei. ✓</p>'}
    </div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
