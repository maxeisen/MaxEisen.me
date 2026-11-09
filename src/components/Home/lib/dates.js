// Month-granularity dates as the homepage content writes them:
// "February 2026", "Present", or a bare year.

const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];

/** "February 2026" → { year: 2026, month: 1 }; "Present" → today. */
export function parseMonth(value, now = new Date()) {
	if (!value || value === "Present") return { year: now.getFullYear(), month: now.getMonth() };
	const [first, second] = String(value).trim().split(/\s+/);
	const month = MONTHS.indexOf(first);
	if (month >= 0 && /^\d{4}$/.test(second ?? "")) return { year: Number(second), month };
	if (/^\d{4}$/.test(first)) return { year: Number(first), month: 0 };
	return null;
}

/** Whole months from start to end, counting both ends (Jul–Feb is 8). */
export function monthsBetween(start, end, now = new Date()) {
	const a = parseMonth(start, now);
	const b = parseMonth(end, now);
	if (!a || !b) return null;
	const n = (b.year - a.year) * 12 + (b.month - a.month) + 1;
	return n > 0 ? n : null;
}

/** 8 → "8 mos", 12 → "1 yr", 19 → "1 yr 7 mos". */
export function spanLabel(months) {
	const years = Math.floor(months / 12);
	const rest = months % 12;
	const y = years ? `${years} yr${years === 1 ? "" : "s"}` : "";
	const m = rest ? `${rest} mo${rest === 1 ? "" : "s"}` : "";
	return [y, m].filter(Boolean).join(" ");
}

/** "February 2026" → "Feb 2026"; "Present" stays. */
export function shortMonth(value) {
	const parsed = value === "Present" ? null : parseMonth(value);
	if (!parsed || !/^[A-Za-z]/.test(value)) return value;
	return `${MONTHS[parsed.month].slice(0, 3)} ${parsed.year}`;
}
