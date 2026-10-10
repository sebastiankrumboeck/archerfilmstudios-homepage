import { mountLayout } from '../layout.js';
import { renderAuth, safeNext } from '../views/auth.js';

await mountLayout('login');
const next = safeNext(new URLSearchParams(location.search).get('next'));
renderAuth(document.querySelector('#app-view'), 'login', () => {
  location.href = next ?? '/projects/';
});
