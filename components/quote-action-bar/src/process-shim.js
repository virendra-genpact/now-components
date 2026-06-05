/* Some bundled @servicenow/now-* dependencies (e.g. @servicenow/library-translate)
 * reference the Node global `process`, which is undefined in the instance browser
 * runtime — throwing "ReferenceError: process is not defined" and preventing the
 * component from rendering. Define a minimal shim BEFORE those modules evaluate.
 *
 * This MUST be the first import in src/index.js so it runs before the element (and
 * therefore before now-* / library-translate). It is a no-op when `process` already
 * exists (e.g. in local `snc develop`, where webpack provides it). */
if (typeof globalThis !== 'undefined' && typeof globalThis.process === 'undefined') {
	globalThis.process = { env: { NODE_ENV: 'production' } };
}
