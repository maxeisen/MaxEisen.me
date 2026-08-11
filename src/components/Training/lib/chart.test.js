import { describe, it, expect } from "vitest";
import {
	scaleLinear,
	extent,
	linePath,
	areaPath,
	bars,
	seriesPoints,
	gaugePosition,
	niceScale,
	axisTicks,
	withinWindow,
	CHART_DAYS,
} from "./chart.js";

describe("scaleLinear", () => {
	it("maps the domain onto the range", () => {
		const scale = scaleLinear([0, 100], [0, 500]);
		expect(scale(0)).toBe(0);
		expect(scale(50)).toBe(250);
		expect(scale(100)).toBe(500);
	});

	it("supports an inverted range, as SVG y needs", () => {
		const scale = scaleLinear([0, 100], [200, 0]);
		expect(scale(0)).toBe(200);
		expect(scale(100)).toBe(0);
	});

	it("parks a flat domain mid-range instead of dividing by zero", () => {
		const scale = scaleLinear([5, 5], [0, 200]);
		expect(scale(5)).toBe(100);
		expect(Number.isFinite(scale(5))).toBe(true);
	});
});

describe("extent", () => {
	it("includes zero and pads the top", () => {
		const [min, max] = extent([10, 20, 30]);
		expect(min).toBe(0);
		expect(max).toBeGreaterThan(30);
	});

	it("keeps negatives, since form goes below zero", () => {
		const [min] = extent([-30, 10]);
		expect(min).toBe(-30);
	});

	it("handles an empty or all-invalid series", () => {
		expect(extent([])).toEqual([0, 1]);
		expect(extent([NaN, null])).toEqual([0, 1]);
	});

	it("can hug a band well above zero", () => {
		// Efficiency factor lives around 1.3; anchoring to zero would draw a
		// whole block's progress as a flat line across the top.
		const [min, max] = extent([1.28, 1.31, 1.35], { includeZero: false });
		expect(min).toBeLessThan(1.28);
		expect(min).toBeGreaterThan(1.2);
		expect(max).toBeGreaterThan(1.35);
	});

	it("still spans a flat series without dividing by zero", () => {
		expect(extent([1.3, 1.3], { includeZero: false })).toEqual([1.3, 2.3]);
	});
});

describe("linePath", () => {
	it("starts with a move and continues with lines", () => {
		expect(linePath([{ x: 0, y: 10 }, { x: 5, y: 20 }])).toBe("M0.00 10.00 L5.00 20.00");
	});

	it("returns an empty string with nothing to draw", () => {
		expect(linePath([])).toBe("");
	});
});

describe("areaPath", () => {
	it("closes the path back along the baseline", () => {
		const path = areaPath([{ x: 0, y: 10 }, { x: 5, y: 20 }], 100);
		expect(path.startsWith("M0.00 10.00")).toBe(true);
		expect(path.endsWith("Z")).toBe(true);
		expect(path).toContain("100.00");
	});
});

describe("bars", () => {
	it("spaces bars evenly and scales height to the max", () => {
		const out = bars([50, 100], { width: 200, height: 100 });
		expect(out).toHaveLength(2);
		expect(out[1].height).toBe(100);
		expect(out[0].height).toBe(50);
		expect(out[1].x).toBeGreaterThan(out[0].x);
	});

	it("scales against an explicit ceiling when given one", () => {
		const out = bars([50], { width: 100, height: 100, max: 200 });
		expect(out[0].height).toBe(25);
	});

	it("treats missing and negative values as zero-height", () => {
		const out = bars([null, -5], { width: 100, height: 100, max: 10 });
		expect(out[0].height).toBe(0);
		expect(out[1].height).toBe(0);
	});

	it("returns nothing for an empty series", () => {
		expect(bars([], { width: 100, height: 100 })).toEqual([]);
	});
});

