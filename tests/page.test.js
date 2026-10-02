import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const dom = new JSDOM(
  readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'),
);
const document = dom.window.document;

describe('Frame & Motion page structure', () => {
  it('contains the four sections in navigation order', () => {
    const sections = Array.from(
      document.querySelectorAll('#hero, #work, #about, #contact'),
    );

    expect(sections.map((section) => section.id)).toEqual([
      'hero',
      'work',
      'about',
      'contact',
    ]);
  });

  it('links the primary call to action to the work section', () => {
    expect(document.querySelector('#hero a[href="#work"]')).not.toBeNull();
  });

  it('contains six work cards and two motion poster markers', () => {
    expect(document.querySelectorAll('[data-work-card]')).toHaveLength(6);
    expect(
      document.querySelectorAll('[data-work-card][data-motion="true"]'),
    ).toHaveLength(2);
    expect(
      document.querySelectorAll('[data-work-card] [data-play-marker]'),
    ).toHaveLength(2);
  });

  it('prioritizes the hero image and lazy-loads gallery images', () => {
    const heroImage = document.querySelector(
      '#hero img[data-fallback-image]',
    );
    const galleryImages = document.querySelectorAll(
      '#work img[data-fallback-image]',
    );

    expect(heroImage?.getAttribute('fetchpriority')).toBe('high');
    expect(galleryImages).toHaveLength(6);
    for (const image of galleryImages) {
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(image.getAttribute('alt')?.trim()).toBeTruthy();
    }
  });

  it('uses an accessible footer metadata color', () => {
    const footerMetadata = document.querySelector('footer > div');

    expect(footerMetadata?.className).toContain('text-paper/60');
  });

  it('makes the skip-link target focusable', () => {
    const main = document.querySelector('#main-content');

    main?.focus();

    expect(main?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(main);
  });

  it('exposes an accessible mobile menu and safe external social link', () => {
    const menuButton = document.querySelector('[data-menu-toggle]');
    const mobileNavigation = document.querySelector('[data-mobile-nav]');
    const socialLink = document.querySelector('a[href*="instagram.com"]');

    expect(menuButton?.getAttribute('aria-expanded')).toBe('false');
    expect(menuButton?.getAttribute('aria-controls')).toBe(
      'mobile-navigation',
    );
    expect(menuButton?.getAttribute('aria-label')).toBe(
      'Open navigation menu',
    );
    expect(mobileNavigation?.id).toBe('mobile-navigation');
    expect(socialLink?.getAttribute('target')).toBe('_blank');
    expect(socialLink?.getAttribute('rel')).toContain('noreferrer');
  });
});
