export function renderMinutes(el, minutes = [], { canUpload = false, canDeleteFor = null, onUpload = null, onDelete = null } = {}) {
  el.innerHTML = '';
  const section = document.createElement('section');
  if (!minutes.length) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-paper/60';
    empty.textContent = 'Noch keine Mitschriften vorhanden.';
    section.append(empty);
  }
  const list = document.createElement('div');
  list.className = 'grid gap-3';
  for (const m of minutes) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-3 border border-paper/15 p-3 text-sm';
    const title = document.createElement('span');
    title.className = 'font-semibold';
    title.textContent = m.title;
    const date = document.createElement('span');
    date.className = 'text-xs uppercase tracking-widest text-paper/60';
    date.textContent = String(m.created_at).slice(0, 10);
    const view = document.createElement('a');
    view.href = `/api/minutes/${m.id}/file`;
    view.target = '_blank';
    view.rel = 'noreferrer';
    view.className = 'border border-amber px-3 py-1 text-xs uppercase';
    view.textContent = 'Ansehen';
    row.append(title, date, view);
    if (canDeleteFor?.(m)) {
      const del = document.createElement('button');
      del.type = 'button';
      del.setAttribute('data-delete', m.id);
      del.className = 'border border-paper/20 px-3 py-1 text-xs uppercase';
      del.textContent = 'Löschen';
      del.addEventListener('click', async () => {
        if (!confirm('Mitschrift wirklich löschen?')) return;
        try {
          await onDelete?.(m);
        } catch (err) {
          status.textContent = err.message;
        }
      });
      row.append(del);
    }
    list.append(row);
  }
  section.append(list);
  if (canUpload) {
    const form = document.createElement('div');
    form.className = 'mt-8 grid max-w-xl gap-3 border border-paper/15 p-6';
    const heading = document.createElement('h3');
    heading.className = 'font-display text-xl uppercase';
    heading.textContent = 'Mitschrift hochladen';
    const titleLabel = document.createElement('label');
    titleLabel.className = 'text-xs uppercase text-paper/60';
    titleLabel.textContent = 'Titel ';
    const titleInput = document.createElement('input');
    titleInput.name = 'title';
    titleInput.required = true;
    titleInput.maxLength = 150;
    titleInput.placeholder = 'z. B. Sitzung Oktober 2026';
    titleInput.className = 'mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case';
    titleLabel.append(titleInput);
    const fileLabel = document.createElement('label');
    fileLabel.className = 'text-xs uppercase text-paper/60';
    fileLabel.textContent = 'PDF-Datei ';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf';
    fileInput.className = 'mt-1 w-full text-sm';
    fileLabel.append(fileInput);
    const hint = document.createElement('p');
    hint.className = 'text-sm text-paper/60';
    hint.textContent = 'Word oder Pages: Teilen → Als PDF exportieren, dann hier hochladen.';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-upload', '');
    btn.className = 'w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest';
    btn.textContent = 'Hochladen';
    btn.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      const file = fileInput.files?.[0];
      if (!title || !file) {
        status.textContent = 'Bitte Titel und PDF-Datei wählen.';
        return;
      }
      btn.disabled = true;
      try {
        await onUpload?.(title, file);
        status.textContent = '';
        titleInput.value = '';
        fileInput.value = '';
      } catch (err) {
        status.textContent = err.message;
      } finally {
        btn.disabled = false;
      }
    });
    form.append(heading, titleLabel, fileLabel, hint, btn);
    section.append(form);
  }
  const status = document.createElement('p');
  status.setAttribute('data-status', '');
  status.className = 'mt-2 text-sm text-paper/60';
  section.append(status);
  el.append(section);
}
