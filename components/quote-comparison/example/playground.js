/* ------------------------------------------------------------------ *
 * Auto-generating component playground for `snc ui-component develop`.
 *
 * Reads the component's own now-ui.json and renders the element beside a
 * control panel — one control per declared property — that live-updates
 * the component as you edit. Declared events are logged too.
 *
 * It is fully generic: any component whose properties are described in
 * now-ui.json gets a complete live editor with NO per-component code.
 * Usage (see example/element.js):
 *
 *     import '../src/<element-tag>';
 *     import nowUi from '../now-ui.json';
 *     import { mountPlayground } from './playground';
 *     mountPlayground(nowUi);
 * ------------------------------------------------------------------ */

const STYLES = `
	* { box-sizing: border-box; }
	body { margin: 0; }
	.pg {
		font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		display: grid;
		grid-template-columns: 1fr 380px;
		min-height: 100vh;
		color: #1c2331;
	}
	@media (max-width: 880px) { .pg { grid-template-columns: 1fr; } }
	.pg-preview {
		display: flex; align-items: flex-start; justify-content: center;
		padding: 24px; background: #f4f5f7;
	}
	.pg-stage { width: 100%; }
	.pg-controls {
		padding: 28px 24px; border-left: 1px solid #e3e6ec;
		background: #fff; overflow-y: auto;
	}
	.pg-controls h2 { margin: 0 0 4px; font-size: 18px; }
	.pg-controls p.sub { margin: 0 0 20px; font-size: 13px; color: #6c7689; }
	.pg-row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
	.pg-row--check { flex-direction: row; align-items: flex-start; gap: 9px; }
	.pg-label { font-size: 12px; font-weight: 600; color: #5a6473; }
	.pg-input {
		font: inherit; font-size: 14px; padding: 8px 10px;
		border: 1px solid #cfd4dd; border-radius: 8px; width: 100%;
	}
	.pg-input:focus { outline: 2px solid #2f6fed; outline-offset: 0; border-color: #2f6fed; }
	.pg-row--check .pg-input { width: auto; margin-top: 2px; }
	.pg-row--check .pg-text { display: flex; flex-direction: column; gap: 3px; }
	.pg-row--check .pg-label { font-weight: 500; color: #2a3242; }
	.pg-hint { font-size: 11px; color: #9aa3b2; line-height: 1.35; }
	.pg-events { margin-top: 18px; border-top: 1px solid #eef0f4; padding-top: 14px; }
	.pg-events h3 { margin: 0 0 8px; font-size: 12px; color: #6c7689; text-transform: uppercase; letter-spacing: 0.04em; }
	.pg-event {
		padding: 10px 12px; border-radius: 8px; background: #eef4ff;
		font-size: 12px; color: #2a3242; word-break: break-all;
	}
	.pg-event code { color: #2f6fed; }
	.pg-warn { padding: 16px 20px; font-size: 14px; color: #c0341d; }
`;

/* Map a now-ui.json fieldType to a coercion for live property assignment. */
const coerce = (fieldType, raw) => {
	if (fieldType === 'number') return raw === '' ? null : Number(raw);
	return raw;
};

export function mountPlayground(nowUi) {
	const components = (nowUi && nowUi.components) || {};
	const tag = Object.keys(components)[0];

	const root = document.createElement('div');
	root.className = 'pg';
	document.body.appendChild(root);

	if (!tag) {
		root.innerHTML = `<div class="pg-warn">No component found in now-ui.json.</div>`;
		return;
	}

	const def = components[tag] || {};
	const props = def.properties || [];
	const events = def.events || [];
	const title = (def.uiBuilder && def.uiBuilder.label) || tag;

	root.innerHTML = `
		<style>${STYLES}</style>
		<div class="pg-preview"><div class="pg-stage"></div></div>
		<div class="pg-controls">
			<h2>${title} — live config</h2>
			<p class="sub"><code>${tag}</code><br/>Edit any field; the component updates in real time.</p>
			<form class="pg-form" autocomplete="off"></form>
		</div>
	`;

	const stage = root.querySelector('.pg-stage');
	const form = root.querySelector('.pg-form');

	/* The component under test. */
	const el = document.createElement(tag);
	stage.appendChild(el);

	/* Seed every property with its declared default. */
	props.forEach((p) => {
		if (p.defaultValue !== undefined) el[p.name] = p.defaultValue;
	});

	/* One control per property, generated from its fieldType. */
	props.forEach((p) => {
		const isCheckbox = p.fieldType === 'boolean';
		const row = document.createElement('label');
		row.className = 'pg-row' + (isCheckbox ? ' pg-row--check' : '');

		const labelEl = document.createElement('span');
		labelEl.className = 'pg-label';
		labelEl.textContent = p.label || p.name;

		let input;
		if (p.fieldType === 'choice') {
			input = document.createElement('select');
			(((p.typeMetadata && p.typeMetadata.choices) || p.options) || []).forEach((opt) => {
				const o = document.createElement('option');
				o.value = opt.value;
				o.textContent = opt.label || opt.value;
				input.appendChild(o);
			});
			if (p.defaultValue !== undefined) input.value = p.defaultValue;
			input.addEventListener('change', () => { el[p.name] = input.value; });
		} else if (isCheckbox) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.checked = Boolean(p.defaultValue);
			input.addEventListener('change', () => { el[p.name] = input.checked; });
		} else {
			input = document.createElement('input');
			input.type = p.fieldType === 'number' ? 'number' : 'text';
			if (p.defaultValue !== undefined) input.value = p.defaultValue;
			input.addEventListener('input', () => { el[p.name] = coerce(p.fieldType, input.value); });
		}
		input.className = 'pg-input';

		const hint = p.description
			? Object.assign(document.createElement('small'), { className: 'pg-hint', textContent: p.description })
			: null;

		if (isCheckbox) {
			const text = document.createElement('span');
			text.className = 'pg-text';
			text.appendChild(labelEl);
			if (hint) text.appendChild(hint);
			row.appendChild(input);
			row.appendChild(text);
		} else {
			row.appendChild(labelEl);
			row.appendChild(input);
			if (hint) row.appendChild(hint);
		}
		form.appendChild(row);
	});

	/* Log declared events as they fire. */
	if (events.length) {
		const wrap = document.createElement('div');
		wrap.className = 'pg-events';
		wrap.innerHTML = '<h3>Events</h3>';
		events.forEach((ev) => {
			const out = document.createElement('div');
			out.className = 'pg-event';
			out.innerHTML = `<code>${ev.name}</code> — not fired yet`;
			el.addEventListener(ev.name, (e) => {
				out.innerHTML = `<code>${ev.name}</code> ${JSON.stringify((e && e.detail) || {})}`;
			});
			wrap.appendChild(out);
		});
		root.querySelector('.pg-controls').appendChild(wrap);
	}

	return el;
}
