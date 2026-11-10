import { describe, it, expect } from "vitest";
import { completedSessions, mergeRunnaPlan, parseIcs, toPlanWeeks, upcomingPlan } from "./runna.js";
import { combinePlans } from "./planFile.js";
import { comparePlan, plannedKm, plannedLongRunKm } from "./plan.js";

// Shaped like Runna's feed: plan week 2 starts Monday 2026-11-09, so the
// block's first Monday is 2026-11-02. Completed events carry GEO/LOCATION the
// way the real ones do, to prove neither survives parsing.
const PLAN = "5a2edab3-0ef5-45ae-9d3f-0cad430f41df";
function upcoming(week, type, date, summary, description = "", duration = 3000) {
	return [
		"BEGIN:VEVENT",
		`UID:UPCOMING_PLAN_WORKOUT-${PLAN}_plan_week_${week}_${type}_0`,
		"DTSTAMP:20261031",
		`DTSTART:${date}`,
		`SUMMARY:${summary}`,
		`DESCRIPTION:${description}`,
		"X-USER-TIMEZONE:America/Toronto",
		`X-WORKOUT-ESTIMATED-DURATION:${duration}`,
		"END:VEVENT",
	].join("\r\n");
}
function completed(id, stamp, summary) {
	return [
		"BEGIN:VEVENT",
		`UID:COMPLETED_PLAN_WORKOUT-garmin-${id}`,
		`DTSTART:${stamp}`,
		`SUMMARY:${summary}`,
		"DESCRIPTION:📊 Summary:\\nDistance: 7.51 km",
		"LOCATION:123 Home Street\\, Toronto",
		"GEO:43.6532;-79.3832",
		"END:VEVENT",
	].join("\r\n");
}

const FEED = [
	"BEGIN:VCALENDAR",
	"VERSION:2.0",
	"PRODID:-//Runna//EN",
	completed(1, "20261104T175635", "🏃 7.5km Easy Run"),
	completed(2, "20261106T183241", "🏃 Tempo 2-1-1"),
	completed(3, "20261106T190000", "Upper Body Lift"),
	completed(4, "20261108T120334", "🏃 12km Progressive Long Run"),
	upcoming(2, "LEGS_AND_CORE", "20261110", "🏋️ Strong Foundation • 40m - 50m", "Legs And Core • 40m - 50m\\n\\n2 sets of:\\n• Heel Walks"),
	upcoming(2, "INTERVALS", "20261111", "🏃 400m Repeats • 7km", "Intervals • 7km • 35m - 45m\\n\\n8 reps of:\\n• 400m at 3:35/km", 2700),
	upcoming(2, "LONG_RUN", "20261115", "🏃 13km Hilly Long Run • 13km", "Long Run • 13km • 1h0m - 1h10m", 4200),
	// Far enough out that Runna hasn't written the detail yet.
	upcoming(6, "TEMPO", "20261209", "🏃 Tempo", "", 2400),
	upcoming(23, "RACE", "20270411", "🏃 Around The Bay 2027 • 30km", "Race • 30km • 2h5m - 2h10m", 7800),
	"END:VCALENDAR",
].join("\r\n");

const TODAY = "2026-11-10";

describe("parseIcs", () => {
	it("reads dates, unescapes text and unfolds continuation lines", () => {
		const folded = FEED.replace("SUMMARY:🏃 400m Repeats • 7km", "SUMMARY:🏃 400m Re\r\n peats • 7km");
		const events = parseIcs(folded);
		expect(events).toHaveLength(9);
		const reps = events.find((e) => e.uid.includes("INTERVALS"));
		expect(reps).toMatchObject({ date: "2026-11-11", summary: "🏃 400m Repeats • 7km", durationSec: 2700 });
		expect(reps.description.split("\n")[0]).toBe("Intervals • 7km • 35m - 45m");
	});

	it("never keeps location fields", () => {
		const json = JSON.stringify(parseIcs(FEED));
		expect(json).not.toMatch(/43\.65|79\.38|Home Street/);
		expect(json).not.toMatch(/GEO|LOCATION/);
	});

	it("is empty for anything that isn't a calendar", () => {
		expect(parseIcs(null)).toEqual([]);
		expect(parseIcs("<html>Not found</html>")).toEqual([]);
	});
});

describe("upcomingPlan", () => {
	const plan = upcomingPlan(parseIcs(FEED));

	it("dates the block from Runna's week numbers and finds the race", () => {
		expect(plan.blockStart).toBe("2026-11-02");
		expect(plan.race).toEqual({ name: "Around The Bay 2027", date: "2027-04-11", distanceM: 30000 });
	});

	it("maps Runna's workout types onto the plan vocabulary", () => {
		expect(plan.sessions.map((s) => [s.date, s.day, s.type])).toEqual([
			["2026-11-10", "Tuesday", "strength"],
			["2026-11-11", "Wednesday", "intervals"],
			["2026-11-15", "Sunday", "long run"],
			["2026-12-09", "Wednesday", "tempo"],
			["2027-04-11", "Sunday", "race"],
		]);
	});

	it("takes distance when Runna has written it, and a duration when it hasn't", () => {
		const [strength, reps, long, tempo] = plan.sessions;
		expect(strength).toMatchObject({ detail: "Strong Foundation (40m - 50m)", durationMin: 50 });
		expect(strength).not.toHaveProperty("distanceKm");
		expect(reps).toMatchObject({ detail: "400m Repeats", distanceKm: 7 });
		expect(long).toMatchObject({ detail: "13km Hilly Long Run", distanceKm: 13 });
		expect(tempo).toMatchObject({ detail: "Tempo (~40m)", durationMin: 40 });
		expect(tempo).not.toHaveProperty("distanceKm");
	});
});

