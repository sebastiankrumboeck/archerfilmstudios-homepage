import { mountLayout } from '../layout.js';
import { renderTrialForm } from '../views/schnuppern.js';

await mountLayout('schnuppern');
renderTrialForm(document.querySelector('#app-view'), {});
