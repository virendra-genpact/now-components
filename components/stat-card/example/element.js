/* LOCAL PREVIEW ONLY — register now-card so the playground renders. NOT in the
 * deployed bundle: `snc ui-component deploy` builds from src/index.js, which does NOT
 * import now-* (the instance supplies the Horizon version via innerComponents, §3.1).
 * Locally it renders in legacy npm styling — validate the Horizon look on the instance. */
import '@servicenow/now-card/src/now-card';

import '../src/x-gegis-library-stat-card';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

mountPlayground(nowUi);
