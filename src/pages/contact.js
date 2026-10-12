import { mountLayout } from '../layout.js';
import { renderContact, rerenderContact } from '../views/contact.js';

await mountLayout('contact');
const view = document.querySelector('#app-view');
renderContact(view);

window.addEventListener('archer:lang', () => rerenderContact(view));
