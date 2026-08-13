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

To lint:

```bash
npm run lint   # ESLint over .js, .mjs and .svelte
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
                          presentation (sections/ widgets/ charts/ host/
                          player/ modals/ layout/) and feature logic (lib/).
  lib/              Cross-feature code, NOT tied to one route:
    ui/             Shared presentational components (BackLink, Button, Card,
                    CloseButton, EditToggle, GateOverlay, Spinner) + reorder
                    (drag-to-rearrange), editMode (when it's allowed) and
                    layoutStore (where the arrangement is kept)
    data/           Client data layer (fetchJson, swrCache, concurrent)
    strava.js       Promoted feature-agnostic helpers (format/decode)
    tilt.js         Reusable Svelte action
netlify/functions/  Serverless endpoints (see re-export pattern below)
```

Rule of thumb: a component or helper used by **one** feature lives under that
feature's folder; once a **second** feature needs it, promote it to `src/lib/`.

`lib/ui/Card.svelte` is the site's panel surface — the same recipe as the
`/dashboard` widget shell, plus a header and an optional "i" disclosure that
explains the panel's metrics. Every `/training` section is built on it, so the
card chrome is defined once rather than restated per section.

`lib/ui/reorder.svelte.js` is the drag-to-rearrange behaviour shared by
`/dashboard` and `/training`. The model is slots, not lists: positions are
fixed and sized by the page, and a drop swaps the two panels involved, so
nothing reflows under the cursor mid-drag. Two details are load-bearing and
commented as such — no `setPointerCapture` (it redirects the synthesized click
away from anchors inside a panel), and `draggingId` is only set once the
pointer passes the threshold (the `dragging` class carries
`pointer-events: none`, which would otherwise swallow ordinary clicks). The
pure parts — reconciling a stored layout, swapping slots — live in
`lib/ui/layoutStore.js` so they're testable without compiling runes. Reconciling
rather than validating is deliberate: a saved list of nine ids isn't a
permutation of ten, so adding a panel used to silently reset the arrangement of
anyone who had made one. Now the saved order is kept, unknown ids are dropped,
and a new panel is slotted in at its default position.

`lib/ui/editMode.svelte.js` wraps that in the rule both pages follow: dragging
is free while the layout is wide enough to be pointer-driven, and behind the
`lib/ui/EditToggle` pill once it collapses, where a press-and-drag is otherwise
how you scroll. It also owns the capture-phase click suppression that keeps a
drag from opening whatever it finished on, and keeps taps inert while editing —
the iOS jiggle-mode rule. `createRearrangeable()` hands back a reorder instance
and its edit mode already wired together.

The styling is shared the same way, under "Rearrangeable grids" in
`global.css`: the grab cursor, the gestures a tile swallows so a press-and-drag
isn't read as a scroll, how it looks in flight, the jiggle, and the dashed drop
outline. A page opts in by marking its container `drag-grid` and its tiles
`drag-tile`; the classes the drag sets — `is-dragging`, `is-editing`,
`dragging`, `drop-target` — mean the same thing on both. That's deliberately
not per-component: those rules are the feel of the thing, and keeping a copy
each is how the two pages came to behave differently in the first place.

Because the slots are fixed, the columns are independent: a heavy one just ends
further down the page rather than pulling anything up beside it. So `/training`'s
default order is balanced by measured height as well as by subject, and an e2e
test holds the two columns to within a quarter of each other — hand-balancing is
the kind of thing that rots quietly the next time a panel is added.

What a page still says for itself is what genuinely differs: where its layout
collapses (1100px, 860px), which tiles take the second jiggle so the grid
doesn't rock in lockstep (by slot on the dashboard, by column on training), the
shadow a tile lifts with (opaque widgets want a `box-shadow`, translucent cards
a `drop-shadow`), and the drop outline's geometry, inset on the dashboard and
outset on training, set through `--drop-outline-offset` and
`--drop-outline-radius`.

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
- **`/training`** is a chain of four cadences that only works if they line up,
  since the slowest one is the delay: `trainingSync` reads Strava every 5 min,
  `trainingData` is held at the edge for 60 s (and revalidated by the browser
  every time, so a reload after an upload can't answer itself from a stale
  copy), the page polls every 5 min, and `fetchJsonSwr`'s window is 60 s. A run
  is on the page within roughly 5 minutes of uploading. Change one and check
  the rest — a poll slower than the sync makes an open tab lag a reopened one,
  and an SWR window above the poll interval quietly skips ticks.
