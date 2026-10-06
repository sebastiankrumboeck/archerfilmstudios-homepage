import { bindMenu, bindImageFallbacks } from './main.js';
import { api } from './api/client.js';
import { SOCIALS } from './data/socials.js';

const NAV = [
  ['/', 'Home', false],
  ['/films/', 'Films', false],
  ['/projects/', 'Projects', true],
  ['/calendar/', 'Calendar', true],
  ['/board/', 'Board', true],
  ['/members/', 'Members', true],
  ['/mitschriften/', 'Mitschriften', true],
  ['/finanzen/', 'Finanzen', true, 'kassier'],
  ['/contact/', 'Contact', false],
];

export function headerHTML(active) {
  const render = (extra = '') =>
    NAV.map(
      ([href, label, priv, role]) =>
        `<a class="transition-colors hover:text-amber" href="${href}"${priv ? ' data-private-link' : ''}${role ? ` data-${role}-link` : ''}${extra}${href === activeHref(active) ? ' aria-current="page"' : ''}>${label}</a>`,
    ).join('');
  const desktop = render();
  const mobile = render();
  return `
    <header class="site-header sticky top-0 z-50 border-b border-paper/10 bg-ink/90 backdrop-blur-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-10">
        <a class="font-display text-xl font-semibold uppercase tracking-[0.12em]" href="/" aria-label="Archer FilmStudios home">
          <span>Archer</span><span class="text-amber">&nbsp;FilmStudios</span>
        </a>
        <nav class="hidden items-center gap-8 text-sm md:flex" aria-label="Primary navigation">
          ${desktop}
          <a class="transition-colors hover:text-amber" href="/login/" data-auth-link>Login</a>
        </nav>
        <button
          class="menu-toggle inline-flex items-center gap-3 border border-paper/20 px-3 py-2 text-xs uppercase tracking-[0.14em] transition-colors hover:border-amber hover:text-amber md:hidden"
          type="button"
          data-menu-toggle
          aria-expanded="false"
          aria-controls="mobile-navigation"
          aria-label="Open navigation menu"
        >
          <span data-menu-icon aria-hidden="true" class="text-amber">+</span>
        </button>
      </div>
      <nav id="mobile-navigation" data-mobile-nav data-open="false" class="mobile-navigation border-t border-paper/10 px-5 pb-5 md:hidden" aria-label="Mobile navigation">
        <div class="flex flex-col gap-4 pt-4 text-sm uppercase tracking-[0.14em]">
          ${mobile}
          <a class="transition-colors hover:text-amber" href="/login/" data-auth-link>Login</a>
        </div>
      </nav>
    </header>`;
}

export function footerHTML() {
  return `
    <footer class="border-t border-paper/10 px-5 py-8 sm:px-8 lg:px-10">
      <div class="mx-auto flex max-w-7xl flex-col gap-3 text-xs uppercase tracking-[0.14em] text-paper/60 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Archer FilmStudios</p>
        <p><a class="transition-colors hover:text-amber" href="/impressum/">Imprint</a></p>
        <p><a class="transition-colors hover:text-amber" href="${SOCIALS.instagram}" target="_blank" rel="noreferrer">@archerfilmstudios ↗</a></p>
        <p>Made for curious eyes</p>
      </div>
    </footer>`;
}

function activeHref(active) {
  return active === 'home' ? '/' : `/${active}/`;
}

export async function refreshAuthLink(root = document) {
  let me;
  try {
    ({ user: me } = await api('/api/me'));
  } catch {
    me = null;
  }
  for (const link of root.querySelectorAll('[data-private-link]')) {
    link.style.display = me ? '' : 'none';
  }
  for (const link of root.querySelectorAll('[data-kassier-link]')) {
    link.style.display = me?.is_kassier ? '' : 'none';
  }
  for (const link of root.querySelectorAll('[data-auth-link]')) {
    if (me) {
      const logout = document.createElement('button');
      logout.type = 'button';
      logout.className = 'transition-colors hover:text-amber';
      logout.textContent = 'Log out';
      logout.addEventListener('click', async () => {
        try {
          await api('/api/auth/logout', { method: 'POST', body: '{}' });
        } catch {
          // Leaving anyway — the server-side session expires on its own.
        }
        location.href = '/';
      });
      link.replaceWith(logout);
    } else {
      link.textContent = 'Login';
      link.setAttribute('href', '/login/');
    }
  }
}

export async function mountLayout(active, root = document) {
  root.documentElement.classList.add('js');
  root.querySelector('#header-slot').innerHTML = headerHTML(active);
  root.querySelector('#footer-slot').innerHTML = footerHTML();
  bindMenu(root.querySelector('[data-menu-toggle]'), root.querySelector('[data-mobile-nav]'));
  bindImageFallbacks(root);
  mountOfflineBanner(root);
  await refreshAuthLink(root);
}

function mountOfflineBanner(root) {
  const banner = document.createElement('div');
  banner.hidden = true;
  banner.setAttribute('data-offline-banner', '');
  banner.className = 'border-b border-amber px-5 py-2 text-center text-xs uppercase tracking-[0.14em]';
  banner.innerHTML = 'Offline — showing cached data. <button type="button" class="underline">Retry</button>';
  const update = () => {
    banner.hidden = root.defaultView?.navigator.onLine ?? true;
  };
  banner.querySelector('button').addEventListener('click', () => location.reload());
  root.defaultView?.addEventListener('online', update);
  root.defaultView?.addEventListener('offline', update);
  update();
  root.querySelector('#header-slot')?.after(banner);
}
