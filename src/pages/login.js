import { mountLayout } from '../layout.js';
import { renderAuth } from '../views/auth.js';

await mountLayout('login');
renderAuth(document.querySelector('#app-view'), 'login', () => {
  location.href = '/projects/';
});
