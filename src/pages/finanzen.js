import { mountLayout } from '../layout.js';
import { api } from '../api/client.js';
import { renderAllInvoices, renderForbidden, renderInvoiceDetail, renderInvoiceForm, renderMyInvoices, renderOpenItems, renderSummary } from '../views/finanzen.js';

await mountLayout('finanzen');
const view = document.querySelector('#app-view');
const params = new URLSearchParams(location.search);

function showError(err) {
  if (err.status === 401) location.href = '/login/';
  else if (err.status === 403) renderForbidden(view);
  else view.innerHTML = `<p class="text-red-400">${err.message}</p>`;
}

async function showDetail(id, kassier) {
  const data = kassier ? await api('/api/invoices') : await api('/api/invoices/me');
  const inv = data.invoices.find((r) => r.id === id);
  if (!inv) {
    view.innerHTML = '<p class="text-red-400">Rechnung nicht gefunden.</p>';
    return;
  }
  let name = inv.user_name;
  if (!name) {
    try {
      ({ user: { name } } = await api('/api/me'));
    } catch {
      name = inv.user_id;
    }
  }
  renderInvoiceDetail(view, { invoice: inv, memberName: name }, {
    canSend: kassier,
    onSend: async (invoice) => {
      await api(`/api/invoices/${invoice.id}/send`, { method: 'POST', body: '{}' });
    },
  });
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'mt-6 border border-paper/20 px-4 py-2 text-xs uppercase';
  backBtn.textContent = 'Zurück';
  backBtn.addEventListener('click', () => {
    location.search = '';
  });
  view.append(backBtn);
}

async function showMine() {
  const data = await api('/api/invoices/me');
  renderMyInvoices(view, data.invoices, {
    onOpen: (inv) => {
      location.search = `?id=${encodeURIComponent(inv.id)}`;
    },
  });
  if (!data.invoices.length) {
    const hint = document.createElement('p');
    hint.className = 'mt-4 text-sm text-paper/60';
    hint.textContent = 'Dein erstes Beitrittsjahr ist gratis — ab dem nächsten Jahr findest du hier deine Rechnungen über 12,00 € pro Jahr.';
    view.append(hint);
  }
}

async function showAll(filter = {}) {
  view.innerHTML = '';
  const query = new URLSearchParams();
  if (filter.status) query.set('status', filter.status);
  if (filter.year) query.set('year', filter.year);
  if (filter.method) query.set('method', filter.method);
  const suffix = query.toString() ? `?${query}` : '';
  const data = await api(`/api/invoices${suffix}`);
  const { users } = await api('/api/users');
  renderInvoiceForm(view, { users, onCreate: (invoice, email) => {
    if (email && !email.sent) alert(`Rechnung erstellt, aber E-Mail fehlgeschlagen: ${email.error ?? 'unbekannt'}`);
    showAll(filter);
  } });
  const openBox = document.createElement('div');
  openBox.className = 'mt-8 border border-paper/15 p-6';
  try {
    const openData = await api('/api/invoices?status=open');
    renderOpenItems(openBox, openData.invoices, {
      onRemind: async (inv) => {
        await api(`/api/invoices/${inv.id}/send`, { method: 'POST', body: '{}' });
      },
    });
  } catch (err) {
    const p = document.createElement('p');
    p.className = 'text-sm text-red-400';
    p.textContent = err.message;
    openBox.append(p);
  }
  view.append(openBox);
  const summaryBox = document.createElement('div');
  summaryBox.className = 'mt-8 border border-paper/15 p-6';
  try {
    const summaryYear = filter.year || new Date().getFullYear();
    const summaryData = await api(`/api/invoices/summary?year=${summaryYear}`);
    renderSummary(summaryBox, summaryData.summary);
  } catch (err) {
    const p = document.createElement('p');
    p.className = 'text-sm text-red-400';
    p.textContent = err.message;
    summaryBox.append(p);
  }
  view.append(summaryBox);
  const list = document.createElement('div');
  list.className = 'mt-8';
  renderAllInvoices(list, data.invoices, {    status: filter.status ?? '',
    year: filter.year ?? '',
    method: filter.method ?? '',
    onFilter: (next) => showAll(next),
    onOpen: (inv) => {
      location.search = `?id=${encodeURIComponent(inv.id)}`;
    },
    onPay: async (inv, method) => {
      try {
        await api(`/api/invoices/${inv.id}/pay`, { method: 'PATCH', body: JSON.stringify({ method }) });
        await showAll(filter);
      } catch (err) {
        alert(err.message);
      }
    },
    onCancel: async (inv) => {
      if (!confirm(`Rechnung "${inv.reason}" wirklich stornieren?`)) return;
      try {
        await api(`/api/invoices/${inv.id}/cancel`, { method: 'PATCH', body: '{}' });
        await showAll(filter);
      } catch (err) {
        alert(err.message);
      }
    },
  });
  view.append(list);
  const gen = document.createElement('div');
  gen.className = 'mt-8 border border-paper/15 p-6';
  gen.innerHTML = `
    <h3 class="font-display text-xl uppercase">Jahresrechnungen erzeugen</h3>
    <p class="mt-2 text-sm text-paper/60">Erstellt 12,00-€-Rechnungen für alle beitragspflichtigen Mitglieder ohne vorhandene Jahresrechnung.</p>
    <p data-error class="text-sm text-red-400"></p>
    <button type="button" data-generate class="mt-3 w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest">Für ${new Date().getFullYear()} erzeugen</button>`;
  gen.querySelector('[data-generate]').addEventListener('click', async () => {
    try {
      const data = await api('/api/invoices/generate', { method: 'POST', body: '{}' });
      alert(`${data.created} Rechnung(en) erstellt.`);
      await showAll(filter);
    } catch (err) {
      gen.querySelector('[data-error]').textContent = err.message;
    }
  });
  view.append(gen);
}

try {
  const id = params.get('id');
  let me = null;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  const kassier = !!me?.is_kassier;
  if (id) await showDetail(id, kassier);
  else if (kassier) await showAll();
  else await showMine();
} catch (err) {
  showError(err);
}
