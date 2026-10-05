import { mountLayout } from '../layout.js';
import { renderAuth } from '../views/auth.js';

await mountLayout('register');
renderAuth(document.querySelector('#app-view'), 'register', () => {
  location.href = '/projects/';
});
