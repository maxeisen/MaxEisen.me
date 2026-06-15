import { describe, it, expect, vi } from "vitest";
import { mapWithConcurrency } from "./concurrent.js";

// A worker whose resolution we control, so we can observe how many run at once.
function deferred() {
	let resolve, reject;
	const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

describe("mapWithConcurrency", () => {
	it("returns results in input order, not completion order", async () => {
		const out = await mapWithConcurrency([10, 20, 30], 2, async (n) => n * 2);
		expect(out).toEqual([20, 40, 60]);
	});

	it("never exceeds the concurrency limit", async () => {
		let active = 0;
		let peak = 0;
		const work = async () => {
			active++;
			peak = Math.max(peak, active);
			await new Promise((r) => setTimeout(r, 5));
			active--;
		};
		await mapWithConcurrency(Array.from({ length: 10 }), 3, work);
		expect(peak).toBe(3);
	});

	it("starts only `limit` workers before any resolve", async () => {
		const gates = [deferred(), deferred(), deferred(), deferred()];
		const started = [];
		const worker = (item, i) => {
			started.push(i);
			return gates[i].promise;
		};
		const all = mapWithConcurrency(gates, 2, worker);
		await Promise.resolve();
		expect(started).toEqual([0, 1]); // 3rd waits for a slot

		gates[0].resolve("a");
		await Promise.resolve();
		await Promise.resolve();
		expect(started).toContain(2); // freed slot pulled the next item

		gates[1].resolve("b");
		gates[2].resolve("c");
		gates[3].resolve("d");
		await expect(all).resolves.toEqual(["a", "b", "c", "d"]);
	});

	it("reports progress after each settle", async () => {
		const onSettled = vi.fn();
		await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n, onSettled);
		expect(onSettled).toHaveBeenCalledTimes(4);
		expect(onSettled).toHaveBeenLastCalledWith(4, 4);
	});

	it("rejects with the first error and stops pulling new work", async () => {
		let calls = 0;
		const worker = async (n) => {
			calls++;
			if (n === 2) throw new Error("fail-2");
			return n;
		};
		await expect(mapWithConcurrency([1, 2, 3, 4, 5], 1, worker)).rejects.toThrow("fail-2");
		// Serial (limit 1): 1 ok, 2 throws → 3/4/5 never attempted.
		expect(calls).toBe(2);
	});

	it("handles an empty list", async () => {
		await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
	});
});
