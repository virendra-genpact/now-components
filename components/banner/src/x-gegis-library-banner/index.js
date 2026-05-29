import { createCustomElement } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import '@servicenow/now-alert/src/now-alert';
import styles from './styles.scss';

/* ------------------------------------------------------------------ *
 * x-gegis-library-banner
 * A configurable banner / callout for ServiceNow Next Experience.
 *
 * Per SERVICENOW_CUSTOM_COMPONENT_DEV_RULES.md §0: this is a thin
 * composition of the standard **now-alert** component, customized only
 * through its documented properties (status, header, icon, content,
 * link, action). No hand-rolled markup.
 *
 *   type   -> now-alert `status` (+ a sensible default icon)
 *   title  -> now-alert `header`
 *   line1..line4 -> now-alert `content` (HTML, one block per non-empty line)
 *   linkLabel/linkHref -> now-alert `textLinkProps`
 *   dismissible -> now-alert `action` (X button) + hides on dismiss
 * ------------------------------------------------------------------ */

/* type -> now-alert status + default now-icon (override via the `icon` prop). */
const TYPE_MAP = {
	info: { status: 'info', icon: 'circle-info-outline' },
	warning: { status: 'warning', icon: 'exclamation-triangle-fill' },
	error: { status: 'critical', icon: 'exclamation-triangle-fill' },
	success: { status: 'positive', icon: 'check-circle-fill' },
};

/* Icons are tinted to the banner's semantic color so they read as part of the
 * message (not stark black). Explicit Horizon-hued values — the now-* semantic
 * color tokens resolve to a dark value on this stack, so we set the color directly. */
const ICON_COLOR = {
	info: '#1d6fe0',
	warning: '#b5640a',
	error: '#c8283c',
	success: '#1a7f4b',
};

const esc = (s) => String(s == null ? '' : s)
	.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Light, author-friendly markup inside a line. Everything is HTML-escaped first
 * (safe), then a small allowlist is re-enabled — no arbitrary HTML / attributes:
 *   <b>..</b> <i>..</i> <u>..</u>   bold / italic / underline
 *   <size=18>..</size>              font size in px (digits only)
 *   :icon-name:                     inline now-icon (any glyph; safe charset)
 * e.g.  ":clock-outline: <b>As of:</b> <size=12>Jan 9, 2026</size>" */
const ICON_TOKEN = /:([a-z][a-z0-9-]*):/g;
const renderLine = (raw, iconColor) => {
	let s = esc(raw);
	s = s.replace(/&lt;(\/?)(b|i|u)&gt;/gi, '<$1$2>');
	s = s
		.replace(/&lt;size=(\d{1,3})&gt;/gi, '<span style="font-size:$1px">')
		.replace(/&lt;\/size&gt;/gi, '</span>');
	s = s.replace(ICON_TOKEN, (m, name) =>
		`<now-icon icon="${name}" size="sm" style="vertical-align:text-bottom;margin-inline-end:6px;color:${iconColor};"></now-icon>`);
	return s;
};

const view = (state) => {
	if (state.dismissed) return <span hidden></span>;

	const { type, title, line1, line2, line3, line4, icon, dismissible, linkLabel, linkHref, expandable } = state.properties;
	const map = TYPE_MAP[type] || TYPE_MAP.info;

	const iconTint = ICON_COLOR[type] || ICON_COLOR.info;
	const lines = [line1, line2, line3, line4].filter((l) => l && String(l).trim() !== '');
	// now-alert renders only the first node of `content`, so wrap everything in a
	// SINGLE root <div>; per-line spacing/size via inline styles (which it keeps).
	const inner = lines
		.map((l, i) => `<div style="font-size:14px;line-height:1.55;${i ? 'margin-top:12px;' : ''}">${renderLine(l, iconTint)}</div>`)
		.join('');
	// A <style> injected into the content applies across now-alert's shadow root
	// (proven reliable). We use it to (a) tint the leading status icon to the type
	// color — now-alert renders it dark by default — and (b) optionally hide the
	// built-in "Show more/less" toggle. It lives inside the single root <div> so the
	// message blocks still render.
	const css =
		`.now-alert-icon{color:${iconTint} !important}` +
		(expandable ? '' : 'now-button-bare{display:none !important}');
	// Add breathing room between the title (now-alert header) and the first line.
	const gap = title ? 'margin-top:8px;' : '';
	const contentHtml = `<div style="${gap}"><style>${css}</style>${inner}</div>`;

	return (
		<now-alert
			className="banner-alert"
			status={map.status}
			icon={icon || map.icon}
			header={title || undefined}
			expanded={true}
			content={contentHtml ? { type: 'html', value: contentHtml } : undefined}
			action={dismissible ? { type: 'dismiss' } : undefined}
			textLinkProps={linkLabel && linkHref ? { label: linkLabel, href: linkHref } : undefined}
		></now-alert>
	);
};

createCustomElement('x-gegis-library-banner', {
	renderer: { type: snabbdom },
	view,
	styles,
	initialState: { dismissed: false },
	properties: {
		/* info | warning | error | success */
		type: { default: 'warning' },
		/* Bold title row. */
		title: { default: '5 Potential duplicates found' },
		/* Up to four configurable message lines (empty lines are skipped). */
		line1: { default: 'The system has identified the following submissions as potential duplicates based on insured details, address, line of business, and exposure criteria.' },
		line2: { default: 'Review and determine whether to proceed or decline.' },
		line3: { default: '' },
		line4: { default: '' },
		/* Optional now-icon override; empty uses the per-type default. */
		icon: { default: '' },
		/* Show an (X) dismiss button. */
		dismissible: { default: false },
		/* When false, hides now-alert's built-in "Show more/less" toggle (content
		 * stays fully shown). */
		expandable: { default: true },
		/* Optional inline link. */
		linkLabel: { default: '' },
		linkHref: { default: '' },
	},
	actionHandlers: {
		/* now-alert asks the parent to handle dismiss/acknowledge — honor it. */
		'NOW_ALERT#ACTION_CLICKED': ({ action, updateState, dispatch }) => {
			updateState({ dismissed: true });
			dispatch('BANNER_DISMISSED', (action && action.payload) || {});
		},
		/* Surface the link click so it can be wired up in UI Builder. */
		'NOW_ALERT#TEXT_LINK_CLICKED': ({ dispatch }) => {
			dispatch('BANNER_LINK_CLICKED', {});
		},
	},
});
