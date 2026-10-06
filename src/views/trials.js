export function renderTrialList(el, signups = [], { onContacted = null } = {}) {
  el.innerHTML = '';
  const section = document.createElement('section');
  section.className = 'mt-12';
  const title = document.createElement('h2');
  title.className = 'font-display text-2xl uppercase';
  title.textContent = 'Trial signups';
  section.append(title);
  if (!signups.length) {
    const empty = document.createElement('p');
    empty.className = 'mt-2 text-sm text-paper/60';
    empty.textContent = 'No trial signups yet.';
    section.append(empty);
    el.append(section);
    return;
  }
  const list = document.createElement('div');
  list.className = 'mt-4 grid gap-3';
  for (const s of signups) {
    const row = document.createElement('div');
    row.setAttribute('data-signup', s.id);
    row.className = 'flex flex-wrap items-center gap-3 border border-paper/15 p-3 text-sm';
    const name = document.createElement('span');
    name.className = 'font-semibold';
    name.textContent = s.name;
    const mail = document.createElement('a');
    mail.href = `mailto:${s.email}`;
    mail.className = 'text-amber';
    mail.textContent = s.email;
    const date = document.createElement('span');
    date.className = 'text-xs uppercase tracking-widest text-paper/60';
    date.textContent = String(s.created_at).slice(0, 10);
    const state = document.createElement('span');
    state.className = 'text-xs uppercase tracking-widest text-paper/60';
    state.textContent = s.contacted ? 'Contacted' : 'New';
    row.append(name, mail, date, state);
    if (s.note) {
      const note = document.createElement('p');
      note.className = 'w-full text-sm text-paper/70';
      note.textContent = s.note;
      row.append(note);
    }
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.setAttribute('data-toggle', '');
    toggle.className = 'border border-paper/20 px-3 py-1 text-xs uppercase';
    toggle.textContent = s.contacted ? 'Mark new' : 'Mark contacted';
    toggle.addEventListener('click', () => onContacted?.(s, { contacted: s.contacted ? 0 : 1 }));
    row.append(toggle);
    list.append(row);
  }
  section.append(list);
  el.append(section);
}
