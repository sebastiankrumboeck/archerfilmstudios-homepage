import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/input.css'), 'utf8');

describe('global button treatment', () => {
  it('gives buttons a pointer cursor', () => {
    expect(css).toMatch(/button[^{]*\{[^}]*cursor:\s*pointer/);
  });

  it('gives enabled buttons a hover effect', () => {
    expect(css).toMatch(/button:not\(:disabled\):hover/);
  });

  it('gives disabled buttons a not-allowed cursor', () => {
    expect(css).toMatch(/button:disabled[^{]*\{[^}]*cursor:\s*not-allowed/);
  });
});
