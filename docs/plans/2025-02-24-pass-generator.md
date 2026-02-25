# Pass Generator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/pass-generator` route and page where users enter name, title, and photo URL; a Netlify function generates a signed Apple Wallet (.pkpass) business card and returns it for download.

**Architecture:** Client-side pathname-based routing in the existing Svelte app (no new router dependency). One Netlify serverless function in `netlify/functions/` uses `passkit-generator` with certs from env; function fetches photo from URL and returns `.pkpass` with download headers.

**Tech Stack:** Svelte 5, Vite 6, passkit-generator (Node, in function only), Netlify Functions (ESM).

**Design reference:** `docs/plans/2025-02-24-pass-generator-design.md`

---

## Task 1: Netlify config and SPA redirect

**Files:**
- Create: `netlify.toml`

**Step 1: Add netlify.toml**

Create `netlify.toml` at project root with build, publish, functions directory, and SPA redirect so `/pass-generator` (and any path) serves `index.html`.

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Step 2: Commit**

```bash
git add netlify.toml
git commit -m "chore: add Netlify config and SPA redirect"
```

---

## Task 2: Install passkit-generator

**Files:**
- Modify: `package.json`

**Step 1: Add dependency**

Run: `npm i passkit-generator`

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add passkit-generator for Wallet pass generation"
```

---

## Task 3: Netlify function — generatePass

**Files:**
- Create: `netlify/functions/generatePass.mjs`

**Step 1: Implement function**

Create the function that:
- Accepts POST with JSON body `{ name, title, photoUrl }`.
- Validates presence and non-empty strings; returns 400 with `{ error: "..." }` if invalid.
- Reads certs from env: `PASSKIT_PASS_TYPE_ID`, `PASSKIT_TEAM_ID`, `PASSKIT_ORGANIZATION_NAME`, `PASSKIT_SIGNER_CERT`, `PASSKIT_SIGNER_KEY`, `PASSKIT_SIGNER_KEY_PASSPHRASE` (optional), `PASSKIT_WWDR_CERT`. Use `Netlify.env.get("VAR_NAME")` (or in Node `process.env` for local dev with Netlify Dev).
- Fetches image from `photoUrl` (e.g. `fetch(photoUrl)`). On failure or non-OK response, return 400 with `{ error: "Couldn't load photo from that URL." }`.
- Creates a `storeCard` pass with `PKPass`: empty buffers `{}`, certificates object from env, props including `passTypeIdentifier`, `teamIdentifier`, `organizationName`, `description` (e.g. "Business card"), `serialNumber` (e.g. `crypto.randomUUID()`).
- Pushes one primary field (key `name`, value from input) and one secondary field (key `title`, value from input).
- Adds thumbnail (and optionally logo) from fetched image buffer: `pass.addBuffer("thumbnail.png", imageBuffer)` (and `thumbnail@2x.png` if you want 2x; can use same buffer for both for simplicity).
- Calls `pass.getAsBuffer()` and returns response with `Content-Type: application/vnd.apple.pkpass`, `Content-Disposition: attachment; filename="pass.pkpass"`, body as buffer.
- On any throw (e.g. missing env, signing error), catch and return 500 with `{ error: "Something went wrong." }` and log the actual error server-side.

Use ESM: `import { PKPass } from "passkit-generator";` and `export default async (req, context) => { ... }`. Ensure the handler only runs for POST; for GET/other methods return 405.

**Step 2: Test locally (manual)**

Run `npx netlify dev` (or `netlify dev` if CLI installed). POST to `http://localhost:8888/.netlify/functions/generatePass` with a JSON body. Without real certs you expect 500; with certs you expect a binary response. Confirm 400 for missing fields.

**Step 3: Commit**

```bash
git add netlify/functions/generatePass.mjs
git commit -m "feat: add generatePass Netlify function for Apple Wallet .pkpass"
```

---

## Task 4: Client-side routing and PassGenerator page shell

