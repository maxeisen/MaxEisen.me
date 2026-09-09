// Minimal SVG chart primitives. Return path strings and scaled coordinates;
// components own the markup so everything stays themeable through CSS.

/**
 * Build a linear scale from a data domain to a pixel range.
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
 * Extent for an axis, padded slightly. Anchored to zero by default so a
 * bar's height is proportional to its value. Pass `includeZero: false` for
 * series that live in a narrow band well above zero (efficiency factor).
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
 */
export function linePath(points) {
	if (!points || points.length === 0) return "";
	return points
		.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
		.join(" ");
}

/** Split a series on nulls so a gap in the recording is a hole, not a line across it. */
export function contiguous(points) {
	const out = [];
	let current = [];
	for (const point of points || []) {
		if (point) current.push(point);
		else if (current.length > 1) { out.push(current); current = []; }
		else current = [];
	}
	if (current.length > 1) out.push(current);
	return out;
}

const coord = (n) => n.toFixed(2);

/**
 * A smooth path through points, by monotone cubic interpolation.
 *
 * Catmull-Rom overshoots at a reversal and would invent a peak higher than
 * any day recorded. Fritsch-Carlson flattens the tangent at every local
 * extreme so the curve stays within the values it connects.
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
 */
export function seriesPoints(values, { width, height, domain }) {
	const list = (values || []).map((v) => (Number.isFinite(v) ? v : 0));
	if (list.length === 0) return [];
	const y = scaleLinear(domain || extent(list), [height, 0]);
	const step = list.length === 1 ? 0 : width / (list.length - 1);
	return list.map((value, i) => ({ x: i * step, y: y(value), value }));
}

// ChartFrame places cursor, dots and axis labels in percentages of the
// plot box (HTML over an SVG that stretches). These convert once from a
// chart's own viewBox.

/** Horizontal position as a percentage from the left of the plot. */
export function xPct(x, width) {
	return width > 0 ? (x / width) * 100 : 0;
}

/** Vertical position as a percentage from the bottom of the plot (CSS, not SVG). */
export function yPct(y, height) {
	return height > 0 ? (1 - y / height) * 100 : 0;
}

/** Position for a marker on a horizontal gauge, clamped to the track. */
export function gaugePosition(value, domain, width) {
	const x = scaleLinear(domain, [0, width])(value);
	return Math.max(0, Math.min(width, x));
}

// Shared x-window so every chart on the page is comparable.
export const CHART_WEEKS = 12;
export const CHART_DAYS = CHART_WEEKS * 7;
// efficiencyTrend.CHANGE_WINDOW_DAYS in the engine must stay equal to this,
// so the aerobic-efficiency headline describes the same twelve weeks.

/** Trailing slice of a date-keyed series, ending at `today`. */
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
 * inside it. Pass `steps` for a non-decimal ladder (pace in seconds wants
 * halves of a minute, not a 100-second step).
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

/** Tick values as positions and labels. pct is from the bottom of the plot. */
export function axisTicks(scale, format = (v) => String(v)) {
	if (!scale || !(scale.max > scale.min)) return [];
	return scale.ticks.map((value) => ({
		value,
		label: format(value),
		pct: ((value - scale.min) / (scale.max - scale.min)) * 100,
	}));
}
