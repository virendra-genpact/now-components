/* LOCAL PREVIEW ONLY — register now-icon + now-button so the playground renders. NOT in
 * the deployed bundle (snc deploy builds from src/index.js, which does not import now-*;
 * the instance supplies the Horizon versions via innerComponents, §3.1). */
import '@servicenow/now-icon/src/now-icon';
import '@servicenow/now-button/src/now-button';

import '../src/x-gegis-library-risk-survey-table';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

mountPlayground(nowUi);
