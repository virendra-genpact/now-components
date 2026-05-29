import '../src/x-gegis-library-metric-card';

const el = document.createElement('DIV');
el.style.cssText = 'max-width:520px;margin:40px auto;padding:16px;background:#f4f5f7;';
document.body.appendChild(el);

// Reproduces the reference design: a percent KPI trending down (red).
el.innerHTML = `
	<x-gegis-library-metric-card
		heading="Submissions to Quote Ratio"
		icon="currency-dollar-outline"
		value="25"
		format="percent"
		decimals="2"
		trend-value="-4.2"
		trend-period="MoM"
	></x-gegis-library-metric-card>
`;
