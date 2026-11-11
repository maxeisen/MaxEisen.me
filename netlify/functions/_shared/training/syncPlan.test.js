import { describe, it, expect } from "vitest";
import { SHAPE_VERSION } from "./shape.js";
import {
	DETAIL_BUDGET,
	HISTORY_LEAD_DAYS,
	NOTE_BUDGET,
	NOTE_FRESH_WINDOW_MS,
	NOTE_RESCAN_MS,
	historyStartEpoch,
	listingAfter,
	noteSweepTargets,
	queueWork,
	settleSync,
} from "./syncPlan.js";

const TODAY = "2026-11-11";
const NOW = Date.parse("2026-11-11T12:00:00Z");

// A Strava summary on a given day.
function summary(id, day, extra = {}) {
	return {
		id,
		type: "Run",
		sport_type: "Run",
		private: false,
		start_date_local: `${day}T07:00:00Z`,
		distance: 10000,
		moving_time: 3000,
		...extra,
	};
}

// A stored record, current unless told otherwise.
function record(id, day, extra = {}) {
	return { id, sport: "run", startDateLocal: `${day}T07:00:00Z`, v: SHAPE_VERSION, ...extra };
}

function daysBefore(n) {
	return new Date(NOW - n * 86_400_000).toISOString().slice(0, 10);
}

describe("listingAfter", () => {
	const plan = { weeks: [{ start: "2026-09-07" }, { start: "2026-08-31" }] };
	const blockStart = historyStartEpoch(plan);

	it("reaches back far enough before the block for fitness to mean something", () => {
		expect(blockStart).toBe(
			Math.floor((Date.parse("2026-08-31T00:00:00Z") - HISTORY_LEAD_DAYS * 86_400_000) / 1000),
		);
	});

	it("lists from the block's run-up on a cold start", () => {
		expect(listingAfter({ cursor: {}, plan })).toBe(blockStart);
	});

	it("lists only what's new once the cursor has moved", () => {
		const cursor = { lastActivityEpoch: blockStart + 5000 };
		expect(listingAfter({ cursor, plan })).toBe(blockStart + 5000);
	});

	it("pages the whole block back only when asked", () => {
		const cursor = { lastActivityEpoch: blockStart + 5000 };
		expect(listingAfter({ cursor, plan, full: true })).toBe(blockStart);
	});
});

describe("queueWork", () => {
	it("drops private activities before any budget is spent on them", () => {
		const { candidates, queue } = queueWork({
			summaries: [summary(1, TODAY), summary(2, TODAY, { private: true })],
		});
		expect(candidates.map((a) => a.id)).toEqual([1]);
		expect(queue.map((a) => a.id)).toEqual([1]);
	});

	it("skips what is already stored at the current version", () => {
		const { queue } = queueWork({
			summaries: [summary(1, TODAY), summary(2, TODAY)],
			existing: [record(1, TODAY)],
		});
		expect(queue.map((a) => a.id)).toEqual([2]);
	});

	// A re-shape needs no listing at all: the stale records are on disk.
	it("queues stale records from the index without them being listed", () => {
		const { queue } = queueWork({
			summaries: [],
			existing: [record(1, daysBefore(3), { v: SHAPE_VERSION - 1 }), record(2, daysBefore(2))],
		});
		expect(queue).toEqual([
			expect.objectContaining({ id: 1, summary: null, kind: "run" }),
		]);
	});

	it("queues an activity once even when it is both listed and stale", () => {
		const { queue } = queueWork({
			summaries: [summary(1, TODAY)],
			existing: [record(1, TODAY, { v: SHAPE_VERSION - 1 })],
		});
		expect(queue).toHaveLength(1);
		expect(queue[0].summary).toEqual(expect.objectContaining({ id: 1 }));
	});

	it("works newest first and takes no more than the budget", () => {
		const summaries = Array.from({ length: DETAIL_BUDGET + 5 }, (_, i) => summary(i, daysBefore(i)));
		const { queue, enrich } = queueWork({ summaries: [...summaries].reverse() });
		expect(queue).toHaveLength(DETAIL_BUDGET + 5);
		expect(enrich).toHaveLength(DETAIL_BUDGET);
		expect(enrich[0].id).toBe(0);
		expect(enrich.at(-1).id).toBe(DETAIL_BUDGET - 1);
	});

	// Re-running the same tick against the result must move on, or a
	// re-shape picks the same newest activities forever.
	it("finishes a re-shape over successive ticks", () => {
		let existing = Array.from({ length: DETAIL_BUDGET * 2 }, (_, i) =>
			record(i, daysBefore(i), { v: SHAPE_VERSION - 1 }),
		);
		for (let tick = 0; tick < 2; tick++) {
			const { enrich } = queueWork({ existing });
			const done = new Set(enrich.map((a) => a.id));
			existing = existing.map((r) => (done.has(r.id) ? { ...r, v: SHAPE_VERSION } : r));
		}
		expect(queueWork({ existing }).queue).toHaveLength(0);
	});

	it("re-enriches everything on ?full=1", () => {
		const { queue } = queueWork({
			summaries: [summary(1, TODAY)],
			existing: [record(1, TODAY), record(2, daysBefore(1))],
			full: true,
		});
		expect(queue.map((a) => a.id)).toEqual([1, 2]);
	});

	it("tells rides and gym sessions apart, listed or stored", () => {
		const { queue } = queueWork({
			summaries: [summary(1, TODAY, { type: "Ride", sport_type: "Ride", distance: 30000 })],
			existing: [record(2, daysBefore(1), { sport: "strength", v: 0 })],
		});
		expect(queue.map((a) => a.kind)).toEqual(["ride", "strength"]);
	});
});

