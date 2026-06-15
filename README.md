<p align="center">
  <a href="https://maxeisen.me" target="_blank">
    <img src="https://github.com/maxeisen/MaxEisen.me/blob/master/public/img/additional/memoji_cycle_large.gif" align="center" alt="Max Eisen memoji cycle" width="100">
  </a>
  <h1 align="center">Get to Know Max Eisen</h1>
  <h3 align="center"><b>Deployed to <a href="https://maxeisen.me" target="_blank">MaxEisen.me</a> - check it out!</b></h3>
</p>
<p align="center">
  <a href="https://app.netlify.com/sites/maxeisen/deploys" rel="noreferrer" target="_blank">
    <img src="https://api.netlify.com/api/v1/badges/29ebb303-9e97-44b6-82da-f68a0dee3963/deploy-status" align="center" alt="Netlify Status">
  </a>
</p>

## About
This is my personal website - previously a web version of my resume with some nice, interactive, responsive elements, and now a cooler, more complex website showcasing personal projects, professional experience, and more.

## Development
To install and work on the website locally:

```bash
git clone https://github.com/maxeisen/MaxEisen.me.git
cd MaxEisen.me
npm install
```

To run local server in develop mode:

```bash
npm run dev
```

To build and serve website locally (rollup):

```bash
npm run build
npm run start
```

To run the test suite:

```bash
npm test       # watch mode (Vitest)
npm run test:run   # single run (CI / pre-commit)
```

## Architecture

A Svelte 5 + Vite single-page app fronted by Netlify Functions. The notes below
cover the conventions that keep the codebase maintainable.

### Project layout

```
public/styles/      Global CSS + design tokens (global.css), per-route sheets
src/
  App.svelte        Top-level router → feature roots
  components/<Feature>/   One folder per route/feature (Home, Gallery,
                          Dashboard, Toronto, Bach). Sub-folders group
                          presentation (sections/ widgets/ host/ player/
                          modals/ layout/) and feature logic (lib/).
  lib/              Cross-feature code, NOT tied to one route:
    ui/             Shared presentational components (BackLink, Button,
                    CloseButton, GateOverlay, Spinner)
    data/           Client data layer (fetchJson, swrCache, concurrent)
    strava.js       Promoted feature-agnostic helpers (format/decode)
    tilt.js         Reusable Svelte action
netlify/functions/  Serverless endpoints (see re-export pattern below)
```

Rule of thumb: a component or helper used by **one** feature lives under that
feature's folder; once a **second** feature needs it, promote it to `src/lib/`.

### Netlify function re-export pattern

`netlify-cli` treats every top-level file in `netlify/functions/` as an
endpoint named after the file (e.g. `bach-state.js` → `/.netlify/functions/bach-state`).
It does **not** deploy files in underscore-prefixed sub-folders. So:

- Each flat file is a one-line re-export of the real implementation, e.g.
  `bach-state.js` is just `export { default } from "./bach/state.js";`.
- The actual handlers live in `netlify/functions/bach/` (the Bach game) and
  import cross-cutting helpers from `netlify/functions/_shared/`.
- `_shared/` and `bach/_lib.js` hold the deduplicated boilerplate:
  `env.js` (`getEnv`), `http.js` (`createJsonResponder` + `cacheControl`
  presets), `memo.js` (server-side in-memory cache), `strava.js` (OAuth token
  refresh), `gallery.js` (Cloudinary constants). `bach/_lib.js` adds the Bach
  blob-key schema, validators, the `withBachAuth` POST gate, and binary-response
  helpers.

When adding an endpoint: write the handler under a sub-folder (or directly as a
flat file if it's standalone) and, if sub-foldered, add the matching one-line
flat re-export.

### Caching & the polling model

Three independent caching layers keep upstream calls and re-renders cheap:

1. **CDN edge cache** — every function declares its caching intent via the
   `cacheControl` presets in `_shared/http.js` (`none`, `swr(maxAge, swr)`,
   `edgeBurst`).
2. **Server-side memo** — `_shared/memo.js` adds a short module-scope cache so
   bursts that slip past a cold edge cache (or local `netlify dev`, which has no
   edge) collapse to one upstream call. Used by `githubLatest`, `galleryList`,
   `stravaFeed`, `stravaProfile`.
3. **Client SWR** — `src/lib/data/swrCache.js` serves the last value instantly
   on widget re-mount/navigation and revalidates in the background, deduping
   concurrent requests. Pair `maxAgeMs` **below** the caller's poll interval so
   scheduled polls still refresh on cadence while re-mounts stay free.

Polling cadences:

- **Dashboard widgets** poll on a fixed `setInterval` (5 min for GitHub/Strava/
  HN, 10 s for Spotify) and read through the SWR cache. The Gallery widget loads
  the photo list once and only re-picks a random image on its timer.
- **Bach** (`src/components/Bach/Bach.svelte`) uses a single self-scheduling
  loop: each `poll()` queues the next tick at a phase-appropriate interval
  (`src/components/Bach/lib/poll.js`) — fast during active phases, backed off in
  lobby/results/finished. Action handlers call `poll()` directly for instant
  feedback, which re-arms the schedule so no redundant interval fires alongside.
  `bach-state` (the hottest path) computes image readiness from blob-key
  presence instead of reading image bytes each poll.

### Design tokens & theming

`public/styles/global.css` is the single source of truth for design tokens —
colours, spacing, radius, shadow, blur, z-index, breakpoints, and font sizes —
exposed as CSS custom properties. Light/dark are swapped via `[data-theme]`
blocks. Other stylesheets (e.g. `resume.css`) load `global.css` first and
**consume** the shared tokens rather than redefining them. Svelte components
reference the same `var(--…)` tokens, so a value changes in exactly one place.

### Testing

Logic-first with [Vitest](https://vitest.dev). Tests target pure logic and the
shared modules (data layer, Netlify `_shared`/`_lib` helpers, Bach validators
and readiness index, Strava/Cloudinary helpers) rather than presentational
markup. `*.test.js` files are co-located beside the modules they cover; Netlify
handlers are exercised through Node's global `Request`/`Response` with
`fetch`/`@netlify/blobs` mocked.

A handful of [Playwright](https://playwright.dev) smoke tests in `e2e/`
(`*.e2e.js`) guard the lowest-risk/highest-value flows — the homepage boots,
`/dashboard` mounts its widget grid, `/gallery` renders and its photo fetch
settles. They run against `vite preview` (the static build, no Functions), so
they assert routes render rather than live data. Install the browser once with
`npx playwright install chromium`, then `npm run test:e2e`. A full Bach round is
deliberately **not** an E2E: it spans multiple concurrent clients and external
OpenAI/TTS/image calls, so its logic is covered by unit tests instead.

## Website Quality
MaxEisen.me has been developed and tested for optimal performance, accessibility, best practices, and SEO using Google's Lighthouse evaluation tool. It's also a <a href="https://web.dev/progressive-web-apps/" rel="noreferrer" target="_blank">PWA</a>!

<img src="https://github.com/maxeisen/MaxEisen.me/blob/master/public/img/additional/lighthouse_score.png" align="center" alt="MaxEisen.me Lighthouse score" width="100%">

## Versions
<ul>
  <li>V1 (web resume) - built in plain HTML and CSS</li>
  <li>V2 (portfolio website) - built using Svelte JS framework - old HTML and CSS files ported over</li>
  <li>V3 (blog and themes) - custom blogging system developed to keep my thought process through coding projects, document my life, travel, etc. and light mode!</li>
</ul>
