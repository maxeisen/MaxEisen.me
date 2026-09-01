<p align="center">
  <h1 align="center">Get to Know Max Eisen</h1>
  <h3 align="center"><b>Deployed to <a href="https://maxeisen.me" target="_blank">MaxEisen.me</a></b></h3>
</p>
<p align="center">
  <a href="https://app.netlify.com/sites/maxeisen/deploys" rel="noreferrer" target="_blank">
    <img src="https://api.netlify.com/api/v1/badges/29ebb303-9e97-44b6-82da-f68a0dee3963/deploy-status" align="center" alt="Netlify Status">
  </a>
</p>

Personal site. Svelte 5 + Vite SPA with Netlify Functions.

## Features

**Home** (`/`) — Profile, intro, experience, projects, education, and skills, with a light/dark theme.

**Gallery** (`/gallery`) — A public collection of photos.

**Dashboard** (`/dashboard`) — A rearrangeable wall of live widgets: time, weather, Spotify, Strava, GitHub, Hacker News, and a photo from the gallery.

**Training** (`/training`) — Public marathon training dashboard for the 2026 Chicago Marathon: recent runs, fitness, recovery, and a race countdown.

**Toronto** (`/toronto`) — A curated map of places around the city, with recent Strava routes overlaid.

**Bach** (`/bach`) — A private party game: a host and players take turns writing a collaborative story.

**Resume** (`/resume`) — A standalone HTML resume.

## Development

```bash
git clone https://github.com/maxeisen/MaxEisen.me.git
cd MaxEisen.me
npm install
```

Local app + Functions (`netlify dev` — typically http://localhost:8888):

```bash
npm run dev
```

Production build, then static preview on port 6808 (no Functions):

```bash
npm run build
npm run start
```

Tests and lint:

```bash
npm test            # Vitest, watch
npm run test:run    # Vitest, single run (also the Netlify build gate)
npm run test:e2e    # Playwright smokes against the static preview
npm run lint        # ESLint over .js, .mjs, .svelte
```

`npm run test:e2e` needs Chromium once: `npx playwright install chromium`.

Functions that need secrets return `not_configured` when those env vars are missing; the SPA still boots. Netlify's build runs `test:run`, a couple of seed/manifest scripts, then the production build. A failing test keeps the previous deploy live.

## Architecture

`src/App.svelte` is the client router. `/` is Home; other known routes lazy-load from `src/routes/`. `/bach` always full-loads (it is stateful). Unknown paths go to `public/404.html`. `public/resume.html` is a standalone page. `/training` is rewritten to the `trainingPage` function so the same document can boot the SPA or render a noscript fallback.

```
public/
  content/          JSON + markdown the site reads
  styles/           global.css (design tokens) and per-page sheets
src/
  App.svelte        Router
  routes/           Thin route shells
  components/<Feature>/   Home, Gallery, Dashboard, Training, Toronto, Bach
  lib/
    ui/             Shared chrome and rearrangeable-grid helpers
    data/           fetchJson, swrCache, poller, concurrent
    strava.js, tilt.js
netlify/functions/
  *.js              Endpoint entry files
  bach/             Bach handlers (re-exported from the flat files above)
  _shared/          Cross-cutting helpers (not deployed as endpoints)
scripts/            One-off tooling (token exchange, gallery manifest, Bach seed)
```

A helper used by one feature stays in that feature's folder. A second consumer is the signal to move it to `src/lib/`. `/dashboard` and `/training` share the rearrangeable-grid helpers in `lib/ui/` and the `drag-grid` / `drag-tile` styles in `global.css`.

### Functions

Netlify deploys every top-level file in `netlify/functions/` as `/.netlify/functions/<name>`. Underscore-prefixed folders are not endpoints.

Bach uses one-line re-exports (`bach-state.js` → `./bach/state.js`). Other handlers live in the top-level file and import `_shared/` (`env`, `http` cache-control presets, `memo`, plus Strava / Oura / gallery / training helpers).

To add an endpoint: write the handler (a standalone file, or a sub-folder plus a matching re-export) and import `_shared` rather than copying boilerplate.

### Data

Three layers keep upstream calls cheap: function `Cache-Control` via `_shared/http.js`, a short in-process memo in `_shared/memo.js`, and client SWR (`src/lib/data/swrCache.js`) plus a visibility-aware poller (`poller.js`). Pair SWR `maxAgeMs` below the poll interval so scheduled ticks still refresh.

### Theming

`public/styles/global.css` owns the design tokens. Light/dark swap through `[data-theme]`. Other sheets and Svelte components consume `var(--…)` rather than redefining values.

### Tests

Vitest, co-located `*.test.js` next to the module, aimed at pure logic and `_shared` helpers. Playwright specs in `e2e/` smoke the homepage, gallery, dashboard, and training against `vite preview` (static build, no Functions).
