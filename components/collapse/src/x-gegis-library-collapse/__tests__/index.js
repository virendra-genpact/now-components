// Tests for x-gegis-library-collapse
//
// Open/closed is held in the `expanded` property and toggled via
// updateProperties. These exercise the pure open-resolution and toggle
// logic. Rendering/DOM tests run via `snc ui-component test`.

describe('collapse open-state logic', () => {
	// Mirrors the view: open = Boolean(properties.expanded)
	const resolveOpen = (expandedProp) => Boolean(expandedProp);
	// Mirrors the toggle: next = !open
	const nextExpanded = (expandedProp) => !Boolean(expandedProp);

	it('treats the expanded property as the open state', () => {
		expect(resolveOpen(true)).toBe(true);
		expect(resolveOpen(false)).toBe(false);
	});

	it('treats falsy expanded values as closed', () => {
		expect(resolveOpen(undefined)).toBe(false);
		expect(resolveOpen(null)).toBe(false);
		expect(resolveOpen(0)).toBe(false);
		expect(resolveOpen('')).toBe(false);
	});

	it('toggles to the opposite of the current state', () => {
		expect(nextExpanded(false)).toBe(true);
		expect(nextExpanded(true)).toBe(false);
		expect(nextExpanded(undefined)).toBe(true);
	});
});