describe("seriesPoints", () => {
	it("spreads points across the full width", () => {
		const out = seriesPoints([1, 2, 3], { width: 100, height: 50 });
		expect(out[0].x).toBe(0);
		expect(out.at(-1).x).toBe(100);
	});

	it("puts higher values nearer the top", () => {
		const out = seriesPoints([0, 10], { width: 100, height: 50 });
		expect(out[1].y).toBeLessThan(out[0].y);
	});

	it("handles a single point without dividing by zero", () => {
		const out = seriesPoints([5], { width: 100, height: 50 });
		expect(out).toHaveLength(1);
		expect(Number.isFinite(out[0].x)).toBe(true);
	});
});

describe("gaugePosition", () => {
	it("places a value proportionally along the track", () => {
		expect(gaugePosition(1.0, [0.5, 2.0], 150)).toBeCloseTo(50, 6);
	});

	it("clamps values outside the domain to the track ends", () => {
		expect(gaugePosition(5, [0.5, 2.0], 150)).toBe(150);
		expect(gaugePosition(0, [0.5, 2.0], 150)).toBe(0);
	});
});

describe("niceScale", () => {
	it("rounds the domain out to round numbers", () => {
		const scale = niceScale([0, 47]);
		expect(scale.min).toBe(0);
		expect(scale.max).toBe(50);
		expect(scale.ticks).toEqual([0, 10, 20, 30, 40, 50]);
	});

	it("always puts a tick on zero when the data crosses it", () => {
		const scale = niceScale([-18, 42]);
		expect(scale.ticks).toContain(0);
		expect(scale.min).toBeLessThanOrEqual(-18);
		expect(scale.max).toBeGreaterThanOrEqual(42);
	});

	it("handles the narrow band efficiency factor lives in", () => {
		const scale = niceScale([1.18, 1.34], 3);
		// Ticks are round at the scale of the data, not of the number line.
		expect(scale.step).toBeLessThan(0.1);
		expect(scale.min).toBeLessThanOrEqual(1.18);
		expect(scale.max).toBeGreaterThanOrEqual(1.34);
		for (const tick of scale.ticks) {
			expect(Number(tick.toFixed(6))).toBe(tick);
		}
	});

	it("gives a flat series an axis with two ends", () => {
		const scale = niceScale([12, 12]);
		expect(scale.max).toBeGreaterThan(scale.min);
		expect(scale.ticks.length).toBeGreaterThan(1);
	});

	it("survives an empty series", () => {
		const scale = niceScale([Infinity, -Infinity]);
		expect(Number.isFinite(scale.min)).toBe(true);
		expect(Number.isFinite(scale.max)).toBe(true);
	});
});

describe("axisTicks", () => {
	it("positions ticks as a percentage from the bottom", () => {
		const ticks = axisTicks(niceScale([0, 40]), (v) => `${v} km`);
		expect(ticks[0]).toEqual({ value: 0, label: "0 km", pct: 0 });
		expect(ticks.at(-1).pct).toBe(100);
		expect(ticks.at(-1).label).toBe("40 km");
	});

	it("returns nothing for a degenerate scale", () => {
		expect(axisTicks({ min: 1, max: 1, ticks: [1] })).toEqual([]);
	});
});

describe("withinWindow", () => {
	const series = Array.from({ length: 200 }, (_, i) => ({
		date: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
		value: i,
	}));

	it("keeps only the trailing window", () => {
		const shown = withinWindow(series, series.at(-1).date);
		expect(shown.length).toBe(CHART_DAYS + 1);
		expect(shown.at(-1)).toEqual(series.at(-1));
	});

	it("keeps everything when the series is shorter than the window", () => {
		const short = series.slice(-10);
		expect(withinWindow(short, short.at(-1).date)).toHaveLength(10);
	});

	it("measures the window from today, not from the last point", () => {
		// A series that stops six months ago drops out entirely rather than
		// drawing a stale trend as if it were current.
		expect(withinWindow(series, "2026-06-01")).toEqual([]);
	});
});
