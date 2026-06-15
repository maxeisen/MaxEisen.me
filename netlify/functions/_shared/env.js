// Read an environment variable, preferring Netlify's runtime accessor when it
// exists (production) and falling back to process.env (local dev / tests).
//
// Underscore-prefixed folder → Netlify does not deploy anything in here as an
// endpoint; the sibling function files import these helpers.
export function getEnv(name) {
	if (typeof Netlify !== "undefined" && Netlify.env?.get) {
		return Netlify.env.get(name);
	}
	return process.env[name];
}
