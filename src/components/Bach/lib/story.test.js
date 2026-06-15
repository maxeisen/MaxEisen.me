import { describe, it, expect } from 'vitest';
import { formatStory, buildStoryBlocks } from './story.js';

// Characterization tests: lock the CURRENT parsing + interleave behavior.
describe('formatStory', () => {
	it('handles empty input', () => {
		expect(formatStory('')).toEqual({ title: '', paragraphs: [] });
	});

	it('extracts the title and escapes/bolds paragraphs', () => {
		const out = formatStory('# The Tale\n\nOnce <b>upon</b> a time.\n\nThe **end**.');
		expect(out.title).toBe('The Tale');
		expect(out.paragraphs).toEqual([
			'Once &lt;b&gt;upon&lt;/b&gt; a time.',
			'The <strong>end</strong>.',
		]);
	});
});

describe('buildStoryBlocks', () => {
	it('interleaves images after the matching paragraph index', () => {
		const blocks = buildStoryBlocks(
			['p0', 'p1', 'p2'],
			[
				{ id: 5, insertAfter: 0, caption: 'cap' },
				{ id: 6, insertAfter: 2 },
			],
			{ 5: 'blob:5' },
		);
		expect(blocks).toEqual([
			{ type: 'paragraph', html: 'p0', index: 0 },
			{ type: 'image', id: 5, url: 'blob:5', caption: 'cap' },
			{ type: 'paragraph', html: 'p1', index: 1 },
			{ type: 'paragraph', html: 'p2', index: 2 },
			{ type: 'image', id: 6, url: null, caption: '' },
		]);
	});

	it('returns only paragraphs when there are no placements', () => {
		expect(buildStoryBlocks(['a', 'b'], null, {})).toEqual([
			{ type: 'paragraph', html: 'a', index: 0 },
			{ type: 'paragraph', html: 'b', index: 1 },
		]);
	});
});
