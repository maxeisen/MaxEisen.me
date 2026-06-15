import { describe, it, expect } from 'vitest';
import {
	CLOUDINARY_CLOUD,
	cloudinaryUrl,
	displayPixelWidth,
	lightboxUrl,
	thumbUrl,
	slideshowUrl,
	downloadUrl,
	downloadFilename,
} from './cloudinary.js';

// Characterization tests: lock the CURRENT URL shapes before refactoring.
describe('cloudinary helpers', () => {
	it('uses the meisen-gallery cloud', () => {
		expect(CLOUDINARY_CLOUD).toBe('meisen-gallery');
	});

	it('builds a base URL with transforms and no extension', () => {
		expect(cloudinaryUrl('folder/pic', 'f_auto,q_auto,w_800')).toBe(
			'https://res.cloudinary.com/meisen-gallery/image/upload/f_auto,q_auto,w_800/folder/pic',
		);
	});

	it('builds the documented derivative URLs', () => {
		const photo = { public_id: 'gallery/sunrise' };
		expect(thumbUrl(photo)).toBe(
			'https://res.cloudinary.com/meisen-gallery/image/upload/f_auto,q_auto,w_800/gallery/sunrise',
		);
		expect(lightboxUrl(photo)).toBe(
			'https://res.cloudinary.com/meisen-gallery/image/upload/f_auto,q_auto,w_2400/gallery/sunrise',
		);
		expect(downloadUrl(photo)).toBe(
			'https://res.cloudinary.com/meisen-gallery/image/upload/f_jpg,q_auto:best,fl_attachment/gallery/sunrise',
		);
	});

	it('falls back to 2400px width outside the browser', () => {
		// node test environment: no window/screen.
		expect(displayPixelWidth()).toBe(2400);
		expect(slideshowUrl({ public_id: 'g/x' })).toContain('w_2400');
	});

	it('derives a readable download filename', () => {
		expect(downloadFilename({ public_id: 'gallery/2024/sunrise' })).toBe('sunrise.jpg');
		expect(downloadFilename({})).toBe('photo.jpg');
	});
});
