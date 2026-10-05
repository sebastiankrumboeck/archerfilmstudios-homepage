import { mountLayout } from '../layout.js';
import { renderContact } from '../views/contact.js';

await mountLayout('contact');
renderContact(document.querySelector('#app-view'));
