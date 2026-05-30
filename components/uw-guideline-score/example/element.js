import '../src/x-gegis-library-uw-guideline-score';
import nowUi from '../now-ui.json';
import { mountPlayground } from './playground';

/* Fully owned markup (+ now-icon), so no dev-only imports are needed — it renders
 * the same in develop as on the instance. */
mountPlayground(nowUi);
