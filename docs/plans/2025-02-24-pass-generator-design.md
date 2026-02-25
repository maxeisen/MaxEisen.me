# Pass Generator (Apple Wallet business card) — Design

## Goal

A new route `/pass-generator` on MaxEisen.me where users enter **name**, **title**, and **photo (URL)**. The app generates an Apple Wallet (.pkpass) business card and triggers a download. No barcodes or complex pass features.

## Architecture

- **Frontend:** Svelte 5 app with a lightweight client-side router. When path is `/pass-generator`, render a dedicated page; otherwise render the existing home layout. New page includes a form and calls a Netlify serverless function.
- **Backend:** One Netlify serverless function that receives JSON `{ name, title, photoUrl }`, fetches the image from the URL, uses `passkit-generator` with Apple signing materials from env, and returns the `.pkpass` binary with download headers.
- **Hosting:** Existing Netlify site. No extra services. Functions live in `netlify/functions/` and deploy with the site.

## Tech stack

- **Router:** Minimal SPA router (e.g. one dependency or small custom solution).
- **Pass generation:** `passkit-generator` (npm) in the Netlify function only.
- **Runtime:** Node in Netlify Functions; certs and keys from Netlify environment variables.

## Data flow

1. User visits `/pass-generator`. If not yet unlocked, they see a password form. They POST `{ password }` to `/.netlify/functions/checkPassGeneratorPassword`; if it matches `PASS_GENERATOR_PASSWORD` (env), the client stores the password in `sessionStorage` and shows the main form.
2. User fills form (name, title, photo URL) and submits.
3. Client POSTs `{ name, title, email, photoUrl }` to `/.netlify/functions/generatePass` with header `X-Pass-Generator-Password: <stored password>`. The function validates the password against `PASS_GENERATOR_PASSWORD` first; if missing or wrong, returns 401. Then it validates input, loads certs from env, fetches image from `photoUrl`, builds a **generic** pass (name, title, optional email, thumbnail, logo, QR barcode). Returns `application/vnd.apple.pkpass` with `Content-Disposition: attachment; filename="pass.pkpass"`.
4. Client receives binary response and triggers download (e.g. blob URL + anchor click or `Content-Disposition` handled by browser). If the client receives 401 from `generatePass`, it clears the stored password and shows the password gate again.

## Pass structure

- **Type:** `generic` (thumbnail displays reliably; storeCard did not show thumbnail in Wallet).
- **Fields:** Primary (name), secondary (title), optional auxiliary (email). Logo and thumbnail (profile photo from URL) with rounded corners; QR barcode (wealthsimple.com).
- **Images:** Photo from user URL → thumbnail + icon (PNG, rounded). Logo from repo asset (`netlify/functions/assets/wealthsimple-logo.png`). Function fetches photo URL server-side; if fetch fails, return 400.
- **Required pass props:** `passTypeIdentifier`, `serialNumber` (UUID), `organizationName`, `description`, team ID and signing credentials from env.

## Error handling

- **Validation:** Missing/invalid name, title, or photoUrl → 400 + JSON `{ error: "message" }`. Client shows message under form.
- **Image fetch failure:** Unreachable URL or non-image → 400 + JSON error. Client shows e.g. "Couldn't load photo from that URL."
- **Signing/env:** Missing or invalid certs in env → 500 + generic message. Log details server-side only.
- **Network/other:** 500 with generic "Something went wrong." Client shows same generic message.

## Netlify: environment variables and hosting

### Environment variables (required for the function)

These are **runtime** secrets for the serverless function. Do **not** put them in `netlify.toml` or in the repo; set them in the Netlify UI (or CLI) so they are available to Functions at runtime.

