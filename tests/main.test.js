import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindImageFallbacks, bindMenu } from '../src/main.js';

let cleanupMenu = () => {};
let cleanupImages = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
  document.documentElement.className = '';
});

afterEach(() => {
  cleanupMenu();
  cleanupImages();
  cleanupMenu = () => {};
  cleanupImages = () => {};
  document.body.innerHTML = '';
});

function setupMenu() {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'mobile-navigation');
  button.setAttribute('aria-label', 'Open navigation menu');

  const navigation = document.createElement('nav');
  navigation.id = 'mobile-navigation';
  navigation.dataset.open = 'false';
  navigation.innerHTML = '<a href="#work">Work</a>';

  document.body.append(button, navigation);
  cleanupMenu = bindMenu(button, navigation);
  return { button, navigation };
}

describe('mobile menu enhancement', () => {
  it('starts closed and updates its accessible state when toggled', () => {
    const { button, navigation } = setupMenu();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Open navigation menu');
    expect(navigation.dataset.open).toBe('false');

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Close navigation menu');
    expect(navigation.dataset.open).toBe('true');
  });

  it('closes after an anchor selection and after Escape', () => {
    const { button, navigation } = setupMenu();
    const link = navigation.querySelector('a');

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navigation.dataset.open).toBe('false');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Open navigation menu');

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(navigation.dataset.open).toBe('false');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Open navigation menu');
    expect(document.activeElement).toBe(button);
  });

  it('removes menu listeners on cleanup', () => {
    const { button, navigation } = setupMenu();

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    cleanupMenu();
    cleanupMenu = () => {};

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navigation.dataset.open).toBe('true');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Close navigation menu');
    expect(navigation.dataset.open).toBe('true');
  });
});

describe('image fallback enhancement', () => {
  it('hides a failed image and marks its frame as a fallback', () => {
    const frame = document.createElement('div');
    frame.dataset.imageFrame = '';
    const image = document.createElement('img');
    image.dataset.fallbackImage = '';
    Object.defineProperties(image, {
      complete: { configurable: true, value: false },
      naturalWidth: { configurable: true, value: 1 },
    });
    frame.append(image);
    document.body.append(frame);

    cleanupImages = bindImageFallbacks(document);
    image.dispatchEvent(new Event('error'));

    expect(image.hidden).toBe(true);
    expect(frame.classList.contains('is-fallback')).toBe(true);
  });

  it('does not retain an error listener for an already failed image', () => {
    const frame = document.createElement('div');
    frame.dataset.imageFrame = '';
    const image = document.createElement('img');
    image.dataset.fallbackImage = '';
    frame.append(image);
    document.body.append(frame);
    const addEventListener = vi.spyOn(image, 'addEventListener');

    cleanupImages = bindImageFallbacks(document);

    expect(addEventListener).not.toHaveBeenCalled();
    expect(image.hidden).toBe(true);
    expect(frame.classList.contains('is-fallback')).toBe(true);
  });
});
