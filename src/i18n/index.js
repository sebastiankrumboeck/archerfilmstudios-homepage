const KEY = 'archer-lang';

export const DICT = {
  en: {
    'nav.home': 'Home',
  },
  de: {
    'nav.home': 'Start',
  },
};

export function getLang() {
  const v = localStorage.getItem(KEY);
  return v === 'de' || v === 'en' ? v : 'en';
}

export function setLang(lang) {
  const next = lang === 'de' || lang === 'en' ? lang : 'en';
  localStorage.setItem(KEY, next);
  document.documentElement.lang = next;
  applyI18n(document);
  markActiveLang(document);
  window.dispatchEvent(new CustomEvent('archer:lang', { detail: next }));
  return next;
}

export function t(key) {
  const lang = getLang();
  return DICT[lang]?.[key] ?? DICT.en[key] ?? key;
}

export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    const v = t(el.getAttribute('data-i18n'));
    if (v) el.textContent = v;
  }
  for (const el of root.querySelectorAll('[data-i18n-html]')) {
    const v = t(el.getAttribute('data-i18n-html'));
    if (v) el.innerHTML = v;
  }
  for (const el of root.querySelectorAll('[data-i18n-ph]')) {
    const v = t(el.getAttribute('data-i18n-ph'));
    if (v) el.placeholder = v;
  }
  for (const el of root.querySelectorAll('[data-i18n-aria]')) {
    const v = t(el.getAttribute('data-i18n-aria'));
    if (v) el.setAttribute('aria-label', v);
  }
}

export function markActiveLang(root = document) {
  const lang = getLang();
  for (const btn of root.querySelectorAll('[data-lang]')) {
    if (btn.getAttribute('data-lang') === lang) {
      btn.setAttribute('aria-current', 'true');
      btn.classList.add('text-amber');
    } else {
      btn.removeAttribute('aria-current');
      btn.classList.remove('text-amber');
    }
  }
}

export function bindLangToggle(root = document) {
  markActiveLang(root);
  for (const btn of root.querySelectorAll('[data-lang]')) {
    btn.addEventListener('click', () => setLang(btn.getAttribute('data-lang')));
  }
}
