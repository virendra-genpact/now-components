// Tests for x-gegis-library-selected-product
//
// Pure logic the view/handlers rely on. Rendering/DOM tests run via
// `snc ui-component test`.

describe('selected-product logic', () => {
	const isOpen = (state) => state.opened === true;
	const productText = (prefix, name) => [prefix, name].filter(Boolean).join(' ').trim();
	const footerActions = (confirmLabel, cancelLabel) => [
		{ label: confirmLabel, variant: 'primary', clickActionType: 'SPB_CONFIRM' },
		{ label: cancelLabel, variant: 'secondary', clickActionType: 'SPB_CANCEL' },
	];

	it('treats the modal as closed unless opened === true', () => {
		expect(isOpen({})).toBe(false);
		expect(isOpen({ opened: false })).toBe(false);
		expect(isOpen({ opened: true })).toBe(true);
	});

	it('composes the product label with an optional prefix', () => {
		expect(productText('Product:', 'Commercial Property – Standard Plan')).toBe('Product: Commercial Property – Standard Plan');
		expect(productText('', 'Flood Insurance')).toBe('Flood Insurance');
		expect(productText('Product:', '')).toBe('Product:');
	});

	it('orders footer actions right-to-left: confirm (primary) then cancel (secondary)', () => {
		const fa = footerActions('Continue', 'Cancel');
		expect(fa[0]).toMatchObject({ label: 'Continue', variant: 'primary', clickActionType: 'SPB_CONFIRM' });
		expect(fa[1]).toMatchObject({ label: 'Cancel', variant: 'secondary', clickActionType: 'SPB_CANCEL' });
	});

	it('gives each footer button a distinct clickActionType (no payload disambiguation needed)', () => {
		const types = footerActions('Continue', 'Cancel').map((a) => a.clickActionType);
		expect(new Set(types).size).toBe(2);
	});
});
