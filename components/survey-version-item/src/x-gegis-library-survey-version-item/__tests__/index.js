// Tests for x-gegis-library-survey-version-item
//
// Pure logic the view/handler rely on. Rendering/DOM tests run via
// `snc ui-component test`.

describe('survey-version-item logic', () => {
	const pickIcon = (isCompleted, completedIcon, pendingIcon) => (isCompleted ? completedIcon : pendingIcon);
	const statusClass = (isCompleted) =>
		`svi-status${isCompleted ? ' svi-status--completed' : ' svi-status--pending'}`;
	const badgeClass = (badgeColor) => `svi-badge svi-badge--${badgeColor || 'positive'}`;
	const clickPayload = (p) => ({ itemTitle: p.itemTitle, createdDate: p.createdDate, isCompleted: p.isCompleted });

	it('picks the completed icon only when isCompleted is true', () => {
		expect(pickIcon(true, 'circle-check-fill', 'circle-check-outline')).toBe('circle-check-fill');
		expect(pickIcon(false, 'circle-check-fill', 'circle-check-outline')).toBe('circle-check-outline');
	});

	it('derives the status class from the completed flag', () => {
		expect(statusClass(true)).toBe('svi-status svi-status--completed');
		expect(statusClass(false)).toBe('svi-status svi-status--pending');
	});

	it('defaults the badge colour to positive when unset', () => {
		expect(badgeClass('info')).toBe('svi-badge svi-badge--info');
		expect(badgeClass('')).toBe('svi-badge svi-badge--positive');
		expect(badgeClass(undefined)).toBe('svi-badge svi-badge--positive');
	});

	it('builds the click payload from title, date and completed state', () => {
		const p = { itemTitle: 'Survey Result -V3', createdDate: '2026-02-25 16:14:33', isCompleted: true, extra: 'x' };
		expect(clickPayload(p)).toEqual({
			itemTitle: 'Survey Result -V3',
			createdDate: '2026-02-25 16:14:33',
			isCompleted: true,
		});
	});
});
