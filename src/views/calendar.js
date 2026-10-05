import { intensityColor } from '../lib/intensity.js';
import { monthSpan } from '../lib/calendar.js';

export function renderCalendar(el, year, month1, projects, { onMonth = null } = {}) {
  el.innerHTML = '';
  const nav = document.createElement('div');
  nav.className = 'mb-4 flex gap-2';
  nav.innerHTML = `<button type="button" data-prev class="border border-paper/20 px-3 py-1">←</button>
    <span class="px-2 py-1 text-sm">${year}-${String(month1).padStart(2, '0')}</span>
    <button type="button" data-next class="border border-paper/20 px-3 py-1">→</button>`;
  nav.querySelector('[data-prev]').addEventListener('click', () => onMonth?.(month1 === 1 ? { y: year - 1, m: 12 } : { y: year, m: month1 - 1 }));
  nav.querySelector('[data-next]').addEventListener('click', () => onMonth?.(month1 === 12 ? { y: year + 1, m: 1 } : { y: year, m: month1 + 1 }));
  el.append(nav);
  const days = new Date(Date.UTC(year, month1, 0)).getUTCDate();
  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-7 gap-1';
  for (let d = 1; d <= days; d++) {
    const cell = document.createElement('div');
    cell.className = 'min-h-16 border border-paper/10 p-1 text-xs';
    cell.innerHTML = `<span class="text-muted">${d}</span>`;
    for (const p of projects) {
      const span = monthSpan(p.start_at, p.end_at, year, month1);
      if (span && d >= span.startDay && d < span.startDay + span.span) {
        const bar = document.createElement('div');
        bar.className = 'mt-1 truncate px-1 py-0.5 text-[11px]';
        bar.style.background = intensityColor(p.intensity);
        bar.style.color = '#151412';
        bar.title = `${p.title} (${p.start_at} → ${p.end_at})`;
        bar.textContent = p.title;
        cell.append(bar);
      }
    }
    grid.append(cell);
  }
  const list = document.createElement('ul');
  list.className = 'sr-only';
  for (const p of projects) list.innerHTML += `<li>${p.title}: ${p.start_at} bis ${p.end_at}</li>`;
  el.append(grid, list);
}
