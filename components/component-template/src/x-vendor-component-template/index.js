import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-vendor-component-template
 * A minimal ServiceNow Next Experience component to copy from.
 *
 * When you copy this folder (see ../../CONTRIBUTING.md), find/replace:
 *   x-vendor-component-template  ->  x-<your-scope>-<your-component>
 *   x_vendor_scope               ->  your application scope
 * ------------------------------------------------------------------ */

const view = (state) => {
	const { heading } = state.properties;
	return <div className="ct-root">{heading}</div>;
};

createCustomElement('x-vendor-component-template', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		heading: { default: 'Hello from component-template' },
	},
	actionHandlers: {},
});
