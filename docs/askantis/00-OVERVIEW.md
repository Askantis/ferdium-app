# Askantis (Ferdium fork) — Project Overview & Roadmap

> This is the master planning document for the **Askantis** product, a downstream fork of
> [Ferdium](https://github.com/ferdium/ferdium-app) (itself a hard-fork of Franz/Ferdi).
> It is the entry point to the detailed per-feature design docs in this folder.

## 0. Status / where we are

| Thing | State |
|---|---|
| Product name | **Sophie** (decided) · appId `ch.askantis.sophie` · protocol `sophie`/`sophie-dev` |
| Upstream | `ferdium/ferdium-app` (Apache-2.0) |
| Our fork | `Askantis/ferdium-app` (GitHub network fork, so we can PR upstream) |
| Local clone | this repo, branch `develop` tracking our fork |
| Remotes | `origin` → Askantis fork · `upstream` → ferdium (push disabled on upstream) |
| Toolchain | Node **22.18.0** (via `fnm`), pnpm **10.14.0** (via `corepack`) |
| Baseline build | ✅ `pnpm install` + `node esbuild.mjs` succeed; `build/` populates |

### Dev environment (every new shell)
```bash
eval "$(fnm env)" && fnm use         # selects 22.18.0 from .nvmrc
corepack enable                      # ensures pnpm 10.14.0
```

### Build / run
```bash
pnpm dev            # esbuild watch -> ./build
pnpm start          # electron ./build  (launches the app; dev profile)
pnpm start:all-dev  # dev watch + start together (normal dev loop)
pnpm start:live     # same but talks to the LIVE Ferdium API (USE_LIVE_API=1)
pnpm build          # full production build + electron-builder packaging
pnpm typecheck / pnpm lint / pnpm test
```

> ⚠️ The dev build uses a **separate data directory** (`~/Library/Application Support/FerdiumDev`),
> so it will not touch your brew-installed Ferdium profile. See
> [`06-migrate-existing-data.md`](06-migrate-existing-data.md) to copy your real profile over.

## 1. The four features (+ rebrand)

| # | Feature | Doc | Rough size |
|---|---|---|---|
| 1 | **Design overhaul** — rounded "card-on-background" UI, modernized Settings, gradient accents derived from service-icon colors, hover-nav scroll-to-switch, **Favorites page** (pin contacts, type, auto-route + send) | [`01-design-overhaul.md`](01-design-overhaul.md) | Large |
| 2 | **Local Apple Messages** — iMessage as a native (non-webview) service reading the local `chat.db`, Beeper-style, with Full Disk Access | [`02-apple-messages.md`](02-apple-messages.md) | Large |
| 3 | **Account-free export/import** — dump all services + workspaces + settings to one file, import on another machine, no cloud account | [`03-export-import.md`](03-export-import.md) | Medium |
| 4 | **Local AI assistant** — in-app assistant via local model download (Qwen), local/remote **Ollama** over HTTP, and **MCP** | [`04-local-ai.md`](04-local-ai.md) | Large |
| — | **Rebrand + new name** | [`05-rebrand-and-naming.md`](05-rebrand-and-naming.md) | Medium |

## 2. Architecture primer (shared context for all features)

Ferdium is **Electron 37 + React 18 + MobX 6 + TypeScript**, bundled with **esbuild**
(`esbuild.mjs`). Main process entry is `index.js` → built from `src/index.ts`.

Key facts every feature touches:

- **MobX store architecture.** Global stores in `src/stores/*` (`AppStore`, `ServicesStore`,
  `SettingsStore`, `RecipesStore`, `UserStore`, `UIStore`, `FeaturesStore`, …). They are exposed
  on `window.ferdium.stores`. Actions live in `src/actions/*`. Components consume them via
  `@inject('stores','actions') @observer`.

- **Services = recipes in webviews.** Each service (WhatsApp, Slack…) is a `<webview>` whose
  content is a website, plus a "recipe" (`recipes/recipes/<id>/`) with `package.json` + `index.js`
  (host side) + `webview.js` (guest side). The preload `src/webview/recipe.ts` bridges host↔guest
  over IPC (`message-counts`, `notification`, `toggle-to-talk`, …). The render branch point is
  `src/components/services/content/ServiceView.tsx:182-193` — **this is where a non-web service
  (Apple Messages) plugs in.**

- **Two parallel theming systems** (this is the #1 gotcha for the design work):
  1. **react-jss runtime theme object** — `src/themes/{default,dark,legacy}/index.ts`, served via
     `ThemeProvider theme={ui.theme}` (`AppLayoutContainer.tsx`). Brand color
     `#7266F0`.
  2. **Static SCSS compiled at build time** — `src/styles/*.scss`, raw values in
     `globals.scss`, derived in `colors.scss`. `$theme-border-radius: 6px` (`globals.scss:11`).
  3. Plus a **runtime CSS injector** for the user's accent color:
     `src/features/appearance/index.ts` rewrites a `<style>` tag and **hardcodes
     `.tab-item.is-active`** (`:132-135`) with `!important`-ish overrides — so any tab/card
     restyle must be mirrored here or it gets silently overridden.

- **Persistence / "sync".** There is no separate sync engine. Services + workspaces always go
  through an HTTP API (`apiBase()`); that API is either Ferdium's **cloud** server *or* a
  **bundled local AdonisJS server** (`src/internal-server/`) backed by
  `<userData>/server.sqlite` when the user runs accountless (`settings.app.server === LOCAL_SERVER`).
  App settings/proxy/shortcuts are plain JSON in `<userData>/config/*.json`
  (`src/electron/Settings.ts`). **An account-free export/import already exists** server-side
  (`/export`, `/transfer` in `UserController.js`) — feature #3 mostly wraps & extends it.

- **Feature framework.** Optional features live in `src/features/*` and are registered in
  `src/stores/FeaturesStore.ts:_setupFeatures()`. **`src/features/todos/` is the canonical template**
  for a side-panel feature (store extending `FeatureStore`, settings toggle, panel mounted in
  `AppLayout.tsx`). The AI assistant (#4) follows this template.

- **Security posture (important).** The main window runs **`nodeIntegration: true,
  contextIsolation: false`** (`src/index.ts:243-244`) — the renderer has full Node/IPC access and
  there is no contextBridge for the app shell. Convention is still to route external I/O
  (HTTP, child processes, file/db access) through **main-process IPC handlers**
  (`src/electron/ipc-api/*`), mirroring the existing `translate` handler. All new native work
  (Apple Messages DB reads, Ollama calls, model downloads) follows that rule.

## 3. Branching & contribution workflow

We maintain a fork *and* contribute upstream, so keep generic fixes separable from Askantis-only work.

- `develop` — mirrors `upstream/develop`. Never put Askantis-only commits here directly.
- `askantis` — long-lived integration branch for our product (branding + the 4 features).
- `feat/<thing>` — short-lived branches off `askantis` for each feature.
- For **upstream PRs**: branch off `develop`, keep the change generic (no Askantis branding),
  open the PR from `Askantis/ferdium-app:<branch>` → `ferdium/ferdium-app:develop`.

Sync upstream periodically:
```bash
git fetch upstream
git checkout develop && git merge --ff-only upstream/develop && git push origin develop
git checkout askantis && git merge develop      # resolve, test, continue
```
(See [`05-rebrand-and-naming.md`](05-rebrand-and-naming.md) §"Keeping rebrand merge-friendly"
for how to minimize conflicts from branding changes.)

## 4. Suggested sequencing

1. **Rebrand scaffold first** (name, IDs, data dir) — small, but it changes the data dir, so do it
   before you invest in a migrated profile. [`05`](05-rebrand-and-naming.md)
2. **Export/import** (#3) — lowest risk, high utility, mostly reuses existing server code, and gives
   you a clean way to move test profiles around. [`03`](03-export-import.md)
3. **Design overhaul** (#1) — big but parallelizable; start with the theming/radius foundation, then
   Settings, then Favorites. [`01`](01-design-overhaul.md)
4. **Local AI** (#4) — self-contained feature panel; can proceed in parallel with the design work.
   [`04`](04-local-ai.md)
5. **Apple Messages** (#2) — most novel/risky (native DB access, permissions, sending). Do last or on
   its own track. [`02`](02-apple-messages.md)

## 5. Cross-cutting risks

- **Dual theming sync** — radius/accent/card changes must touch SCSS *and* the appearance injector.
- **Upstream merge cost** — branding edits across many files create conflicts; centralize them.
- **Security** — `contextIsolation:false` means model output / imported data must be sanitized;
  never `dangerouslySetInnerHTML` untrusted strings (the repo already ships `markdown-to-jsx`).
- **macOS permissions** — Apple Messages needs Full Disk Access; sending needs Automation/AppleScript.
- **Service persistence is server-mediated** — new per-service fields (e.g. `isFavorite`) must
  survive the local/cloud server round-trip.
