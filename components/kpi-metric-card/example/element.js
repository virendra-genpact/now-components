/* LOCAL PREVIEW ONLY — register now-card + now-icon so the playground renders. NOT in
 * the deployed bundle (snc deploy builds from src/index.js, which does not import now-*;
 * the instance supplies the Horizon versions via innerComponents, §3.1). */
import '@servicenow/now-card/src/now-card';
import '@servicenow/now-icon/src/now-icon';

import '../src/x-gegis-library-kpi-metric-card';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

mountPlayground(nowUi);
