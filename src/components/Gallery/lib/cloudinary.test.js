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

	// --- signed (authenticated) galleries: helpers prefer the pre-signed
	// URLs the server attaches, falling back to building a public URL. ---
	describe('signed-gallery photos', () => {
		const signed = {
			public_id: 'abc123',
			thumb: 'https://res.cloudinary.com/meisen-gallery/image/authenticated/s--T--/w_800/abc123',
			full: 'https://res.cloudinary.com/meisen-gallery/image/authenticated/s--F--/w_2400/abc123',
			download: 'https://res.cloudinary.com/meisen-gallery/image/authenticated/s--D--/abc123',
		};

		it('uses the pre-signed urls verbatim when present', () => {
			expect(thumbUrl(signed)).toBe(signed.thumb);
			expect(lightboxUrl(signed)).toBe(signed.full);
			expect(slideshowUrl(signed)).toBe(signed.full);
			expect(downloadUrl(signed)).toBe(signed.download);
		});

		it('falls back to a built public url when a signed field is missing', () => {
			expect(thumbUrl({ public_id: 'g/x' })).toContain('/image/upload/');
		});
	});

	describe('downloadFilename with display_name', () => {
		it('prefers the original filename (signed galleries)', () => {
			expect(downloadFilename({ display_name: 'IMG_1234', public_id: 'random9xz' })).toBe('IMG_1234.jpg');
		});

		it('strips an existing extension before appending .jpg', () => {
			expect(downloadFilename({ display_name: 'IMG_1234.jpg' })).toBe('IMG_1234.jpg');
			expect(downloadFilename({ display_name: 'photo.HEIC' })).toBe('photo.jpg');
		});

		it('keeps photographer-style names with separators intact', () => {
			expect(downloadFilename({ display_name: 'LoriWaltenburyPhoto_M+L_1823' })).toBe(
				'LoriWaltenburyPhoto_M+L_1823.jpg',
			);
		});
	});
});
