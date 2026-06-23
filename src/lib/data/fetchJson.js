// Shared client-side JSON fetch helper.
//
// Collapses the copy-pasted `fetch → res.ok check → res.json()` blocks in the
// dashboard widgets and the gallery into one place. Non-OK HTTP responses throw
// a typed FetchError carrying the status code, so callers can branch on it
// (e.g. 503 → hide a widget, 401 → re-prompt for a password) instead of
// re-implementing the status plumbing. Network failures and JSON-parse errors
// propagate as their native errors.

export class FetchError extends Error {
	constructor(status, statusText, url) {
		super(`Request failed (${status}${statusText ? ` ${statusText}` : ""})${url ? ` for ${url}` : ""}`);
		this.name = "FetchError";
		this.status = status;
		this.statusText = statusText;
		this.url = url;
	}
}

/**
 * Narrow an unknown error to a FetchError with a specific status code.
 *
 * Useful for widget code paths like "503 => hide this card".
 *
 * @param {unknown} err
 * @param {number} status
 * @returns {boolean}
 */
export function isFetchErrorStatus(err, status) {
	return err instanceof FetchError && err.status === status;
}

/**
 * Fetch a URL and parse the JSON body.
 *
 * @param {string} url
 * @param {RequestInit} [options] - passed straight to fetch (headers, method,
 *   body, signal for AbortController, …).
 * @returns {Promise<any>} the parsed JSON body on a 2xx response.
 * @throws {FetchError} when the response status is not OK (the AbortController
 *   `AbortError` and JSON-parse errors propagate unchanged).
 */
export async function fetchJson(url, options = {}) {
	const res = await fetch(url, options);
	if (!res.ok) {
		throw new FetchError(res.status, res.statusText, url);
	}
	return res.json();
}
