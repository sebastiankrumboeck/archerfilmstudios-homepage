import { esc } from './projects.js';

export function renderIdeaForm(el, { onSubmit = null } = {}) {
  el.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'grid max-w-2xl gap-3 border border-paper/15 p-6';
  form.innerHTML = `
    <h3 class="font-display text-xl uppercase">Idee einreichen</h3>
    <label class="text-xs uppercase text-paper/60">Titel
      <input name="title" required maxlength="150" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
    </label>
    <label class="text-xs uppercase text-paper/60">Autor
      <input name="author_name" required maxlength="100" class="mt-1 w-full border border-paper/20 bg-transparent p-3 normal-case" />
    </label>
    <label class="text-xs uppercase text-paper/60">Skript (PDF, max. 40 MB)
      <input name="script" type="file" accept="application/pdf" class="mt-1 w-full border border-paper/20 bg-transparent p-3" />
    </label>
    <p data-error class="text-sm text-red-400"></p>
    <button class="w-fit border border-amber px-5 py-3 text-xs uppercase tracking-widest">Absenden</button>`;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const file = form.querySelector('[name="script"]').files?.[0];
    if (!file) {
      form.querySelector('[data-error]').textContent = 'Bitte wähle ein Skript als PDF-Datei.';
      return;
    }
    onSubmit?.({ title: String(fd.get('title') ?? ''), author_name: String(fd.get('author_name') ?? ''), file });
  });
  el.append(form);
}

export function renderOwnIdeas(el, ideas = []) {
  const box = document.createElement('section');
  box.className = 'mt-8';
  const title = document.createElement('h3');
  title.className = 'font-display text-xl uppercase';
  title.textContent = 'Meine Einreichungen';
  box.append(title);
  if (!ideas.length) {
    const empty = document.createElement('p');
    empty.className = 'mt-2 text-sm text-paper/60';
    empty.textContent = 'Noch keine Ideen eingereicht.';
    box.append(empty);
  }
  const list = document.createElement('ul');
  list.className = 'mt-4 space-y-2';
  for (const idea of ideas) {
    const li = document.createElement('li');
    li.className = 'flex justify-between gap-4 border border-paper/15 px-4 py-3 text-sm';
    li.innerHTML = `<span>${esc(idea.title)}</span><span class="text-paper/60">${esc(String(idea.created_at ?? '').slice(0, 10))}</span>`;
    list.append(li);
  }
  box.append(list);
  el.append(box);
}
