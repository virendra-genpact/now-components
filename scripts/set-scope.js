#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 * set-scope.js (project-level) — retarget components to a ServiceNow scope.
 *
 * Why: a PDI usually won't let you create the `x_gegis_library` scope, so to
 * deploy there you must reuse a scope that already exists in that PDI. The scope
 * string drives the element tag (ServiceNow requires the tag prefix to match the
 * scope, with `_` → `-`), so it appears in many files per component. This script
 * rewrites ALL of them, for ALL components (or one), from a single value.
 *
 * Usage (run from the monorepo root):
 *     npm run set-scope -- <scope>              # ALL components
 *     npm run set-scope -- <scope> <component>  # just one, e.g. collapse
 *     npm run set-scope -- --dry <scope>        # preview, write nothing
 *     npm run set-scope                          # re-apply scope.config.json to all
 *
 * The chosen scope is stored in scope.config.json at the repo root.
 * After running, deploy each component as usual:  cd components/<name> && npm run deploy
 * ------------------------------------------------------------------ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COMPONENTS_DIR = path.join(ROOT, 'components');
const CONFIG = path.join(ROOT, 'scope.config.json');

const scopeToPrefix = (scope) => scope.replace(/_/g, '-');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, '\t') + '\n');

function fail(msg) {
	console.error(`\n✗ set-scope: ${msg}\n`);
	process.exit(1);
}

/* ---- Parse args: [--dry] [<scope>] [<component>] --------------- */
const args = process.argv.slice(2);
const dry = args.includes('--dry') || args.includes('-n');
const positional = args.filter((a) => a !== '--dry' && a !== '-n');
const cfg = fs.existsSync(CONFIG) ? readJson(CONFIG) : { scope: 'x_gegis_library' };
const newScope = (positional[0] || cfg.scope || 'x_gegis_library').trim();
const onlyComponent = positional[1];

if (!/^[a-z][a-z0-9_]*$/.test(newScope)) {
	fail(`invalid scope "${newScope}". Use lowercase letters, digits and underscores, e.g. x_acme_lab or global.`);
}

/* ---- Discover deployable components (folders with now-ui.json) -- */
let components = fs
	.readdirSync(COMPONENTS_DIR, { withFileTypes: true })
	.filter((d) => d.isDirectory() && fs.existsSync(path.join(COMPONENTS_DIR, d.name, 'now-ui.json')))
	.map((d) => d.name);

if (onlyComponent) {
	if (!components.includes(onlyComponent)) {
		fail(`component "${onlyComponent}" not found (have: ${components.join(', ')}).`);
	}
	components = [onlyComponent];
}

console.log(`set-scope${dry ? ' (dry-run)' : ''} → "${newScope}"  for: ${components.join(', ')}\n`);

/* ---- Per-component transform ----------------------------------- */
const replaceInFile = (file, from, to) => {
	if (!fs.existsSync(file)) return;
	const txt = fs.readFileSync(file, 'utf8');
	const next = txt.split(from).join(to);
	if (next !== txt && !dry) fs.writeFileSync(file, next);
};

let changed = 0;
let skipped = 0;

for (const name of components) {
	const dir = path.join(COMPONENTS_DIR, name);
	const nowUiPath = path.join(dir, 'now-ui.json');
	const pkgPath = path.join(dir, 'package.json');

	let nowUi;
	let pkg;
	try {
		nowUi = readJson(nowUiPath);
		pkg = readJson(pkgPath);
	} catch (e) {
		console.log(`  ⚠ ${name}: unreadable now-ui.json/package.json — skipped`);
		skipped++;
		continue;
	}

	const oldScope = nowUi.scopeName;
	const oldTag = Object.keys(nowUi.components || {})[0];
	if (!oldScope || !oldTag) {
		console.log(`  ⚠ ${name}: no scopeName/component tag in now-ui.json — skipped`);
		skipped++;
		continue;
	}
	const base = pkg.name && pkg.name.includes('/') ? pkg.name.split('/')[1] : oldTag.replace(`${scopeToPrefix(oldScope)}-`, '');
	const newTag = `${scopeToPrefix(newScope)}-${base}`;

	if (!newTag.includes('-')) {
		console.log(`  ⚠ ${name}: tag "${newTag}" has no hyphen — skipped (pick a scope like x_acme_lab)`);
		skipped++;
		continue;
	}

	if (oldScope === newScope && oldTag === newTag) {
		console.log(`  • ${name}: already "${newScope}" (<${newTag}>)`);
		continue;
	}

	console.log(`  • ${name}: ${oldScope} (<${oldTag}>) → ${newScope} (<${newTag}>)`);

	if (!dry) {
		// package.json name
		pkg.name = `@${newScope}/${base}`;
		writeJson(pkgPath, pkg);

		// now-ui.json scopeName + tag key (preserve order minimally)
		nowUi.scopeName = newScope;
		const def = nowUi.components[oldTag];
		delete nowUi.components[oldTag];
		nowUi.components[newTag] = def;
		writeJson(nowUiPath, nowUi);

		// element source + tests + import paths
		replaceInFile(path.join(dir, 'src', oldTag, 'index.js'), oldTag, newTag);
		replaceInFile(path.join(dir, 'src', oldTag, '__tests__', 'index.js'), oldTag, newTag);
		replaceInFile(path.join(dir, 'src', 'index.js'), oldTag, newTag);
		replaceInFile(path.join(dir, 'example', 'element.js'), oldTag, newTag);

		// rename the element folder to match the new tag
		const oldDir = path.join(dir, 'src', oldTag);
		const newDir = path.join(dir, 'src', newTag);
		if (fs.existsSync(oldDir) && oldDir !== newDir) fs.renameSync(oldDir, newDir);
	}
	changed++;
}

if (!dry) writeJson(CONFIG, { scope: newScope });

console.log(`\n${dry ? '(dry-run) ' : ''}✓ ${changed} component(s) ${dry ? 'would change' : 'updated'}${skipped ? `, ${skipped} skipped` : ''}.`);
if (!dry && changed) console.log('  Next:  cd components/<name> && npm run deploy\n');
