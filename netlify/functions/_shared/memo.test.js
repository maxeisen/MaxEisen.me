import { describe, it, expect, vi } from "vitest";
import { createMemo } from "./memo.js";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createMemo", () => {
	it("produces once and serves the cached value within the TTL", async () => {
		const memo = createMemo(10_000);
		const produce = vi.fn(async () => ({ v: 1 }));
		expect(await memo("k", produce)).toEqual({ v: 1 });
		expect(await memo("k", produce)).toEqual({ v: 1 });
		expect(produce).toHaveBeenCalledTimes(1);
	});

	it("re-produces after the TTL expires", async () => {
		let now = 1_000;
		vi.spyOn(Date, "now").mockImplementation(() => now);
		const memo = createMemo(100);
		let n = 0;
		const produce = async () => ({ n: ++n });

		expect(await memo("k", produce)).toEqual({ n: 1 });
		now += 50;
		expect(await memo("k", produce)).toEqual({ n: 1 }); // still fresh
		now += 100;
		expect(await memo("k", produce)).toEqual({ n: 2 }); // expired → reproduced
	});

	it("keys variants independently", async () => {
		const memo = createMemo(10_000);
		const produce = vi.fn(async (key) => ({ key }));
		await memo("a", () => produce("a"));
		await memo("b", () => produce("b"));
		expect(produce).toHaveBeenCalledTimes(2);
		expect(await memo("a", () => produce("a"))).toEqual({ key: "a" });
		expect(produce).toHaveBeenCalledTimes(2); // "a" served from cache
	});

	it("dedupes concurrent callers into a single producer run", async () => {
		const memo = createMemo(10_000);
		const produce = vi.fn(() => new Promise((r) => setTimeout(() => r({ ok: true }), 10)));
		const [a, b] = await Promise.all([memo("k", produce), memo("k", produce)]);
		expect(a).toEqual({ ok: true });
		expect(b).toEqual({ ok: true });
		expect(produce).toHaveBeenCalledTimes(1);
	});

	it("does not cache a rejected producer (retries next call)", async () => {
		const memo = createMemo(10_000);
		let calls = 0;
		const produce = async () => {
			calls++;
			if (calls === 1) throw new Error("boom");
			return { ok: true };
		};
		await expect(memo("k", produce)).rejects.toThrow("boom");
		await flush();
		expect(await memo("k", produce)).toEqual({ ok: true }); // retried, then cached
		expect(calls).toBe(2);
	});
});
