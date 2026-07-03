import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (hashes first so length doesn't leak). */
export function secureCompare(a, b) {
	if (typeof a !== "string" || typeof b !== "string") return false;
	const ha = createHash("sha256").update(a).digest();
	const hb = createHash("sha256").update(b).digest();
	return timingSafeEqual(ha, hb);
}
