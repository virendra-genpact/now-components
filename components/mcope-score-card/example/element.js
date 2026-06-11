/* LOCAL PREVIEW ONLY — register now-card so the playground renders. NOT in the
 * deployed bundle (snc deploy builds from src/index.js, which does not import now-*;
 * the instance supplies the Horizon version via innerComponents, §3.1). */
import '@servicenow/now-card/src/now-card';

import '../src/x-gegis-library-mcope-score-card';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

mountPlayground(nowUi);
