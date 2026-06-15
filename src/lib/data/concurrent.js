// Run an async worker over a list with a bounded number in flight at once.
//
// Used by the gallery bulk download: fetching dozens of full-res photos one at
// a time is needlessly slow, but firing all of them at once hammers the
// network and Cloudinary. A fixed-size pool is the sweet spot.

/**
 * Map `worker` over `items` with at most `limit` running concurrently.
 *
 * Results come back in the original item order (like `Promise.all`), not
 * completion order. A pool of `limit` runners pulls from a shared cursor, so a
 * slow item doesn't head-of-line block the rest the way fixed batches would.
 * On the first worker rejection the pool stops pulling new items and the
 * returned promise rejects with that error (already-running workers settle and
 * are discarded).
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} limit max concurrent workers (clamped to ≥1)
 * @param {(item: T, index: number) => Promise<R>} worker
 * @param {(done: number, total: number) => void} [onSettled] progress callback,
 *   fired after each item resolves.
 * @returns {Promise<R[]>}
 */
export async function mapWithConcurrency(items, limit, worker, onSettled) {
	const list = items || [];
	const total = list.length;
	const results = new Array(total);
	if (total === 0) return results;

	const size = Math.max(1, Math.min(Math.floor(limit) || 1, total));
	let next = 0;
	let done = 0;
	let failed = false;

	async function runner() {
		while (next < total && !failed) {
			const i = next++;
			try {
				results[i] = await worker(list[i], i);
			} catch (err) {
				failed = true;
				throw err;
			}
			done++;
			onSettled?.(done, total);
		}
	}

	const runners = [];
	for (let i = 0; i < size; i++) runners.push(runner());
	await Promise.all(runners);
	return results;
}
