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

const coord = (n) => n.toFixed(2);

/**
 * A smooth path through points, by monotone cubic interpolation.
 *
 * The straight segments between daily samples are already an interpolation —
 * nothing was measured between Tuesday and Wednesday — so a curve is no less
 * truthful than a polyline, and considerably easier to read on a series that
 * genuinely sawtooths. Fatigue is a 7-day average of an athlete who runs every
 * second day, so it swings ~40% around its own mean by construction, and drawn
 * with hard corners that arithmetic reads as instrument noise.
 *
 * Monotone rather than a plain spline, and that distinction is the whole point.
 * Catmull-Rom or a naive Bézier overshoots at a reversal: it invents a peak
 * higher than any day recorded, which on a chart of someone's training is a
 * fitness they never had. Fritsch-Carlson flattens the tangent at every local
 * extreme, so the curve is guaranteed to stay within the values it connects.
 *
 * @param {{x: number, y: number}[]} points already in pixel space, ascending
 *   in x.
 * @returns {string}
 */
export function smoothPath(points) {
	const list = points || [];
	// Two points are a straight line; there's no interior tangent to fit.
	if (list.length < 3) return linePath(list);

	const n = list.length;

	const secants = [];
	for (let i = 0; i < n - 1; i++) {
		const dx = list[i + 1].x - list[i].x;
		secants.push(dx === 0 ? 0 : (list[i + 1].y - list[i].y) / dx);
	}

	// Zero at a turning point — where the neighbouring secants disagree in
	// sign — and the average of them elsewhere.
	const tangents = new Array(n);
	tangents[0] = secants[0];
	tangents[n - 1] = secants[n - 2];
	for (let i = 1; i < n - 1; i++) {
		tangents[i] = secants[i - 1] * secants[i] <= 0 ? 0 : (secants[i - 1] + secants[i]) / 2;
	}

	// Fritsch-Carlson: pull any tangent pair back inside a circle of radius 3,
	// which is the condition for the segment to stay monotone.
	for (let i = 0; i < n - 1; i++) {
		if (secants[i] === 0) {
			tangents[i] = 0;
			tangents[i + 1] = 0;
			continue;
		}
		const a = tangents[i] / secants[i];
		const b = tangents[i + 1] / secants[i];
		const radius = a * a + b * b;
		if (radius > 9) {
			const scale = 3 / Math.sqrt(radius);
			tangents[i] = scale * a * secants[i];
			tangents[i + 1] = scale * b * secants[i];
		}
	}

	let d = `M${coord(list[0].x)} ${coord(list[0].y)}`;
	for (let i = 0; i < n - 1; i++) {
		const third = (list[i + 1].x - list[i].x) / 3;
		const c1 = { x: list[i].x + third, y: list[i].y + tangents[i] * third };
		const c2 = { x: list[i + 1].x - third, y: list[i + 1].y - tangents[i + 1] * third };
		d += ` C${coord(c1.x)} ${coord(c1.y)} ${coord(c2.x)} ${coord(c2.y)} ${coord(list[i + 1].x)} ${coord(list[i + 1].y)}`;
	}
	return d;
}

/**
 * A closed area path from a line down to a baseline.
 *
 * @param {{x: number, y: number}[]} points
 * @param {number} baselineY
 * @returns {string}
 */
export function areaPath(points, baselineY, { smooth = false } = {}) {
	if (!points || points.length === 0) return "";
	const first = points[0];
	const last = points[points.length - 1];
	const edge = smooth ? smoothPath(points) : linePath(points);
	return `${edge} L${coord(last.x)} ${coord(baselineY)} L${coord(first.x)} ${coord(baselineY)} Z`;
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

// ChartFrame places its cursor, dots and axis labels in percentages of the
// plot box, because they're HTML sitting over an SVG that stretches. These
// convert once from a chart's own viewBox so that arithmetic doesn't get
// repeated, slightly differently, in every chart that wants a cursor.

/**
 * Horizontal position as a percentage from the left of the plot.
 *
 * @param {number} x in viewBox units.
 * @param {number} width of the viewBox.
 * @returns {number}
 */
export function xPct(x, width) {
	return width > 0 ? (x / width) * 100 : 0;
}

/**
 * Vertical position as a percentage from the *bottom* of the plot, which is
 * where CSS wants it and the opposite of where SVG counts from.
 *
 * @param {number} y in viewBox units, measured from the top.
 * @param {number} height of the viewBox.
 * @returns {number}
 */
export function yPct(y, height) {
	return height > 0 ? (1 - y / height) * 100 : 0;
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
// efficiencyTrend.CHANGE_WINDOW_DAYS in the engine must stay equal to this,
// so the aerobic-efficiency headline describes the same twelve weeks.

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
 * @param {object} [options]
 * @param {number[]} [options.steps] ascending step sizes to choose from,
 *   instead of the decimal 1/2/5 ladder. Round numbers are base ten only
 *   because we count in it: an axis in seconds wants halves and quarters of a
 *   minute, and left to itself this lands on a 100-second step, which puts
 *   gridlines at 1:40 and 3:20 and rounds a run's range out to nearly twice
 *   its size to reach them.
 * @returns {{min: number, max: number, step: number, ticks: number[]}}
 */
export function niceScale([min, max], count = 4, { steps = null } = {}) {
	let lo = Number.isFinite(min) ? min : 0;
	let hi = Number.isFinite(max) ? max : 1;
	if (hi < lo) [lo, hi] = [hi, lo];
	// A flat series still needs an axis with two ends to it.
	if (hi === lo) hi = lo === 0 ? 1 : lo + Math.abs(lo) * 0.1;

	// The smallest offered step that doesn't overrun the axis with labels,
	// since a tighter step is also a tighter fit around the data.
	const spans = (s) => Math.round((Math.ceil(hi / s) * s - Math.floor(lo / s) * s) / s);
	const step = steps
		? (steps.find((s) => s > 0 && spans(s) <= count + 2) ?? steps.at(-1))
		: niceNum(niceNum(hi - lo, false) / Math.max(1, count), true);
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
