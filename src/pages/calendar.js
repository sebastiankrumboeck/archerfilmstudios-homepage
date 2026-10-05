import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderCalendar } from '../views/calendar.js';

await mountLayout('calendar');
const view = document.querySelector('#app-view');

const params = new URLSearchParams(location.search);
const now = new Date();
const monthParam = params.get('month');
const year = monthParam ? Number(monthParam.split('-')[0]) : now.getUTCFullYear();
const month = monthParam ? Number(monthParam.split('-')[1]) : now.getUTCMonth() + 1;
const monthStr = `${year}-${String(month).padStart(2, '0')}`;

try {
  const { projects } = await api(`/api/calendar?month=${monthStr}`);
  renderCalendar(view, year, month, projects, {
    onMonth: ({ y, m }) => {
      location.search = `?month=${y}-${String(m).padStart(2, '0')}`;
    },
  });
} catch (err) {
  if (err.status === 401) location.href = '/login/';
  else view.innerHTML = `<p class="text-red-400">${err.message}</p>`;
}
