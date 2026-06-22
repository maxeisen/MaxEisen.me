import { describe, it, expect } from "vitest";
import { sortPhotos } from "./sortPhotos.js";

const ids = (arr) => arr.map((p) => p.id);

describe("sortPhotos", () => {
	it("date-desc orders by created_at, newest first", () => {
		const photos = [
			{ id: "a", created_at: "2025-01-01T00:00:00Z" },
			{ id: "b", created_at: "2025-03-01T00:00:00Z" },
			{ id: "c", created_at: "2025-02-01T00:00:00Z" },
		];
		expect(ids(sortPhotos(photos, "date-desc"))).toEqual(["b", "c", "a"]);
	});

	it("captured-asc walks capture time oldest-first", () => {
		const photos = [
			{ id: "late", captured_at: "2025-06-29T18:00:00" },
			{ id: "early", captured_at: "2025-06-29T09:00:00" },
			{ id: "mid", captured_at: "2025-06-29T13:00:00" },
		];
		expect(ids(sortPhotos(photos, "captured-asc"))).toEqual(["early", "mid", "late"]);
	});

	it("captured-asc falls back to created_at when capture time is missing", () => {
		const photos = [
			{ id: "noexif", created_at: "2026-06-22T16:00:00Z" }, // upload time, sorts last
			{ id: "shot", captured_at: "2025-06-29T09:00:00" },
		];
		expect(ids(sortPhotos(photos, "captured-asc"))).toEqual(["shot", "noexif"]);
	});

	it("captured-asc breaks ties by natural filename (batch-scanned frames keep roll order)", () => {
		const ts = "2025-07-09T12:45:39";
		const photos = [
			{ id: "10", captured_at: ts, display_name: "roll_10" },
			{ id: "2", captured_at: ts, display_name: "roll_2" },
			{ id: "1", captured_at: ts, display_name: "roll_1" },
		];
		// numeric-aware: roll_2 before roll_10, not lexicographic
		expect(ids(sortPhotos(photos, "captured-asc"))).toEqual(["1", "2", "10"]);
	});

	it("filename-asc is numeric-aware (…_999 before …_1000)", () => {
		const photos = [
			{ id: "x", display_name: "IMG_1000" },
			{ id: "y", display_name: "IMG_999" },
			{ id: "z", display_name: "IMG_1001" },
		];
		expect(ids(sortPhotos(photos, "filename-asc"))).toEqual(["y", "x", "z"]);
	});

	it("filename-asc falls back to public_id when display_name is absent", () => {
		const photos = [
			{ id: "b", public_id: "b_2" },
			{ id: "a", public_id: "a_1" },
		];
		expect(ids(sortPhotos(photos, "filename-asc"))).toEqual(["a", "b"]);
	});

	it("does not mutate the input array", () => {
		const photos = [{ id: "b", created_at: "2" }, { id: "a", created_at: "1" }];
		const copy = [...photos];
		sortPhotos(photos, "date-desc");
		expect(photos).toEqual(copy);
	});

	it("random shuffles (injectable rng) but preserves membership", () => {
		const photos = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
		// rng always returns 0 -> Fisher–Yates rotates deterministically
		const out = sortPhotos(photos, "random", () => 0);
		expect(ids(out).sort()).toEqual(["a", "b", "c", "d"]);
		expect(out).toHaveLength(4);
	});

	it("unknown sort leaves order unchanged (copy)", () => {
		const photos = [{ id: "a" }, { id: "b" }];
		expect(ids(sortPhotos(photos, "nope"))).toEqual(["a", "b"]);
	});
});
