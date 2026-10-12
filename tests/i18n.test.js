import { describe, expect, it, beforeEach } from 'vitest';
import { getLang, setLang, t, applyI18n, bindLangToggle, DICT } from '../src/i18n/index.js';

describe('i18n core', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('defaults to en with empty storage', () => {
    expect(getLang()).toBe('en');
  });

  it('persists de and reads it back', () => {
    setLang('de');
    expect(getLang()).toBe('de');
    expect(localStorage.getItem('archer-lang')).toBe('de');
  });

  it('falls back to en for unknown or corrupt values', () => {
    setLang('fr');
    expect(getLang()).toBe('en');
    localStorage.setItem('archer-lang', '');
    expect(getLang()).toBe('en');
  });

  it('translates keys per language and never blanks unknown keys', () => {
    expect(t('nav.home')).toBe(DICT.en['nav.home']);
    setLang('de');
    expect(t('nav.home')).toBe(DICT.de['nav.home']);
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('applyI18n replaces text, html, placeholder, and aria markers', () => {
    document.body.innerHTML = `
      <p data-i18n="nav.home"></p>
      <div data-i18n-html="nav.home"></div>
      <input data-i18n-ph="nav.home" />
      <button data-i18n-aria="nav.home">x</button>`;
    setLang('de');
    applyI18n(document);
    expect(document.querySelector('p').textContent).toBe(DICT.de['nav.home']);
    expect(document.querySelector('div').innerHTML).toBe(DICT.de['nav.home']);
    expect(document.querySelector('input').placeholder).toBe(DICT.de['nav.home']);
    expect(document.querySelector('button').getAttribute('aria-label')).toBe(DICT.de['nav.home']);
  });

  it('header toggle switches language, marks active, and survives reload', () => {
    document.body.innerHTML = `
      <button data-lang="de">DE</button><span>/</span><button data-lang="en">EN</button>
      <p data-i18n="nav.home"></p>`;
    let switches = 0;
    window.addEventListener('archer:lang', () => switches++);
    bindLangToggle(document);
    document.querySelector('[data-lang="de"]').click();
    expect(getLang()).toBe('de');
    expect(document.querySelector('p').textContent).toBe(DICT.de['nav.home']);
    expect(document.querySelector('[data-lang="de"]').getAttribute('aria-current')).toBe('true');
    expect(switches).toBe(1);
    // simulated reload: fresh read from same storage
    expect(getLang()).toBe('de');
  });
});
