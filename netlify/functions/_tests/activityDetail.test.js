import { describe, it, expect, vi, beforeEach } from "vitest";

const store = { get: vi.fn(), setJSON: vi.fn() };
vi.mock("@netlify/blobs", () => ({ getStore: () => store }));

const ENDPOINTS = [
	["trainingActivity", "../trainingActivity.js"],
	["cyclingActivity", "../cyclingActivity.js"],
];

async function call(path, query) {
	const { default: handler } = await import(path);
	return handler(new Request(`https://maxeisen.me/.netlify/functions/x${query}`));
}

describe.each(ENDPOINTS)("%s", (_name, path) => {
	beforeEach(() => {
		vi.resetModules();
		store.get.mockReset();
		store.get.mockResolvedValue([]);
	});

	it("rejects a missing or non-numeric id without touching Blobs", async () => {
		expect((await call(path, "")).status).toBe(400);
		const res = await call(path, "?id=abc%2F..%2Findex");
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "invalid_id" });
		expect(store.get).not.toHaveBeenCalled();
	});

	it("is a 404 for an id that isn't in the index", async () => {
		const res = await call(path, "?id=123");
		expect(res.status).toBe(404);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("reads the index once for repeat opens on a warm instance", async () => {
		const { default: handler } = await import(path);
		for (const id of ["1", "2", "3"]) {
			await handler(new Request(`https://maxeisen.me/.netlify/functions/x?id=${id}`));
		}
		const reads = store.get.mock.calls.map(([key]) => key);
		expect(reads.filter((k) => k === "index.json")).toHaveLength(1);
		// trainingActivity also reads the synced plan, at most once.
		expect(reads.filter((k) => k !== "index.json").length).toBeLessThanOrEqual(1);
	});
});
