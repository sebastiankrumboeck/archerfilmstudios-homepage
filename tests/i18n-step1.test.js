import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { DICT, applyI18n, setLang } from '../src/i18n/index.js';

const SHELLS = ['index.html', 'films/index.html', 'contact/index.html', 'impressum/index.html'];

function shellKeys() {
  const keys = new Set();
  for (const file of SHELLS) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-html|-ph|-aria|-alt)?="([^"]+)"/g)) {
      keys.add(m[1]);
    }
  }
  return [...keys].sort();
}

describe('i18n step-1 completeness', () => {
  it('every marker key in step-1 shells exists in both languages and is non-empty', () => {
    const keys = shellKeys();
    expect(keys.length).toBeGreaterThan(20);
    const missing = [];
    for (const key of keys) {
      for (const lang of ['en', 'de']) {
        const v = DICT[lang]?.[key];
        if (typeof v !== 'string' || !v.trim()) missing.push(`${lang}:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('renders German copy with special chars intact and markup unbroken', () => {
    document.body.innerHTML = `<p data-i18n="home.sub"></p><div data-i18n-html="home.joinEmail"></div>`;
    setLang('de');
    applyI18n(document);
    const p = document.querySelector('p').textContent;
    expect(p).toBe(DICT.de['home.sub']);
    expect(p).toMatch(/[äöüßÄÖÜ]/);
    const link = document.querySelector('div a');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toContain('mailto:');
  });
});
