import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadPlan } from "./planFile.js";

function planRoot(files) {
	const root = mkdtempSync(join(tmpdir(), "running-plan-"));
	mkdirSync(join(root, "public/content/running"), { recursive: true });
	for (const [name, body] of Object.entries(files)) {
		writeFileSync(join(root, "public/content/running", name), body);
	}
	return root;
}

describe("loadPlan", () => {
	it("reads current-plan.json from public/content/running", () => {
		const root = planRoot({
			"current-plan.json": JSON.stringify({
				race: { name: "Boston Marathon", date: "2027-04-19" },
				thresholds: { maxHr: 190 },
				weeks: [{ start: "2027-01-04", targetKm: 40 }],
			}),
		});
		try {
			expect(loadPlan(root)).toEqual({
				race: { name: "Boston Marathon", date: "2027-04-19" },
				thresholds: { maxHr: 190 },
				weeks: [{ start: "2027-01-04", targetKm: 40 }],
			});
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("is an empty plan when that file is missing, even if an archived plan sits next to it", () => {
		const root = planRoot({
			"2026-chicago-marathon-plan.json": JSON.stringify({
				race: { name: "Bank of America Chicago Marathon" },
				weeks: [{ start: "2026-05-25" }],
			}),
		});
		try {
			expect(loadPlan(root)).toEqual({ race: {}, thresholds: {}, weeks: [] });
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it("is an empty plan when the file is not valid JSON", () => {
		const root = planRoot({ "current-plan.json": "{not json" });
		try {
			expect(loadPlan(root)).toEqual({ race: {}, thresholds: {}, weeks: [] });
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
