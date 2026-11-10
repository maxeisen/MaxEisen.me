import { describe, it, expect } from "vitest";
import { sessionCopy, hasSession, plannedRunOf } from "./session.js";

const run = (over = {}) => ({ type: "tempo", detail: "Tempo 5km", distanceKm: 7.5, isRun: true, ...over });

describe("sessionCopy", () => {
	it("names a rest or strength day by what the plan wrote", () => {
		expect(sessionCopy({ status: "rest", planned: [{ type: "strength", detail: "Full body" }] }))
			.toEqual({ title: "strength", note: "Full body" });
		expect(sessionCopy({ status: "rest", planned: [{ type: "rest", detail: "Rest" }] }))
			.toEqual({ title: "rest", note: "no running planned" });
	});

	it("describes a session still ahead", () => {
		expect(sessionCopy({ status: "ahead", planned: [run()] }))
			.toEqual({ title: "tempo", note: "7.5 km · Tempo 5km" });
	});

	it("reports a done session against its target", () => {
		expect(sessionCopy({ status: "done", planned: [run()], actualKm: 7.62 }))
			.toEqual({ title: "7.6 km", note: "of 7.5 · tempo" });
	});

	it("calls an off-plan run unplanned only during a block", () => {
		expect(sessionCopy({ status: "extra", planned: [], actualKm: 5 })).toEqual({ title: "5.0 km", note: "unplanned" });
		expect(sessionCopy({ status: "extra", planned: [], actualKm: 5 }, { inBlock: false }).note).toBe("");
	});
});

describe("hasSession / plannedRunOf", () => {
	it("knows when there's nothing to say", () => {
		expect(hasSession(null)).toBe(false);
		expect(hasSession({ planned: [], actualKm: 0, runs: 0 })).toBe(false);
		expect(hasSession({ planned: [{ type: "rest" }], actualKm: 0 })).toBe(true);
	});
	it("finds the run on a mixed day", () => {
		expect(plannedRunOf({ planned: [{ type: "strength" }, run()] })?.type).toBe("tempo");
	});
});
