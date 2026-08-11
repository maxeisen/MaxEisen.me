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

// How much history every chart on the page shows. One window across all of
// them is what makes them comparable: a volume chart running to race day
// beside a fitness chart running to today invites you to read a shape into
// two different x-axes. Twelve weeks is long enough to see a block develop
// and short enough that a single week is still a distinguishable bar.
export const CHART_WEEKS = 12;
export const CHART_DAYS = CHART_WEEKS * 7;

/**
 * Trailing slice of a date-keyed series, ending at `today`.
 *
 * @param {{date: string}[]} points ascending by date.
 * @param {string} today day key.
 * @param {number} [days]
 * @returns {object[]}
 */
export function withinWindow(points, today, days = CHART_DAYS) {
	if (!today) return (points || []).slice(-days);
	const cutoff = new Date(`${today}T00:00:00Z`).getTime() - days * 86_400_000;
	if (Number.isNaN(cutoff)) return points || [];
	return (points || []).filter((p) => {
		const at = new Date(`${String(p?.date).slice(0, 10)}T00:00:00Z`).getTime();
		return !Number.isNaN(at) && at >= cutoff;
	});
}

// Round a range end to a "nice" number — 1, 2, 5 or 10 times a power of ten.
// Axis labels are there to be read at a glance, and 0/10/20/30 is readable in
// a way that 0/8.3/16.6/24.9 is not.
function niceNum(range, round) {
	if (!(range > 0)) return 1;
	const exponent = Math.floor(Math.log10(range));
	const fraction = range / 10 ** exponent;
	let nice;
	if (round) {
		nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
	} else {
		nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
	}
	return nice * 10 ** exponent;
}

/**
 * An axis: the domain rounded outwards to round numbers, and the tick values
 * inside it.
 *
 * @param {[number, number]} extent data min and max.
 * @param {number} [count] rough number of intervals wanted.
 * @returns {{min: number, max: number, step: number, ticks: number[]}}
 */
export function niceScale([min, max], count = 4) {
	let lo = Number.isFinite(min) ? min : 0;
	let hi = Number.isFinite(max) ? max : 1;
	if (hi < lo) [lo, hi] = [hi, lo];
	// A flat series still needs an axis with two ends to it.
	if (hi === lo) hi = lo === 0 ? 1 : lo + Math.abs(lo) * 0.1;

	const step = niceNum(niceNum(hi - lo, false) / Math.max(1, count), true);
	const niceMin = Math.floor(lo / step) * step;
	const niceMax = Math.ceil(hi / step) * step;

	const ticks = [];
	// Accumulating in floating point drifts (0.1 + 0.2 …), so step off an
	// integer index instead and round to the step's own precision.
	const decimals = Math.max(0, -Math.floor(Math.log10(step)));
	const total = Math.round((niceMax - niceMin) / step);
	for (let i = 0; i <= total; i++) {
		ticks.push(Number((niceMin + i * step).toFixed(decimals + 2)));
	}
	return { min: niceMin, max: niceMax, step, ticks, decimals };
}

/**
 * Turn tick values into the positions and labels an axis renders.
 *
 * @param {{min: number, max: number, ticks: number[]}} scale
 * @param {(value: number) => string} [format]
 * @returns {{value: number, label: string, pct: number}[]} pct measured from
 *   the bottom of the plot.
 */
export function axisTicks(scale, format = (v) => String(v)) {
	if (!scale || !(scale.max > scale.min)) return [];
	return scale.ticks.map((value) => ({
		value,
		label: format(value),
		pct: ((value - scale.min) / (scale.max - scale.min)) * 100,
	}));
}