| Variable | Description | Example / format |
|----------|-------------|------------------|
| `PASS_GENERATOR_PASSWORD` | Password required to access the pass generator page and to call the generate function. Set in Netlify env; never commit. | Any strong string (e.g. random) |
| `PASSKIT_PASS_TYPE_ID` | Pass Type Identifier (reverse-DNS, e.g. `pass.com.yourdomain.businesscard`) | From Apple Developer > Certificates, IDs & Profiles > Identifiers |
| `PASSKIT_TEAM_ID` | Apple Developer Team ID | 10-character string |
| `PASSKIT_ORGANIZATION_NAME` | Name shown under the pass in Wallet | Your name or brand |
| **One of:** encrypted file, BUNDLE, or cert+key below | | |
| `PASSKIT_SIGNER_SECRET` | (Optional) **Recommended for 4KB limit.** 32-byte decryption key (base64). Used with `signer.enc`; only this small value is in env. See "Encrypted signer file (recommended)" below. | Output of `scripts/create-signer-enc.js` |
| `PASSKIT_SIGNER_BUNDLE` | (Optional) Single var = base64(Brotli/gzip(cert + `\n---KEY---\n` + key)). Do not set when using SIGNER_SECRET + signer.enc. | See "Creating PASSKIT_SIGNER_BUNDLE" below |
| `PASSKIT_SIGNER_CERT` | Signer certificate (PEM). Use if not using SIGNER_SECRET or BUNDLE. | Contents of `.pem` cert file |
| `PASSKIT_SIGNER_KEY` | Signer **private key** (PEM). Use if not using SIGNER_SECRET or BUNDLE. | Contents of `.pem` key file |
| `PASSKIT_SIGNER_KEY_PASSPHRASE` | (Optional) Passphrase if the key is encrypted | String or leave unset |
| `PASSKIT_WWDR_CERT` | (Optional) **Omit to save env size:** the repo bundles `netlify/functions/assets/wwdr-g4.pem`. | Download from [Apple PKI](https://www.apple.com/certificateauthority/) if overriding |

**Encrypted signer file (recommended for 4KB limit)**

Signer cert + key are stored in an **encrypted file** in the repo (`netlify/functions/assets/signer.enc`). Only a **32-byte key** lives in Netlify env as `PASSKIT_SIGNER_SECRET`, so Functions stay under the AWS Lambda 4KB env limit. The function decrypts at runtime (AES-256-GCM + Brotli).

**Create the key and encrypted file (one-time)**

1. **Get PEMs** for your Pass Type ID:
   - If you have a `.p12`:  
     `openssl pkcs12 -in YourPass.p12 -clcerts -nokeys -out signer-cert.pem`  
     `openssl pkcs12 -in YourPass.p12 -nocerts -nodes -out signer-key.pem`  
     (Key files with "Bag Attributes" from pkcs12 are accepted; the function strips them.)
   - Or use existing `signer-cert.pem` and `signer-key.pem` (cert first, key second).

2. **Run the script** (from repo root):  
   `node scripts/create-signer-enc.js <cert.pem> <key.pem>`  
   Example: `node scripts/create-signer-enc.js scripts/signer-cert.pem scripts/signer-key.pem`  
   The script writes `netlify/functions/assets/signer.enc` and **prints a single base64 line** (the 32-byte key).

3. **Set the key in env:** Add that base64 line as `PASSKIT_SIGNER_SECRET` in Netlify (Functions scope) and in local `.env`. Do **not** commit the key or put it in the repo.

4. **Commit the encrypted file:** Commit `signer.enc`. The file is encrypted; only someone with `PASSKIT_SIGNER_SECRET` can recover the signer.

Use **only one** signer method: either SIGNER_SECRET + signer.enc, or BUNDLE, or CERT + KEY. If `PASSKIT_SIGNER_BUNDLE` is set but invalid (e.g. wrong paste), the function falls back to signer.enc when available.

**Creating PASSKIT_SIGNER_BUNDLE (alternative)**

Use **one** env var instead of separate CERT + KEY. The value is base64(compressed(cert + `\n---KEY---\n` + key)). This still counts toward the 4KB env limit; for minimal env size, use the encrypted signer file above.

- **Brotli (smaller):** From the directory with your PEM files (project uses ESM, so use a small script or):  
  `node -e "const z=require('zlib'),f=require('fs'),c=f.readFileSync('signer-cert.pem','utf8'),k=f.readFileSync('signer-key.pem','utf8');console.log(z.brotliCompressSync(Buffer.from(c+'\\n---KEY---\\n'+k)).toString('base64'))"`  
  Paste the full output into Netlify as `PASSKIT_SIGNER_BUNDLE` (no quotes in env).
- **Gzip (also supported):**  
  `( cat signer-cert.pem; echo "---KEY---"; cat signer-key.pem ) | gzip -n | base64 -w0`  
  (On macOS without `-w0`, use `base64` and trim newlines when pasting.)

**Certificate setup (avoid “PassKit Certificate has an incorrect value”)**

- **Signer cert:** Must be the **Pass Type ID certificate** from Apple Developer (Certificates, IDs & Profiles → Identifiers → Pass Type IDs → your pass type → Create Certificate). Not a generic Development or Distribution cert.
- **CSR Common Name:** When creating the Certificate Signing Request for that Pass Type ID certificate, **leave the Common Name field blank**. If you put any value there, Apple copies it into the cert and validators (e.g. pkpassvalidator) will report “PassKit Certificate has an incorrect value”. Create a new CSR with CN blank, then create a new Pass Type ID certificate from it.
- **WWDR:** Use **WWDR G4** only. Download from [Apple PKI](https://www.apple.com/certificateauthority/); convert `.cer` to PEM if needed: `openssl x509 -inform DER -outform PEM -in WWDR.cer -out wwdr.pem`.

**Where to set them**

1. **Netlify UI:** Site → **Site configuration** (or **Site settings**) → **Environment variables**.
2. Add each variable. For **scopes**, include **Functions** (or **All**) so the serverless function can read them at runtime.
3. For sensitive values (cert, key, passphrase), use **Secret** or **Sensitive** so they are masked in the UI and not shown in logs.

**Local development**

- Use Netlify Dev (`netlify dev`) so the function runs with the same contract as production.
- Create a `.env` file in the project root (and add `.env` to `.gitignore` if not already). Netlify Dev loads `.env` into the function runtime; do not commit `.env`.
- Optional: add a `.env.example` (no real values) listing the variable names and short descriptions so others know what to set.

### Hosting and build

- **No change to build command.** Keep the existing Vite build (e.g. `npm run build`). The site continues to deploy as a static SPA plus redirects if any.
- **Functions directory:** Netlify expects functions in `netlify/functions/` by default. Each file (e.g. `generatePass.mjs`) becomes an endpoint at `/.netlify/functions/generatePass`. No extra config needed unless you customize the functions directory in `netlify.toml`.
- **Redirects for SPA:** Ensure all routes (including `/pass-generator`) serve `index.html` so the client router can run. If the site already has a catch-all redirect for the SPA, no change. If not, add in `netlify.toml` or **Redirects** in the UI:
  - Rule: `/*` → `/index.html` with status **200** (rewrite).

### Optional: netlify.toml

If you don’t have a `netlify.toml` yet, you can add one to make build and redirects explicit:

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

If you already have a different publish directory or build command, keep those; only add `functions = "netlify/functions"` and the SPA redirect if missing.

---

## Production deployment (maxeisen.me)

Use this section once the pass-generator code is merged to `master` and you want to go live at **https://maxeisen.me/pass-generator**.

### Prerequisites

- Repo is connected to Netlify and deploys from `master` (or your production branch).
- You have already been deploying the **frontend** from this repo; we are adding **Netlify Functions** to the same site so both static site and serverless functions deploy together.

### What Netlify will do on each deploy

1. **Build:** Run `npm run build` (Vite), producing `dist/`.
2. **Functions:** Bundle everything in `netlify/functions/` (including `netlify/functions/assets/` for the QR and logo images). Each `.js` file in `netlify/functions/` becomes an endpoint:
   - `checkPassGeneratorPassword.js` → `/.netlify/functions/checkPassGeneratorPassword`
   - `generatePass.js` → `/.netlify/functions/generatePass`
3. **Publish:** Serve `dist/` as the site and run functions in Netlify’s serverless environment.
4. **Redirects:** The existing `/*` → `/index.html` (200) ensures `/pass-generator` serves the SPA; the client router then shows the pass-generator page.

No separate “server” deploy is required: the same Git push that deploys the frontend also deploys the functions.

### Required Netlify configuration

**1. Build settings (usually from `netlify.toml`)**

Your `netlify.toml` should have:

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

- **Build command:** `npm run build` (builds the Svelte/Vite app).
- **Publish directory:** `dist` (where Vite outputs the static site).
- **Functions directory:** `netlify/functions` (so Netlify deploys both functions and includes `netlify/functions/assets/` in the function bundle).

If these are already in `netlify.toml`, Netlify will use them. You can also set **Build command**, **Publish directory**, and **Functions directory** in the Netlify UI under **Site configuration** → **Build & deploy** → **Build settings**; the UI overrides `netlify.toml` when both are set.

**2. Environment variables (must be set in Netlify)**

Go to **Site configuration** (or **Site settings**) → **Environment variables**. Add these for **Production** (and optionally **All** or **Branch deploys** if you want them on previews). Ensure **Scopes** include **Functions** so the serverless functions can read them.

| Variable | Required | Description |
|----------|----------|-------------|
| `PASS_GENERATOR_PASSWORD` | Yes | Password to access the tool and to call the generate function. Use a strong random string. |
| `PASSKIT_PASS_TYPE_ID` | Yes | Pass Type Identifier (e.g. `pass.com.yourdomain.businesscard`). From Apple Developer → Identifiers → Pass Type IDs. |
| `PASSKIT_TEAM_ID` | Yes | Apple Developer Team ID (10 characters). |
| `PASSKIT_ORGANIZATION_NAME` | Yes | Name shown under the pass in Wallet. |
| `PASSKIT_SIGNER_CERT` | Yes | Full PEM of the Pass Type ID certificate (including `-----BEGIN CERTIFICATE-----` / `-----END CERTIFICATE-----`). |
| `PASSKIT_SIGNER_KEY` | Yes | Full PEM of the **private key** for that certificate (`-----BEGIN PRIVATE KEY-----` or `-----BEGIN RSA PRIVATE KEY-----`). |
| `PASSKIT_SIGNER_KEY_PASSPHRASE` | No | Only if the key is encrypted. |
| `PASSKIT_WWDR_CERT` | No | Optional. WWDR G4 is bundled in `netlify/functions/assets/wwdr-g4.pem`. Set only if you need to override (e.g. newer cert). **Omit to stay under the 4KB Lambda env limit.** |

- For **sensitive** values (password, signer cert, signer key, passphrase), mark them **Secret** or **Sensitive** in the UI so they are masked and not shown in logs.
- For multi-line PEMs you can paste with real newlines, or use `\n` in a single line; the function normalizes both.

**3. Domain**

- The tool is at **https://maxeisen.me/pass-generator**.
- If maxeisen.me is already the production domain for this site in Netlify, no extra domain config is needed. The SPA redirect ensures `/pass-generator` serves `index.html`, and the app router shows the pass-generator page.

### After pushing to master

1. Push (or merge) the pass-generator branch to `master`.
2. Netlify will start a new deploy: build the frontend and deploy the functions.
3. Wait for the deploy to succeed (Build log should show “Functions bundling” and a successful build).
4. Open **https://maxeisen.me/pass-generator**.
5. Enter the value you set for `PASS_GENERATOR_PASSWORD`; the form should appear.
6. Submit name, title, optional email, and a photo URL; confirm the `.pkpass` downloads and opens in Wallet as expected.

### If something goes wrong

- **404 on /pass-generator:** Confirm the SPA redirect is in place (`/*` → `/index.html` with status 200). Confirm the latest deploy published the `dist` that contains the pass-generator route.
- **401 from the functions:** Check that `PASS_GENERATOR_PASSWORD` is set in Netlify and that its scope includes **Functions**. Redeploy after changing env vars if Netlify doesn’t pick them up automatically.
- **500 from generatePass:** Check Netlify **Functions** log for the error. Usually missing or invalid `PASSKIT_*` env (cert, key). WWDR is bundled in repo so only set if overriding. Ensure PEMs are complete and that the signer cert is the **Pass Type ID** certificate, not a generic dev/dist cert.
- **Deploy fails with "environment variables exceed the 4KB limit" (AWS Lambda):** Do **not** set `PASSKIT_WWDR_CERT` in Netlify; the repo bundles `netlify/functions/assets/wwdr-g4.pem`. If still over 4KB, use minimal PEMs (no extra newlines, or base64 single-line) for cert and key.
- **Build fails:** Ensure `npm run build` and `npm install` succeed locally. Netlify runs `npm install` then your build command; if sharp or other native deps fail, you may need to set **NODE_VERSION** (e.g. `18` or `20`) in environment variables to match what you use locally.

### Checklist before launch

- [ ] `netlify.toml` has `functions = "netlify/functions"` and the SPA redirect.
- [ ] All required environment variables are set in Netlify with **Functions** scope.
- [ ] Sensitive variables are marked Secret/Sensitive.
- [ ] Code (including `netlify/functions/` and `netlify/functions/assets/`) is on the deployed branch.
- [ ] You’ve tested a full flow on **https://maxeisen.me/pass-generator** after a deploy.

---

## Summary

- **Route:** `/pass-generator` on maxeisen.me; form with name, title, optional email, photo URL; password gate; download of `.pkpass`.
- **Backend:** Netlify Functions `checkPassGeneratorPassword` and `generatePass`. Pass type **generic** (name, title, email, thumbnail, logo, QR barcode); thumbnail and logo use rounded corners.
- **Secrets:** All Apple signing material and the gate password come from Netlify environment variables (and `.env` for local dev). Never commit certs or keys.
- **Deploy:** Same Git push to `master` deploys both the static site and the functions; see **Production deployment (maxeisen.me)** for Netlify config, env vars, and launch checklist.
