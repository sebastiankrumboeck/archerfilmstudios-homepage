export function renderDecisions(el, decisions = [], { canManage = false, onAdd = null, onDelete = null } = {}) {
  el.innerHTML = '';
  const section = document.createElement('section');
  section.className = 'mt-12';
  const title = document.createElement('h2');
  title.className = 'font-display text-2xl uppercase';
  title.textContent = 'Beschlüsse';
  section.append(title);
  if (!decisions.length) {
    const empty = document.createElement('p');
    empty.className = 'mt-2 text-sm text-paper/60';
    empty.textContent = 'Noch keine Beschlüsse vorhanden.';
    section.append(empty);
  }
  const list = document.createElement('div');
  list.className = 'mt-4 grid gap-3';
  for (const d of decisions) {
    const row = document.createElement('div');
    row.className = 'border border-paper/15 p-4';
    const head = document.createElement('div');
    head.className = 'flex flex-wrap items-center gap-3 text-sm';
    const name = document.createElement('span');
    name.className = 'font-semibold';
    name.textContent = d.title;
    const date = document.createElement('span');
    date.className = 'text-xs uppercase tracking-widest text-paper/60';
    date.textContent = String(d.decided_at).slice(0, 10);
    head.append(name, date);
    if (canManage) {
      const del = document.createElement('button');
      del.type = 'button';
      del.setAttribute('data-delete', d.id);
      del.className = 'border border-paper/20 px-3 py-1 text-xs uppercase';
      del.textContent = 'Löschen';
      del.addEventListener('click', async () => {
        if (!confirm('Beschluss wirklich löschen?')) return;
        await onDelete?.(d);
      });
      head.append(del);
    }
    row.append(head);
    if (d.detail) {
      const detail = document.createElement('p');
      detail.className = 'mt-2 text-sm text-paper/70';
      detail.textContent = d.detail;
      row.append(detail);
    }
    list.append(row);
  }
  section.append(list);
  if (canManage) {
    const form = document.createElement('form');
    form.setAttribute('data-decision-form', '');
    form.className = 'mt-4 grid max-w-xl gap-3 border border-paper/15 p-6';
    const titleLabel = document.createElement('label');
    titleLabel.className = 'text-xs uppercase text-paper/60';
    titleLabel.textContent = 'Titel ';
    const titleInput = document.createElement('input');
    titleInput.name = 'title';
    titleInput.required = true;
    titleInput.maxLength = 150;
    titleInput.className = 'mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case';
    titleLabel.append(titleInput);
    const detailLabel = document.createElement('label');
    detailLabel.className = 'text-xs uppercase text-paper/60';
    detailLabel.textContent = 'Details ';
    const detailInput = document.createElement('textarea');
    detailInput.name = 'detail';
    detailInput.rows = 3;
    detailInput.maxLength = 2000;
    detailInput.className = 'mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case';
    detailLabel.append(detailInput);
    const dateLabel = document.createElement('label');
    dateLabel.className = 'text-xs uppercase text-paper/60';
    dateLabel.textContent = 'Beschlossen am ';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.name = 'decided_at';
    dateInput.required = true;
    dateInput.value = new Date().toISOString().slice(0, 10);
    dateInput.className = 'mt-1 w-full border border-paper/20 bg-transparent p-3';
    dateLabel.append(dateInput);
    const btn = document.createElement('button');
    btn.className = 'w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest';
    btn.textContent = 'Beschluss speichern';
    form.append(titleLabel, detailLabel, dateLabel, btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      btn.disabled = true;
      try {
        await onAdd?.({
          title: String(fd.get('title') ?? '').trim(),
          detail: String(fd.get('detail') ?? '').trim(),
          decided_at: String(fd.get('decided_at') ?? '').trim(),
        });
      } finally {
        btn.disabled = false;
      }
    });
    section.append(form);
  }
  el.append(section);
}