**Files:**
- Modify: `src/App.svelte`
- Create: `src/components/PassGenerator.svelte`

**Step 1: Route by pathname in App.svelte**

- Import `PassGenerator`.
- Use reactive check: `$: pathname = typeof window !== 'undefined' ? window.location.pathname : '';` (or use `bind:pathname` with a small store or `popstate` listener so route updates on back/forward).
- If `pathname === '/pass-generator'`, render `<PassGenerator />` only (no MenuBar, no grid layout).
- Else render the existing layout (ModalProvider, MenuBar, grid with Profile, Intro, etc.).

**Step 2: Create PassGenerator.svelte shell**

- Minimal page: a heading (e.g. "Wallet pass generator") and a short line of copy. Reuse site styles where possible (e.g. same CSS classes or link global styles). Include a link back to home: `<a href="/">Home</a>`.

**Step 3: Verify routing**

- Run `npm run dev`. Open `/`. Then open `/pass-generator`. Confirm pass-generator view shows; confirm home shows for `/`.

**Step 4: Commit**

```bash
git add src/App.svelte src/components/PassGenerator.svelte
git commit -m "feat: add /pass-generator route and PassGenerator page shell"
```

---

## Task 5: Pass generator form and download flow

**Files:**
- Modify: `src/components/PassGenerator.svelte`

**Step 1: Add form and state**

- Form fields: Name (text input), Title (text input), Photo URL (url input). Labels and accessibility (e.g. `for`/`id`).
- State: `name`, `title`, `photoUrl` (strings); `loading` (boolean); `error` (string, e.g. from API).

**Step 2: Submit handler**

- On submit: set `loading = true`, `error = ''`. POST to `/.netlify/functions/generatePass` with `body: JSON.stringify({ name, title, photoUrl })`, `headers: { 'Content-Type': 'application/json' }`.
- If response not ok: read body as JSON if possible, set `error` to `body.error` or "Something went wrong." Set `loading = false`.
- If response ok: get blob from response, create object URL, create an `<a download="pass.pkpass">` and trigger click, revoke object URL. Set `loading = false`; optionally show a short "Download started" message.

**Step 3: UX**

- Disable submit button while `loading`. Show `error` below form when non-empty. Style to match site (e.g. use existing global/form styles).

**Step 4: Commit**

```bash
git add src/components/PassGenerator.svelte
git commit -m "feat: pass generator form and .pkpass download"
```

---

## Task 6: Nav link to pass generator

**Files:**
- Modify: `src/components/MenuBar.svelte`

**Step 1: Add link**

- In the nav list, add a list item with `<a href="/pass-generator">Pass generator</a>` (or "Wallet pass" / your preferred label). Use same pattern as existing links (e.g. Resume).

**Step 2: Commit**

```bash
git add src/components/MenuBar.svelte
git commit -m "feat: add nav link to pass generator"
```

---

## Task 7: .env.example and .gitignore

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: .env.example**

Create `.env.example` with the variable names and short comments (no real values):

```
# Apple Wallet pass signing (see docs/plans/2025-02-24-pass-generator-design.md)
PASSKIT_PASS_TYPE_ID=
PASSKIT_TEAM_ID=
PASSKIT_ORGANIZATION_NAME=
PASSKIT_SIGNER_CERT=
PASSKIT_SIGNER_KEY=
# PASSKIT_SIGNER_KEY_PASSPHRASE=   # optional
PASSKIT_WWDR_CERT=
```

**Step 2: .gitignore**

Add `.env` to `.gitignore` so local env with real certs is never committed.

**Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add .env.example and ignore .env"
```

---

## Execution handoff

Plan complete and saved to `docs/plans/2025-02-24-pass-generator.md`.

**Two execution options:**

1. **Subagent-driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Parallel session (separate)** — Open a new session with executing-plans and run the plan there with checkpoints.

Which approach do you want?
