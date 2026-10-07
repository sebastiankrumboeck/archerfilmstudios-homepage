export function renderArchive(el, documents = [], { onUpload = null, onDelete = null } = {}) {
  el.innerHTML = '';
  const hint = document.createElement('p');
  hint.className = 'mb-6 text-sm text-paper/60';
  hint.textContent = 'Nur für den Vorstand sichtbar.';
  el.append(hint);
  if (!documents.length) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-paper/60';
    empty.textContent = 'Noch keine Dokumente vorhanden.';
    el.append(empty);
  }
  const list = document.createElement('div');
  list.className = 'grid gap-3';
  for (const d of documents) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-3 border border-paper/15 p-3 text-sm';
    const title = document.createElement('span');
    title.className = 'font-semibold';
    title.textContent = d.title;
    const date = document.createElement('span');
    date.className = 'text-xs uppercase tracking-widest text-paper/60';
    date.textContent = String(d.created_at).slice(0, 10);
    const link = document.createElement('a');
    link.href = `/api/archive/${d.id}/file`;
    link.className = 'border border-amber px-3 py-1 text-xs uppercase';
    link.textContent = 'Herunterladen';
    const del = document.createElement('button');
    del.type = 'button';
    del.setAttribute('data-delete', d.id);
    del.className = 'border border-paper/20 px-3 py-1 text-xs uppercase';
    del.textContent = 'Löschen';
    del.addEventListener('click', async () => {
      if (!confirm('Dokument wirklich löschen?')) return;
      try {
        await onDelete?.(d);
      } catch (err) {
        status.textContent = err.message;
      }
    });
    row.append(title, date, link, del);
    list.append(row);
  }
  el.append(list);
  const form = document.createElement('div');
  form.className = 'mt-8 grid max-w-xl gap-3 border border-paper/15 p-6';
  const heading = document.createElement('h3');
  heading.className = 'font-display text-xl uppercase';
  heading.textContent = 'Dokument hochladen';
  const titleLabel = document.createElement('label');
  titleLabel.className = 'text-xs uppercase text-paper/60';
  titleLabel.textContent = 'Titel ';
  const titleInput = document.createElement('input');
  titleInput.name = 'title';
  titleInput.required = true;
  titleInput.maxLength = 150;
  titleInput.className = 'mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case';
  titleLabel.append(titleInput);
  const fileLabel = document.createElement('label');
  fileLabel.className = 'text-xs uppercase text-paper/60';
  fileLabel.textContent = 'Datei (PDF, Word, Bild, max. 10MB) ';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf,.docx,image/jpeg,image/png,image/webp';
  fileInput.className = 'mt-1 w-full text-sm';
  fileLabel.append(fileInput);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('data-upload', '');
  btn.className = 'w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest';
  btn.textContent = 'Hochladen';
  btn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const file = fileInput.files?.[0];
    if (!title || !file) {
      status.textContent = 'Bitte Titel und Datei wählen.';
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
  form.append(heading, titleLabel, fileLabel, btn);
  el.append(form);
  const status = document.createElement('p');
  status.setAttribute('data-status', '');
  status.className = 'mt-2 text-sm text-paper/60';
  el.append(status);
}
