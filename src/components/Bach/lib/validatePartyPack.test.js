import { describe, it, expect } from 'vitest';
import { validatePartyPack, MAX_PARTY_PACK_BYTES } from './validatePartyPack.js';

// Characterization tests: lock the CURRENT behavior before refactoring.
describe('validatePartyPack', () => {
	it('exports a 2MB size cap', () => {
		expect(MAX_PARTY_PACK_BYTES).toBe(2 * 1024 * 1024);
	});

	it('rejects non-objects', () => {
		expect(validatePartyPack(null)).toBe('Root must be a JSON object.');
		expect(validatePartyPack(undefined)).toBe('Root must be a JSON object.');
		expect(validatePartyPack('nope')).toBe('Root must be a JSON object.');
		expect(validatePartyPack([])).toBe('Root must be a JSON object.');
	});

	it('requires at least one pool', () => {
		expect(validatePartyPack({})).toBe('Include at least one pool with prompts.');
		expect(validatePartyPack({ pools: [] })).toBe('Include at least one pool with prompts.');
	});

	it('requires each pool to be an object', () => {
		expect(validatePartyPack({ pools: ['x'] })).toBe('Each pool must be an object.');
	});

	it('requires each pool to carry a non-empty prompts array', () => {
		expect(validatePartyPack({ pools: [{ id: 'p1' }] })).toBe('Pool "p1" needs a prompts array.');
		expect(validatePartyPack({ pools: [{ label: 'Lbl', prompts: [] }] })).toBe('Pool "Lbl" needs a prompts array.');
		expect(validatePartyPack({ pools: [{ prompts: [] }] })).toBe('Pool "?" needs a prompts array.');
	});

	it('accepts a valid pack (returns null)', () => {
		expect(validatePartyPack({ pools: [{ id: 'p1', prompts: ['a colour'] }] })).toBeNull();
	});

	it('rejects packs over the byte cap', () => {
		const huge = { pools: [{ id: 'p1', prompts: ['x'.repeat(MAX_PARTY_PACK_BYTES + 10)] }] };
		expect(validatePartyPack(huge)).toMatch(/too large/);
	});
});
