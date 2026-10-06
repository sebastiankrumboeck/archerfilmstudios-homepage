import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pages = ['projects', 'calendar', 'board', 'contact', 'login', 'register', 'impressum', 'members', 'films', 'finanzen'];

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/avatars': 'http://127.0.0.1:8787',
    },
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        [['home', 'index.html'], ...pages.map((p) => [p, `${p}/index.html`])].map(([name, file]) => [
          name,
          resolve(__dirname, file),
        ]),
      ),
    },
  },
});