- **Bach** (`src/components/Bach/Bach.svelte`) uses a single self-scheduling
  loop: each `poll()` queues the next tick at a phase-appropriate interval
  (`src/components/Bach/lib/poll.js`) — fast during active phases, backed off in
  lobby/results/finished. Action handlers call `poll()` directly for instant
  feedback, which re-arms the schedule so no redundant interval fires alongside.
  `bach-state` (the hottest path) computes image readiness from blob-key
  presence instead of reading image bytes each poll.

### Training data credentials

`/training` reads from two accounts. Both are refreshed server-side by
`trainingSync` and never reach the browser, and the page renders whatever is
already in Blobs if either is absent — an unconfigured integration is a normal
state, not an error.

**Strava** (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`)
uses a long-lived refresh token: authorize once with
`node scripts/get_strava_refresh_token.js`, paste the result into Netlify, and
it keeps working.

**Oura** (`OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`, `OURA_REFRESH_TOKEN`) does
not, and the difference matters. Personal access tokens were withdrawn at the
end of 2025, so this is OAuth2 only, and **refresh tokens are single-use** —
each refresh returns a successor and invalidates the token just spent. To set
it up:

1. Create an application at
   [cloud.ouraring.com/oauth/applications](https://cloud.ouraring.com/oauth/applications)
   with the redirect URI `http://localhost:8889/callback`.
2. Put the client ID and secret in `.env`, then run
   `node scripts/get_oura_refresh_token.js` and follow the printed link.
3. Copy the refresh token it prints into Netlify as `OURA_REFRESH_TOKEN`.

The `daily` scope is enough for everything the page shows. The portal will
offer continuous heart rate, SpO2 and personal details too; `/training` is
public, so the narrowest token that does the job is the one worth holding.

`OURA_REFRESH_TOKEN` is a **bootstrap, not the live credential**. Live token
state lives in Blobs and rotates on every refresh; the environment variable
seeds the first one and is retried if the stored chain ever breaks, which makes
recovery "run the script again and paste the new value" rather than a code
change. Two consequences:

- Don't run the token exchange locally against the value in Netlify. Oura
  invalidates it on use and the successor would be written to your local blob
  store, leaving production holding a dead token.
- If the sync logs `Oura auth failed`, re-run the script rather than debugging
  the code. That is the designed recovery path.

### Recovery and the fitness model

Sleep and overnight heart rate stay **out** of CTL, ATL and form, permanently.
Both traces are exponential averages of the same daily load, which is the only
reason form settles around zero and "+5 is fresh, −20 is buried" means
anything; feeding a second source into part of that system pushes form
permanently negative by roughly the daily load of whatever the extra source was
(this was tried with rides, and reverted — see `_shared/training/fitness.js`).

What the two sources are allowed to do is meet in time, in
`_shared/training/response.js`, which is read by `metrics.js` and by nothing
else:

- **The night after a run** (`nightAfterDay`) — sleep, resting heart rate and
  HRV from the morning after, each against that athlete's own 28-day baseline,
  attached to the Last run panel. Every other number on that panel is computed
  from the run itself, so between them they can only repeat what the training
  log already knew. On the morning of a run there is no night after it yet, so
  the panel falls back to `nightBeforeDay`: not what the run cost, but what you
  took into it.
- **What a hard day costs** (`overnightCost`) — the nights after the hardest
  third of the block's running days against the nights after everything else,
  compared on medians, plus how many nights the heart rate takes to come back
  down. A dose-response curve measured on one athlete rather than assumed.
- **Form against the markers** (`strainSignal`) — form comes from load alone,
  so on its own it can only report back what you told it. The overnight numbers
  are an independent answer to the same question, and the two disagreements are
  what's worth printing: deep form with markers at baseline is a body absorbing
  the block, and raised markers with no load behind them are usually illness,
  travel or short nights. It reaches the Recovery panel and the wording of
  three recommendation rules; it moves no metric.

The separation is asserted, not just documented: `metrics.test.js` builds the
same block with and without a ring and requires every training number to be
identical.

### Design tokens & theming

`public/styles/global.css` is the single source of truth for design tokens —
colours, spacing, radius, shadow, blur, z-index, breakpoints, and font sizes —
exposed as CSS custom properties. Light/dark are swapped via `[data-theme]`
blocks. Other stylesheets (e.g. `resume.css`) load `global.css` first and
**consume** the shared tokens rather than redefining them. Svelte components
reference the same `var(--…)` tokens, so a value changes in exactly one place.

Status colour is a token too: `--tone-good` / `--tone-warn` / `--tone-bad` /
`--tone-info` (each with a `-bg` tint) are resolved per theme, because a colour
that carries meaning — "on track" against "watch this" — has to stay legible on
both backgrounds and can't be two shades of the same accent.

Two surfaces make nesting legible: a panel is `--inner-background`, and
anything inside one (stat tiles, list rows, recommendation cards) is
`--item-background`. Using the same token for both makes a card inside a card
disappear.

### Testing

Logic-first with [Vitest](https://vitest.dev). Tests target pure logic and the
shared modules (data layer, Netlify `_shared`/`_lib` helpers, Bach validators
and readiness index, Strava/Cloudinary helpers) rather than presentational
markup. `*.test.js` files are co-located beside the modules they cover; Netlify
handlers are exercised through Node's global `Request`/`Response` with
`fetch`/`@netlify/blobs` mocked.

A handful of [Playwright](https://playwright.dev) smoke tests in `e2e/`
(`*.e2e.js`) guard the lowest-risk/highest-value flows — the homepage boots,
`/gallery` renders and its photo fetch settles, and `/training` renders its
sections — labelled axes, plan-matched run log, working "i" disclosures —
without any of them growing wider than a phone screen. Rearranging is asserted
on both pages that do it, since they share the code: a drag swaps two tiles and
survives a reload, the Edit toggle is absent until the layout collapses, and on
a phone the tiles keep `touch-action` (and their taps) until it's pressed. They run against `vite preview` (the static build, no
Functions), so they assert routes render rather than live data; `/training`
needs a payload before it draws anything wide, so it gets one from the real
metrics engine (`e2e/fixtures/trainingPayload.js`) via a route stub. Install the browser once with
`npx playwright install chromium`, then `npm run test:e2e`. A full Bach round is
deliberately **not** an E2E: it spans multiple concurrent clients and external
OpenAI/TTS/image calls, so its logic is covered by unit tests instead.

### Linting

`.eslintrc.cjs` describes how this repo is actually written rather than a
preset it doesn't follow, so the rules are readable while writing instead of
turning up in a pull request review. Every rule that departs from the stock
defaults carries its reason in the file; the recurring ones are one-line guards
without braces (`if (!dayKey) return "";`), `snake_case` fields kept as they
arrive from Strava and Cloudinary, `console.log` treated as output in
`scripts/` and as a leftover everywhere else, and empty `catch` blocks where a
failure genuinely means "the same as absent".

It runs clean. Cyclomatic complexity is the one rule set to warn rather than
error — a handful of older functions sit above the limit and splitting them up
is its own piece of work — alongside Svelte's own compiler warnings (a11y,
unused CSS), which `vite build` prints too.

Pull requests are also analysed by [Codacy](https://www.codacy.com). Two notes
on making that agree with the above:

- ESLint v8 there reads `.eslintrc.cjs`, which requires **Code patterns →
  ESLint → Configuration file** to be switched on for the repository. It is.
  Turning it off makes Codacy analyse with its own defaults, which disagree
  with the house style above on nearly every file — one-line guards, wire-format
  field names, `console.warn` in Functions — and report a few hundred issues
  that are convention rather than defects. Codacy doesn't re-analyse after a
  pattern change, so a pull request open at the time needs a new commit before
  it reflects one.
- PMD is excluded from JavaScript in `.codacy.yaml`. Its JS parser predates ES
  modules and numeric separators, so it misreads the source rather than finding
  anything in it; the file explains the specific failures.

## Website Quality
MaxEisen.me has been developed and tested for optimal performance, accessibility, best practices, and SEO using Google's Lighthouse evaluation tool. It's also a <a href="https://web.dev/progressive-web-apps/" rel="noreferrer" target="_blank">PWA</a>!

<img src="https://github.com/maxeisen/MaxEisen.me/blob/master/public/img/additional/lighthouse_score.png" align="center" alt="MaxEisen.me Lighthouse score" width="100%">

## Versions
<ul>
  <li>V1 (web resume) - built in plain HTML and CSS</li>
  <li>V2 (portfolio website) - built using Svelte JS framework - old HTML and CSS files ported over</li>
  <li>V3 (blog and themes) - custom blogging system developed to keep my thought process through coding projects, document my life, travel, etc. and light mode!</li>
</ul>
