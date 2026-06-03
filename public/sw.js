// MaxEisen.me service worker
// Bump SHELL_VERSION to force clients to refresh the precache.
const SHELL_VERSION = "v10";
const SHELL_CACHE = `maxeisen-shell-${SHELL_VERSION}`;
const RUNTIME_CACHE = `maxeisen-runtime-${SHELL_VERSION}`;

const PRECACHE_URLS = [
	"/",
	"/dashboard",
	"/gallery",
	"/resume.html",
	"/manifest.json",
	"/fonts/inter-latin.woff2",
	"/fonts/fraunces-latin.woff2",
	"/img/icons/site-icons/icon-192.png",
	"/img/icons/site-icons/icon-512.png",
	"/img/icons/site-icons/apple_touch_icon.png",
];

const NETWORK_ONLY_HOSTS = [
	"api.open-meteo.com",
	"air-quality-api.open-meteo.com",
	"geocoding-api.open-meteo.com",
	"api.bigdatacloud.net",
	"hacker-news.firebaseio.com",
	"api.cloudinary.com",
	"res.cloudinary.com", // we want fresh images, not stale cache
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL_CACHE);
			// Use individual adds with catch — one missing asset shouldn't fail the whole precache.
			await Promise.all(
				PRECACHE_URLS.map((url) =>
					cache.add(url).catch((err) => console.warn("SW precache miss:", url, err.message)),
				),
			);
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
					.map((k) => caches.delete(k)),
			);
			await self.clients.claim();
		})(),
	);
});

// Vite dev server paths — these don't exist in production, but during
// `netlify dev` they're served dynamically by vite. We must not cache them,
// or a momentarily-broken dev response (e.g. SPA rewrite catching an asset
// path) will be served forever after.
const DEV_BYPASS_PREFIXES = ["/src/", "/@vite/", "/@id/", "/@fs/", "/node_modules/"];

self.addEventListener("fetch", (event) => {
	const req = event.request;
	if (req.method !== "GET") return;

	const url = new URL(req.url);

	// Don't intercept Netlify Functions (live data).
	if (url.pathname.startsWith("/.netlify/functions/")) return;

	// Don't intercept vite dev paths. The hostname check is belt-and-suspenders;
	// the path check is what catches HMR + source-module fetches.
	if (DEV_BYPASS_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

	// Don't intercept third-party APIs and dynamic image hosts.
	if (NETWORK_ONLY_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith("." + host))) {
		return;
	}

	// Same-origin caching strategy:
	//   - cache-first ONLY for content-hashed build assets (immutable: a
	//     new build emits a new filename, so a cache hit is always correct
	//     and we never serve stale code).
	//   - network-first for everything else — HTML navigations AND
	//     stable-named-but-mutable assets like /build/bundle.js and the
	//     non-hashed CSS files. Those keep the same URL while their content
	//     changes every deploy, so cache-first would pin a stale entry —
	//     which is exactly how a stale bundle.js kept importing a deleted
	//     chunk hash and broke /dashboard after a deploy.
	if (url.origin === self.location.origin) {
		event.respondWith(isImmutableAsset(url) ? cacheFirst(req) : networkFirst(req));
	}
});

// Vite content-hashed output: `name-<8charhash>.js|css` (e.g.
// Dashboard-vU0_TR_2.js, maplibre-gl-Dx3IWJ0j.js). The hash changes with
// content, so these URLs are safe to treat as immutable. Stable names
// (bundle.js, index.css, Dashboard.css, …) deliberately do NOT match.
function isImmutableAsset(url) {
	return url.pathname.startsWith("/build/") && /-[A-Za-z0-9_-]{8}\.(?:js|css)$/.test(url.pathname);
}

async function networkFirst(req) {
	const cache = await caches.open(RUNTIME_CACHE);
	try {
		const fresh = await fetch(req);
		if (fresh.ok) cache.put(req, fresh.clone());
		return fresh;
	} catch {
		const cached = (await cache.match(req)) || (await caches.match(req));
		if (cached) return cached;
		// As an offline fallback, return the cached homepage shell.
		const home = await caches.match("/");
		if (home) return home;
		return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
	}
}

async function cacheFirst(req) {
	const cached = await caches.match(req);
	if (cached) return cached;
	try {
		const fresh = await fetch(req);
		if (fresh.ok) {
			const cache = await caches.open(RUNTIME_CACHE);
			cache.put(req, fresh.clone());
		}
		return fresh;
	} catch {
		return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
	}
}