describe("noteSweepTargets", () => {
	it("reads the last few days' runs and nothing else", () => {
		const records = [
			record(1, daysBefore(5)),
			record(2, daysBefore(2)),
			record(3, daysBefore(1), { sport: "ride" }),
			record(4, TODAY),
		];
		expect(noteSweepTargets(records, TODAY).map((r) => r.id)).toEqual([2, 4]);
	});

	it("keeps to its budget, newest kept", () => {
		const records = Array.from({ length: NOTE_BUDGET + 2 }, (_, i) => record(i, TODAY));
		const targets = noteSweepTargets(records, TODAY);
		expect(targets).toHaveLength(NOTE_BUDGET);
		expect(targets.at(-1).id).toBe(NOTE_BUDGET + 1);
	});
});

describe("settleSync", () => {
	const base = { today: TODAY, now: NOW };

	it("never moves the cursor past an activity it hasn't stored", () => {
		const settled = settleSync({
			...base,
			cursor: { lastActivityEpoch: 100 },
			candidates: [summary(1, daysBefore(1)), summary(2, TODAY)],
			merged: [record(2, TODAY)],
		});
		expect(settled.missing).toBe(1);
		expect(settled.cursor.lastActivityEpoch).toBe(100);
	});

	it("moves the cursor to the newest stored activity once everything listed is in", () => {
		const merged = [record(1, daysBefore(1)), record(2, TODAY)];
		const settled = settleSync({ ...base, candidates: [summary(2, TODAY)], merged });
		expect(settled.cursor.lastActivityEpoch).toBe(Date.parse(`${TODAY}T07:00:00Z`) / 1000);
	});

	// A SHAPE_VERSION bump is not a reader's business; a missing run is.
	it("counts a stale record as stale, never as missing", () => {
		const merged = [record(1, TODAY, { v: SHAPE_VERSION - 1 })];
		const settled = settleSync({ ...base, candidates: [summary(1, TODAY)], merged });
		expect(settled).toMatchObject({ missing: 0, stale: 1 });
		expect(settled.cursor).toMatchObject({ missing: 0, stale: 1, stored: 1 });
	});

	it("waits for the backfill before sweeping notes or captioning", () => {
		const settled = settleSync({ ...base, queued: 3 });
		expect(settled.sweepNotes).toBe(false);
		expect(settled.caption).toBe(false);
	});

	it("leaves Strava alone once it has refused, and stops captioning at the share", () => {
		expect(settleSync({ ...base, rateLimited: true })).toMatchObject({ sweepNotes: false, caption: false });
		expect(settleSync({ ...base, quotaPaused: true })).toMatchObject({ sweepNotes: true, caption: false });
	});

	it("sweeps every tick for a few hours after a run arrives", () => {
		const fresh = settleSync({
			...base,
			cursor: { notesScannedAt: new Date(NOW - 60_000).toISOString() },
			shaped: [record(9, TODAY)],
			merged: [record(9, TODAY)],
		});
		expect(fresh).toMatchObject({ notesFresh: true, sweepNotes: true });
		expect(fresh.cursor.activityArrivedAt).toBe(new Date(NOW).toISOString());
		expect(fresh.cursor.notesScannedAt).toBe(new Date(NOW).toISOString());
	});

	it("drops back to hourly once the run is a few hours old", () => {
		const cursor = {
			activityArrivedAt: new Date(NOW - NOTE_FRESH_WINDOW_MS - 1).toISOString(),
			notesScannedAt: new Date(NOW - NOTE_RESCAN_MS + 60_000).toISOString(),
		};
		const settled = settleSync({ ...base, cursor });
		expect(settled).toMatchObject({ notesFresh: false, sweepNotes: false });
		// Unswept, the stamp stays where it was.
		expect(settled.cursor.notesScannedAt).toBe(cursor.notesScannedAt);
	});

	it("isn't opened by backfilled history nobody is looking at", () => {
		const old = record(1, daysBefore(40));
		const settled = settleSync({ ...base, shaped: [old], merged: [old] });
		expect(settled.notesFresh).toBe(false);
		expect(settled.cursor.activityArrivedAt).toBeNull();
	});

	it("doesn't count a re-shaped run as one that just arrived", () => {
		const run = record(1, TODAY);
		const settled = settleSync({ ...base, existing: [run], shaped: [run], merged: [run] });
		expect(settled.cursor.activityArrivedAt).toBeNull();
	});
});
