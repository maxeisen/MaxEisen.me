// MaxEisen.me service worker
// Bump SHELL_VERSION to force clients to refresh the precache.
const SHELL_VERSION = "v11";
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

	// Don't intercept the Vite build output (/build/*.js|css) at all. The
	// browser's HTTP cache already does the right thing: hashed chunks ship
	// with immutable Cache-Control headers, and the stable-named bundle.js is
	// revalidated each deploy. Letting the SW cache these is what allowed a
	// fresh bundle.js to be paired with a stale hashed chunk — a version skew
	// that crashed /dashboard after deploys. Staying out of the build output
	// removes that skew class entirely. (Trade-off: build assets aren't
	// available offline; precached HTML shells still are.)
	if (url.pathname.startsWith("/build/")) return;

	// Everything else same-origin (HTML navigations, manifest, fonts, icons,
	// static /styles) is network-first with a cache fallback for offline.
	if (url.origin === self.location.origin) {
		event.respondWith(networkFirst(req));
	}
});

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
