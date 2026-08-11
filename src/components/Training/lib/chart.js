// Minimal SVG chart primitives.
//
// The site has no charting library and builds its visuals by hand (the GitHub
// contribution heatmap, the weather sun arc, Strava route previews), so these
// follow suit rather than pulling in a dependency for four chart types. They
// return path strings and scaled coordinates; the components own the markup and
// the styling, which keeps everything themeable through the CSS custom
// properties instead of a JS colour config.
//
// All charts draw into a fixed viewBox and scale with the container, so there
// are no resize observers and nothing to recompute on layout change.

/**
 * Build a linear scale from a data domain to a pixel range.
 *
 * @param {[number, number]} domain
 * @param {[number, number]} range
 * @returns {(value: number) => number}
 */
export function scaleLinear(domain, range) {
	const [d0, d1] = domain;
	const [r0, r1] = range;
	const span = d1 - d0;
	// A flat series has no span to divide by; park it in the middle of the
	// range rather than producing Infinity.
	if (!Number.isFinite(span) || span === 0) return () => (r0 + r1) / 2;
	return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/**
 * Extent for an axis, padded slightly.
 *
 * Anchored to zero by default, because for volume and load a bar's height
 * should be proportional to its value. Pass `includeZero: false` for series
 * that live in a narrow band well above zero — efficiency factor sits around
 * 1.3, so anchoring would compress a whole block's progress into a flat line
 * across the top of the chart.
 *
 * @param {number[]} values
 * @param {{includeZero?: boolean}} [options]
 * @returns {[number, number]}
 */
export function extent(values, { includeZero = true } = {}) {
	const usable = (values || []).filter((v) => Number.isFinite(v));
	if (usable.length === 0) return [0, 1];
	const min = includeZero ? Math.min(0, ...usable) : Math.min(...usable);
	const max = Math.max(...usable);
	if (min === max) return [min, min + 1];
	const pad = (max - min) * 0.05;
	return [includeZero ? min : min - pad, max + pad];
}

/**
 * A polyline path through scaled points.
 *
 * @param {{x: number, y: number}[]} points already in pixel space.
 * @returns {string}
 */
export function linePath(points) {
	if (!points || points.length === 0) return "";
	return points
		.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
		.join(" ");
}

/**
 * A closed area path from a line down to a baseline.
 *
 * @param {{x: number, y: number}[]} points
 * @param {number} baselineY
 * @returns {string}
 */
export function areaPath(points, baselineY) {
	if (!points || points.length === 0) return "";
	const first = points[0];
	const last = points[points.length - 1];
	return `${linePath(points)} L${last.x.toFixed(2)} ${baselineY.toFixed(2)} L${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

/**
 * Lay out evenly spaced bars across a width.
 *
 * @param {number[]} values
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} [options.max] domain ceiling; defaults to the data max.
 * @param {number} [options.gap] fraction of each slot left as spacing.
 * @returns {{x: number, y: number, width: number, height: number, value: number}[]}
 */
export function bars(values, { width, height, max, gap = 0.25 }) {
	const list = values || [];
	if (list.length === 0) return [];
	const ceiling = Number.isFinite(max) && max > 0 ? max : Math.max(...list.filter(Number.isFinite), 1);
	const slot = width / list.length;
	const barWidth = slot * (1 - gap);

	return list.map((value, i) => {
		const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
		const h = ceiling > 0 ? (safe / ceiling) * height : 0;
		return {
			x: i * slot + (slot - barWidth) / 2,
			y: height - h,
			width: barWidth,
			height: h,
			value: safe,
		};
	});
}

/**
 * Map a series to pixel points across a chart box.
 *
 * @param {number[]} values
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {[number, number]} [options.domain]
 * @returns {{x: number, y: number, value: number}[]}
 */
export function seriesPoints(values, { width, height, domain }) {
	const list = (values || []).map((v) => (Number.isFinite(v) ? v : 0));
	if (list.length === 0) return [];
	const y = scaleLinear(domain || extent(list), [height, 0]);
	const step = list.length === 1 ? 0 : width / (list.length - 1);
	return list.map((value, i) => ({ x: i * step, y: y(value), value }));
}

/**
 * Position for a marker on a horizontal gauge, clamped to the track.
 *
 * @param {number} value
 * @param {[number, number]} domain
 * @param {number} width
 * @returns {number}
 */
export function gaugePosition(value, domain, width) {
	const x = scaleLinear(domain, [0, width])(value);
	return Math.max(0, Math.min(width, x));
}
