import '../src/x-vendor-component-template';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* Auto-generates a live control panel from now-ui.json — see playground.js.
 * No edits needed here when you add properties; just describe them in
 * now-ui.json and they appear as controls automatically. */
mountPlayground(nowUi);
