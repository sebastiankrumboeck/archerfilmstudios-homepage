import { describe, expect, it, vi } from 'vitest';
import { renderProjectGallery } from '../src/views/projects.js';

const PHOTOS = [
  { id: 'ph-1', r2_key: 'galleries/p1-1.jpg', uploaded_by: 'u-1', created_at: '2026-10-01T00:00:00Z' },
  { id: 'ph-2', r2_key: 'galleries/p1-2.jpg', uploaded_by: 'u-2', created_at: '2026-10-02T00:00:00Z' },
];

describe('project gallery', () => {
  window.confirm = () => true;
  it('empty album invites the first upload', () => {
    const el = document.createElement('div');
    renderProjectGallery(el, [], { canUpload: true, canDeleteFor: () => false, onUpload: vi.fn(), onDelete: vi.fn() });
    expect(el.textContent).toContain('No photos yet');
    expect(el.querySelector('input[type="file"]')).toBeTruthy();
  });

  it('photos render with gallery URLs and no delete buttons for strangers', () => {
    const el = document.createElement('div');
    renderProjectGallery(el, PHOTOS, { canUpload: false, canDeleteFor: () => false, onUpload: vi.fn(), onDelete: vi.fn() });
    const imgs = Array.from(el.querySelectorAll('img'));
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute('src')).toBe('/gallery/p1-1.jpg');
    expect(el.querySelector('[data-delete]')).toBeNull();
    expect(el.querySelector('input[type="file"]')).toBeNull();
  });

  it('delete button fires onDelete with the photo', () => {
    const el = document.createElement('div');
    const onDelete = vi.fn();
    renderProjectGallery(el, [PHOTOS[0]], { canUpload: false, canDeleteFor: () => true, onUpload: vi.fn(), onDelete });
    el.querySelector('[data-delete]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onDelete).toHaveBeenCalledWith(PHOTOS[0]);
  });

  it('upload input calls onUpload with the chosen file', async () => {
    const el = document.createElement('div');
    const onUpload = vi.fn();
    renderProjectGallery(el, [], { canUpload: true, canDeleteFor: () => false, onUpload, onDelete: vi.fn() });
    const file = new File(['x'], 'shoot.jpg', { type: 'image/jpeg' });
    const input = el.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [file] });
    el.querySelector('[data-upload]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
  });

  it('escapes HTML in r2 keys and uploader-derived labels', () => {
    const el = document.createElement('div');
    const evil = { id: 'ph-x', r2_key: 'galleries/"><script>alert(1)</script>.jpg', uploaded_by: 'u-1', created_at: '2026-10-01T00:00:00Z' };
    renderProjectGallery(el, [evil], { canUpload: false, canDeleteFor: () => false, onUpload: vi.fn(), onDelete: vi.fn() });
    expect(el.querySelector('script')).toBeNull();
    expect(el.textContent).not.toContain('<script>');
  });

  it('upload and delete failures surface inline', async () => {
    const el = document.createElement('div');
    renderProjectGallery(el, [PHOTOS[0]], {
      canUpload: true,
      canDeleteFor: () => true,
      onUpload: vi.fn().mockRejectedValue(new Error('Album is full.')),
      onDelete: vi.fn().mockRejectedValue(new Error('Not yours.')),
    });
    const file = new File(['x'], 'shoot.jpg', { type: 'image/jpeg' });
    Object.defineProperty(el.querySelector('input[type="file"]'), 'files', { value: [file] });
    el.querySelector('[data-upload]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(el.querySelector('[data-status]').textContent).toContain('Album is full.'));
    el.querySelector('[data-delete]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(el.querySelector('[data-status]').textContent).toContain('Not yours.'));
  });
});
