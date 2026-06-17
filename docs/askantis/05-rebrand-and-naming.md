# Feature 5 — Rebrand & New Name

Goal: ship under a new Askantis name (not "Ferdium"), with our own branding, while staying a clean
GitHub fork so we can still PR generic improvements upstream.

> Apache-2.0 lets us rebrand and redistribute. We must keep the `LICENSE` and existing copyright
> notices, and not imply endorsement by Ferdium.

## 1. Naming

The lineage: **Franz → Ferdi → Ferdium** are all named after **Archduke Franz Ferdinand**. A fitting
new name stays in that Austro-Germanic first-name family, ideally with an Askantis fingerprint
(Askantis is Swiss — `askantis.ch` — and starts with **A**).

### ✅ DECIDED: **Sophie**

Named after **Sophie**, Archduke Franz Ferdinand's wife — the strongest lineage tie of all the
candidates. Concrete derived identifiers (replace the `<AppName>` placeholders below with these):

| Token | Value |
|---|---|
| `productName` | `Sophie` |
| `name` | `sophie` |
| `appId` | `ch.askantis.sophie` |
| `desktopName` | `sophie.desktop` |
| `protocolClient` | `sophie` / `sophie-dev` |
| Data dir (macOS) | `~/Library/Application Support/Sophie` (prod), `SophieDev` (dev) |
| Brand color | TBD — pick an Askantis/Sophie accent to unify `config.ts:8` + `themes/default` |

Other candidates considered (for the record):

| Name | Why it fits | Askantis touch |
|---|---|---|
| **Anton** | Austro-Germanic first name, same register as Franz/Ferdinand | starts with **A** (Askantis); short, friendly, brandable |
| **Sophie** | Franz Ferdinand's wife was Sophie — the perfect companion-lineage name | warm, modern, approachable |
| **Otto** | Habsburg-era name; punchy, memorable, palindrome | distinctive, easy logo |
| **Konrad** (nick "Kuno") | Swiss-German first name | overtly Swiss, matches Askantis' origin |

Stylization option: like "Ferdium" coined an `-ium` ending, we could stylize (e.g. *Antonium*),
but a clean real name reads better as a product. Pick the bare name.

Whatever the name, also choose:
- **Bundle/app id**: reverse-DNS, e.g. `ch.askantis.<appname>` (replaces `org.ferdium.ferdium-app`).
- **Deep-link protocol**: `<appname>` / `<appname>-dev` (replaces `ferdium` / `ferdium-dev`).
- **Data dir name**: derives from `productName` (so `~/Library/Application Support/<AppName>` and
  `<AppName>Dev`). ⚠️ changing this orphans the current dev profile — see
  [`06-migrate-existing-data.md`](06-migrate-existing-data.md).

## 2. Scope: functional identifiers vs cosmetic strings

`grep -rli ferdium src/` hits **192 files**, but they fall into two very different buckets.

### 2a. Functional identifiers — MUST change deliberately (small, high-impact set)

| Where | Current | Change to |
|---|---|---|
| `package.json:2` `name` | `ferdium` | `<appname>` |
| `package.json:3` `productName` | `Ferdium` | `<AppName>` (drives the data-dir & app name) |
| `package.json:4` `desktopName` | `ferdium.desktop` | `<appname>.desktop` |
| `package.json:5` `appId` | `org.ferdium.ferdium-app` | `<APPID>` (`ch.askantis.<appname>`) |
| `package.json:8,10` `author`,`copyright` | Ferdium … | Askantis … (keep upstream credit in NOTICE) |
| `package.json:12,13` `homepage`,`repository` | ferdium URLs | Askantis fork URLs |
| `electron-builder.yml:5` `appId` | `org.ferdium.ferdium-app` | `<APPID>` |
| `electron-builder.yml` product/artifact names, protocols, publish target | Ferdium | `<AppName>` / Askantis |
| `src/environment-remote.ts:80` `protocolClient` | `ferdium` / `ferdium-dev` | `<appname>` / `<appname>-dev` |
| `src/config.ts:8` `DEFAULT_ACCENT_COLOR` | `#7367F0` | Askantis brand color |
| `src/config.ts` URLs (`LIVE_FERDIUM_API` `:17`, website `:29`, GitHub `:509-512`, service-request/translation/docs links) | ferdium.org / github.com/ferdium | **decide per-URL** (see §3) |

