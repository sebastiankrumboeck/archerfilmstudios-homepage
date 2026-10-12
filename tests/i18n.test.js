import { describe, expect, it, beforeEach } from 'vitest';
import { getLang, setLang, t, applyI18n, bindLangToggle, DICT } from '../src/i18n/index.js';
import { renderFilms } from '../src/views/films.js';
import { renderContact, rerenderContact } from '../src/views/contact.js';

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

  it('applyI18n replaces text, html, placeholder, and aria markers', () => {    document.body.innerHTML = `
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

  it('header toggle switches language, marks active, and survives reload', () => {    document.body.innerHTML = `
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

describe('i18n dynamic views', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  it('films empty state, poster fallback, and admin labels render German', () => {
    setLang('de');
    const el = document.createElement('div');
    renderFilms(el, [], {});
    expect(el.textContent).toContain(DICT.de['films.empty']);
    const one = document.createElement('div');
    renderFilms(one, [{ id: 'f1', title: 'T', url: 'https://x.at', poster_r2_key: null }], { isAdmin: true });
    expect(one.textContent).toContain(DICT.de['films.posterSoon']);
    expect(one.textContent).toContain(DICT.de['films.edit']);
    expect(one.textContent).toContain(DICT.de['films.delete']);
  });

  it('contact form renders German labels, button, and validation message', () => {
    setLang('de');
    const el = document.createElement('div');
    renderContact(el);
    expect(el.querySelector('input[name="name"]').placeholder).toBe(DICT.de['contact.namePh']);
    expect(el.querySelector('button').textContent).toContain(DICT.de['contact.send']);
    el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(el.querySelector('[data-status]').textContent).toBe(DICT.de['contact.invalid']);
  });

  it('contact re-render preserves typed input', () => {    setLang('en');
    const el = document.createElement('div');
    renderContact(el);
    el.querySelector('input[name="name"]').value = 'Anna';
    el.querySelector('textarea[name="message"]').value = 'Hallo';
    setLang('de');
    rerenderContact(el);
    expect(el.querySelector('input[name="name"]').value).toBe('Anna');
    expect(el.querySelector('textarea[name="message"]').value).toBe('Hallo');
    expect(el.querySelector('button').textContent).toContain(DICT.de['contact.send']);
  });
});

describe('i18n document metadata', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    document.title = '';
    document.head.innerHTML = '<meta name="description" content="">';
  });

  it('applyI18n sets title, meta description, and html lang per page', () => {
    document.documentElement.dataset.page = 'films';
    setLang('de');
    applyI18n(document);
    expect(document.title).toBe(DICT.de['meta.films.title']);
    expect(document.querySelector('meta[name="description"]').content).toBe(DICT.de['meta.films.desc']);
    expect(document.documentElement.lang).toBe('de');
    setLang('en');
    applyI18n(document);
    expect(document.title).toBe(DICT.en['meta.films.title']);
    delete document.documentElement.dataset.page;
  });

  it('unknown marker keys keep existing English text', () => {
    document.body.innerHTML = `<p data-i18n="bogus.key">Hello</p>`;
    setLang('de');
    applyI18n(document);
    expect(document.querySelector('p').textContent).toBe('Hello');
  });

  it('applyI18n syncs html lang from storage without setLang', () => {
    localStorage.setItem('archer-lang', 'de');
    document.documentElement.lang = 'en';
    document.body.innerHTML = `<p data-i18n="nav.home"></p>`;
    applyI18n(document);
    expect(document.documentElement.lang).toBe('de');
    expect(document.querySelector('p').textContent).toBe(DICT.de['nav.home']);
  });
});
