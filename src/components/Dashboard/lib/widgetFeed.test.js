import { describe, it, expect, vi } from "vitest";
import { createSWRWidgetFeed } from "./widgetFeed.js";

describe("createSWRWidgetFeed", () => {
	it("loads via SWR fetcher and applies data", async () => {
		const apply = vi.fn();
		const fetcher = vi.fn(async (_url, opts) => {
			// Simulate SWR background revalidate callback firing.
			opts.onRevalidate?.({ from: "revalidate" });
			return { from: "primary" };
		});
		const feed = createSWRWidgetFeed({
			url: "/.netlify/functions/githubLatest",
			apply,
			fetcher,
			pollerFactory: vi.fn(),
		});

		await feed.load();

		expect(fetcher).toHaveBeenCalledWith(
			"/.netlify/functions/githubLatest",
			expect.objectContaining({ maxAgeMs: 60_000, onRevalidate: expect.any(Function) }),
		);
		expect(apply).toHaveBeenNthCalledWith(1, { from: "revalidate" });
		expect(apply).toHaveBeenNthCalledWith(2, { from: "primary" });
	});

	it("routes load failures to onError", async () => {
		const boom = new Error("boom");
		const onError = vi.fn();
		const feed = createSWRWidgetFeed({
			url: "/x",
			apply: vi.fn(),
			onError,
			fetcher: vi.fn(async () => {
				throw boom;
			}),
			pollerFactory: vi.fn(),
		});

		await feed.load();
		expect(onError).toHaveBeenCalledWith(boom);
	});

	it("start triggers an immediate load and returns poll stop", async () => {
		const stop = vi.fn();
		const pollerFactory = vi.fn(() => stop);
		const feed = createSWRWidgetFeed({
			url: "/x",
			apply: vi.fn(),
			fetcher: vi.fn(async () => ({})),
			pollerFactory,
			pollMs: 30_000,
			jitterMs: 3_000,
		});

		const returnedStop = feed.start();
		// `start()` fire-and-forgets the immediate load.
		await Promise.resolve();

		expect(pollerFactory).toHaveBeenCalledWith(expect.any(Function), 30_000, { jitterMs: 3_000 });
		expect(returnedStop).toBe(stop);
	});
});
