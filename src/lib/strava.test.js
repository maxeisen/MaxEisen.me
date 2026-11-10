import { describe, it, expect } from 'vitest';
import {
	STRAVA_ICONS,
	formatDistance,
	formatDuration,
	formatPace,
	routeToSvgPath,
} from './strava.js';

// Characterization tests: lock the CURRENT formatting + decode behavior.
describe('strava formatting', () => {
	it('has an emoji map', () => {
		expect(STRAVA_ICONS.Run).toBe('🏃');
		expect(STRAVA_ICONS.Ride).toBe('🚴');
	});

	it('formats distance with 2 decimals under 10km and 1 at/over', () => {
		expect(formatDistance(null)).toBe('—');
		expect(formatDistance(5000)).toBe('5.00 km');
		expect(formatDistance(10000)).toBe('10.0 km');
		expect(formatDistance(12345)).toBe('12.3 km');
	});

	it('formats duration as h/m', () => {
		expect(formatDuration(null)).toBe('—');
		expect(formatDuration(600)).toBe('10m');
		expect(formatDuration(90)).toBe('1m');
		expect(formatDuration(3661)).toBe('1h 1m');
	});

	it('formats pace for runs and speed for rides', () => {
		expect(formatPace(0, 100, 'Run')).toBeNull();
		expect(formatPace(1000, 300, 'Run')).toBe('5:00 /km');
		expect(formatPace(10000, 1800, 'Ride')).toBe('20.0 km/h');
	});
});

describe('route thumbnail', () => {
	it('is null for a missing or one-point route', () => {
		expect(routeToSvgPath(null)).toBeNull();
		expect(routeToSvgPath([[0, 0]])).toBeNull();
	});

	it('fits the route inside the padded box', () => {
		const path = routeToSvgPath([[0, 0], [500, 1000], [1000, 0]], 56, 38, 5);
		expect(path).toMatch(/^M/);
		const nums = path.match(/-?\d+(\.\d+)?/g).map(Number);
		const xs = nums.filter((_, i) => i % 2 === 0);
		const ys = nums.filter((_, i) => i % 2 === 1);
		expect(Math.min(...xs)).toBeGreaterThanOrEqual(5);
		expect(Math.max(...xs)).toBeLessThanOrEqual(51);
		expect(Math.min(...ys)).toBeGreaterThanOrEqual(5);
		expect(Math.max(...ys)).toBeLessThanOrEqual(33);
	});
});
