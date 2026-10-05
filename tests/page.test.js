import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const dom = new JSDOM(
  readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'),
);
const document = dom.window.document;

describe('Archer FilmStudios home page', () => {
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

  it('contains eight local work cards without motion markers', () => {
    expect(document.querySelectorAll('[data-work-card]')).toHaveLength(8);
    expect(document.querySelectorAll('[data-work-card] [data-play-marker]')).toHaveLength(0);
    for (const card of document.querySelectorAll('[data-work-card] img')) {
      expect(card.getAttribute('src')).toMatch(/^\/work\/work-\d\.jpg$/);
    }
  });

  it('prioritizes the hero image and lazy-loads gallery images', () => {
    const heroImage = document.querySelector(
      '#hero img[data-fallback-image]',
    );
    const galleryImages = document.querySelectorAll(
      '#work img[data-fallback-image]',
    );

    expect(heroImage?.getAttribute('fetchpriority')).toBe('high');
    expect(galleryImages).toHaveLength(8);
    for (const image of galleryImages) {
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(image.getAttribute('alt')?.trim()).toBeTruthy();
    }
  });

  it('makes the skip-link target focusable', () => {
    const main = document.querySelector('#main-content');

    main?.focus();

    expect(main?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(main);
  });

  it('uses layout slots for the shared header and footer', () => {
    expect(document.querySelector('#header-slot')).not.toBeNull();
    expect(document.querySelector('#footer-slot')).not.toBeNull();
  });

  it('exposes a safe external social link', () => {
    const socialLink = document.querySelector('a[href*="instagram.com"]');

    expect(socialLink?.getAttribute('target')).toBe('_blank');
    expect(socialLink?.getAttribute('rel')).toContain('noreferrer');
  });
});
