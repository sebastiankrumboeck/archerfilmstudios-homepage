import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { headerHTML, footerHTML, mountLayout } from '../src/layout.js';

const LINKS = ['/', '/projects/', '/calendar/', '/board/', '/contact/', '/login/'];

describe('shared layout', () => {
  it('links all pages with pretty URLs', () => {
    const dom = new JSDOM(headerHTML('members'));
    const hrefs = Array.from(dom.window.document.querySelectorAll('nav a')).map((a) =>
      a.getAttribute('href'),
    );
    for (const link of LINKS) expect(hrefs).toContain(link);
  });

  it('marks the active page with aria-current', () => {
    const dom = new JSDOM(headerHTML('projects'));
    const link = dom.window.document.querySelector('a[href="/projects/"]');
    expect(link?.getAttribute('aria-current')).toBe('page');
  });

  it('exposes an accessible mobile menu and safe instagram link', () => {
    const dom = new JSDOM(`<body>${headerHTML('home')}${footerHTML()}</body>`);
    const document = dom.window.document;
    const menuButton = document.querySelector('[data-menu-toggle]');
    const socialLink = document.querySelector('a[href*="instagram.com"]');

    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
    expect(menuButton?.getAttribute('aria-controls')).toBe('mobile-navigation');
    expect(socialLink?.getAttribute('target')).toBe('_blank');
    expect(socialLink?.getAttribute('rel')).toContain('noreferrer');
  });

  it('keeps footer metadata styling', () => {
    expect(footerHTML()).toContain('text-paper/60');
  });

  it('mounts header/footer into slots and shows login when logged out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    document.body.innerHTML = '<div id="header-slot"></div><main></main><div id="footer-slot"></div>';
    await mountLayout('members');

    expect(document.querySelector('#header-slot [data-menu-toggle]')).not.toBeNull();
    expect(document.querySelector('#footer-slot footer')).not.toBeNull();
    expect(document.querySelector('[data-auth-link]')?.getAttribute('href')).toBe('/login/');
    vi.unstubAllGlobals();
  });
});
