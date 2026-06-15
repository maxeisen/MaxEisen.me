import { describe, it, expect } from 'vitest';
import {
	STRAVA_ICONS,
	formatDistance,
	formatDuration,
	formatPace,
	decodePolyline,
	polylineToSvgPath,
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

describe('polyline decode', () => {
	// Canonical Google example.
	const ENCODED = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

	it('returns [] for empty input', () => {
		expect(decodePolyline('')).toEqual([]);
	});

	it('decodes the canonical example', () => {
		const pts = decodePolyline(ENCODED);
		expect(pts).toHaveLength(3);
		expect(pts[0][0]).toBeCloseTo(38.5, 4);
		expect(pts[0][1]).toBeCloseTo(-120.2, 4);
		expect(pts[2][0]).toBeCloseTo(43.252, 4);
		expect(pts[2][1]).toBeCloseTo(-126.453, 4);
	});

	it('renders an SVG path (null when fewer than 2 points)', () => {
		expect(polylineToSvgPath('')).toBeNull();
		const path = polylineToSvgPath(ENCODED);
		expect(path).toMatch(/^M/);
		expect(path).toContain('L');
	});
});