> ⚠️ **Don't blindly change the API/website URLs.** `LIVE_FERDIUM_API=https://api.ferdium.org`
> (`config.ts:17`) is Ferdium's cloud sync server. If you point it elsewhere you need your own server
> (or default users to **local mode**). Recommended for v1: keep the recipe-download/API endpoints as
> Ferdium's (so recipes keep working) **or** stand up an Askantis mirror; default the product to
> accountless/local mode and lean on export/import (#3). Document this choice explicitly.

### 2b. Cosmetic strings — bulk, low-risk

User-facing "Ferdium" in i18n strings, menu labels, about box, comments, etc. These can be swept,
but **carefully** (see §4) so as not to rewrite identifiers, the `recipes`/`ferdium-recipes` plumbing,
or upstream URLs you decided to keep. Many live in `src/i18n/locales/en-US.json` and component copy.

### 2c. Branding assets (`branding/`)
Replace: `Ferdium.svg`, `logo.png`, `gradient.png`, icon source files (`darwin-20-icons*.xcf`),
`dmgInstaller.psd`/`download.psd`, `social-preview.psd`, header images. The actual app icons consumed
at build time are referenced from `electron-builder.yml` + `build-helpers/` (`.icns`/`.ico`/`.png`) —
regenerate those from the new logo. Update `branding/README.md`.

## 3. The recipes dependency (important)
Services come from the `recipes` submodule (`github.com/ferdium/ferdium-recipes`) and recipe
downloads/updates hit the Ferdium API (`src/api/server/ServerApi.ts` `getRecipePackage`, the bundled
`all.json`). Options:
- **Keep using Ferdium's recipes** (simplest; gives users the full catalog). Just don't rebrand the
  recipe-fetch URLs. Acknowledge upstream.
- **Fork `ferdium-recipes`** into Askantis and re-point the submodule + download URLs (full control,
  more maintenance, you inherit catalog upkeep).
Recommend keeping Ferdium recipes for v1.

## 4. Keeping the rebrand merge-friendly (so upstream PRs/merges stay cheap)

Branding edits spread across 192 files would make every `git merge upstream/develop` painful.
Minimize the blast radius:
- **Centralize identifiers.** Most functional ids already live in a few files (`package.json`,
  `electron-builder.yml`, `src/config.ts`, `src/environment-remote.ts`). Change only those; avoid
  touching the 192 cosmetic files unless needed.
- **Prefer build-time substitution over source edits** where possible (e.g. a single brand-config
  module that the rest imports, so a merge only conflicts in one place).
- **Keep branding on the `askantis` branch**, never on `develop` (which mirrors upstream). See
  [`00-OVERVIEW.md`](00-OVERVIEW.md) §3.
- Add a `NOTICE` crediting Ferdium/Franz and keep `LICENSE` intact (Apache-2.0 requirement).

## 5. Suggested order
1. Pick the name + appId + protocol + brand color (decision).
2. Change the **functional identifiers** (§2a) on the `askantis` branch; rebuild; verify the app
   launches, the data dir becomes `<AppName>Dev`, deep links work, and packaging
   (`electron-builder.yml`) produces correctly-named artifacts.
3. Swap **branding assets** (§2c) + regenerate icons.
4. Sweep **cosmetic strings** (§2b) last, scripted but reviewed.
5. Update docs (`README.md`, `branding/README.md`, this folder), add `NOTICE`.

## 6. Risks
- Changing `productName` orphans the dev profile (data-dir rename) — plan migration first.
- Repointing API/recipe URLs without a server breaks sync/recipe downloads — default to local mode or
  mirror the backend.
- Over-broad find/replace can corrupt identifiers, recipe ids, or upstream links — script + review.
- Apple Messages Full Disk Access is per-binary — rename/repackage means users re-grant.
- Two accent constants disagree today (`config.ts:8` vs `themes/default/index.ts:11`) — unify on the
  new brand color (also see [`01-design-overhaul.md`](01-design-overhaul.md)).