describe("completedSessions", () => {
	it("types finished planned workouts from their titles", () => {
		const done = completedSessions(parseIcs(FEED), "2026-11-02", TODAY);
		expect(done.map((s) => [s.date, s.type, s.distanceKm ?? null])).toEqual([
			["2026-11-04", "easy run", 7.5],
			["2026-11-06", "tempo", null],
			["2026-11-06", "strength", null],
			["2026-11-08", "long run", 12],
		]);
	});
});

describe("mergeRunnaPlan", () => {
	const events = parseIcs(FEED);

	it("backfills the block's elapsed days from completed workouts on a first read", () => {
		const merged = mergeRunnaPlan(null, events, TODAY);
		expect(merged.sessions[0]).toMatchObject({ date: "2026-11-04", type: "easy run" });
		expect(merged.sessions).toHaveLength(9);
	});

	it("follows the feed for future days, so a moved workout moves", () => {
		const first = mergeRunnaPlan(null, events, TODAY);
		const moved = parseIcs(FEED.replace("DTSTART:20261111", "DTSTART:20261112"));
		const next = mergeRunnaPlan(first, moved, TODAY);
		const reps = next.sessions.filter((s) => s.type === "intervals" && s.distanceKm === 7);
		expect(reps.map((s) => s.date)).toEqual(["2026-11-12"]);
	});

	it("keeps the plan for a day once it has passed, even after it leaves the feed", () => {
		const first = mergeRunnaPlan(null, events, TODAY);
		// Next day: today's strength session is done and gone from UPCOMING.
		const later = parseIcs(FEED.replace(/BEGIN:VEVENT\r\nUID:UPCOMING[^]*?LEGS_AND_CORE[^]*?END:VEVENT\r\n/, ""));
		const next = mergeRunnaPlan(first, later, "2026-11-11");
		expect(next.sessions.find((s) => s.date === TODAY)).toMatchObject({ type: "strength", detail: "Strong Foundation (40m - 50m)" });
	});

	it("drops a future day the feed no longer lists", () => {
		const first = mergeRunnaPlan(null, events, TODAY);
		const removed = parseIcs(FEED.replace(/BEGIN:VEVENT\r\nUID:UPCOMING[^]*?TEMPO[^]*?END:VEVENT\r\n/, ""));
		const next = mergeRunnaPlan(first, removed, TODAY);
		expect(next.sessions.some((s) => s.date === "2026-12-09")).toBe(false);
	});

	it("keeps the stored race and block start if the feed comes back without them", () => {
		const first = mergeRunnaPlan(null, events, TODAY);
		const next = mergeRunnaPlan(first, [], TODAY);
		expect(next.race).toEqual(first.race);
		expect(next.blockStart).toBe("2026-11-02");
	});
});

describe("toPlanWeeks + combinePlans", () => {
	const merged = mergeRunnaPlan(null, parseIcs(FEED), TODAY);
	const weeks = toPlanWeeks(merged.sessions);

	it("groups sessions into Monday weeks the way the plan file writes them", () => {
		expect(weeks.map((w) => w.start)).toEqual(["2026-11-02", "2026-11-09", "2026-12-07", "2027-04-05"]);
		expect(weeks[1].sessions[1]).toEqual({ day: "Wednesday", type: "intervals", detail: "400m Repeats", distanceKm: 7, durationMin: 45 });
		expect(weeks[1].key).toEqual([
			{ type: "intervals", detail: "400m Repeats, 7km" },
			{ type: "long run", detail: "13km Hilly Long Run" },
		]);
	});

	it("feeds plan.js the same volume and long-run targets a hand-written week would", () => {
		expect(plannedKm(weeks[1])).toBe(20);
		expect(plannedLongRunKm(weeks[1])).toBe(13);
		// No distances written yet is no target, not a target of zero.
		expect(comparePlan([{ start: "2026-12-07", actualKm: 10 }], { weeks })[0].targetKm).toBeNull();
	});

	it("lets the file supply thresholds and override race fields for the same race", () => {
		const file = { race: { date: "2027-04-11", goalTimeSec: 7500, label: "Road to the Bay" }, thresholds: { maxHr: 191 }, weeks: [{ start: "2026-01-05" }] };
		const plan = combinePlans(file, merged);
		expect(plan.thresholds).toEqual({ maxHr: 191 });
		expect(plan.race).toEqual({ name: "Around The Bay 2027", date: "2027-04-11", distanceM: 30000, goalTimeSec: 7500, label: "Road to the Bay" });
		expect(plan.weeks[0].start).toBe("2026-11-02");
	});

	it("ignores a file race for a different race, and falls back to the file without a feed", () => {
		const stale = { race: { date: "2026-10-11", name: "Chicago" }, thresholds: {}, weeks: [] };
		expect(combinePlans(stale, merged).race.name).toBe("Around The Bay 2027");
		expect(combinePlans(stale, null)).toBe(stale);
		expect(combinePlans(stale, { sessions: [] })).toBe(stale);
	});
});
