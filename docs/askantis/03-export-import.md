# Feature 3 — Account-free Export / Import

Goal: let a user dump **all services + workspaces + settings** into a single file, move it to another
computer, and import it — with **no Ferdium/cloud account**.

## 0. Headline finding: most of this already exists

When running accountless (local mode), Ferdium's **bundled internal server** already exposes
export/transfer endpoints that serialize services + workspaces to a `.ferdium-data` JSON file and
re-import them. So this feature is mostly: (a) **extend** the export to also include app settings,
and (b) replace the clunky browser-page UX with a **native in-app** Export/Import action.

Existing pieces:
- Routes (`src/internal-server/start/routes.js:104-116`, behind `RequireAuthenticatedBrowser`):
  - `GET /export` → `UserController.export`
  - `POST /transfer` → `UserController.importFerdium`
  - `GET /transfer` → `transfer.edge` view
- Export logic `src/internal-server/app/Controllers/Http/UserController.js:226-243` — dumps
  `Service.all()` + `Workspace.all()` to `{ username, mail, services, workspaces }`, returns
  attachment `export.ferdium-data`. **App settings are NOT included.**
- Import logic `UserController.js:245-291` (`importFerdium`) — parses the file, re-creates each
  service via `_createAndCacheService` (fresh UUIDs + old→new id map) and `_createWorkspace`
  (remaps service ids). **Directly reusable.**
- Current UX: Help menu `importExportData` (`src/lib/Menu.ts:207-210,647-652`) and a settings button
  (`EditSettingsForm.tsx:1270-1277`) both open the local-server page in the system browser via
  `importExportURL()` (`src/api/apiBase.ts:44-47`).

## 1. What makes up "everything" (the export bundle)

| Source | Carried by today's `/export`? | Notes |
|---|---|---|
| Services (+ per-service settings) | ✅ | `Service.all()` from `server.sqlite` |
| Workspaces | ✅ | `Workspace.all()` |
| App settings (`config/settings.json`) | ❌ add | `DEFAULT_APP_SETTINGS` shape |
| `proxy.json`, `shortcuts.json`, `custom.css`, `sandboxes.json` | ❌ add (optional) | decide on secrets |
| Installed recipes (`recipes/`) | ❌ | referenced by `recipeId`; re-installable. Bundle only for **custom/dev** recipes |
| Service login sessions (`Partitions/`) | ❌ by design | **not portable across machines** (`docs/MIGRATION.md:36`) — user re-logs in |

So the export = services + workspaces (existing) **+ a new `settings` block** (new). Sessions are
intentionally excluded; document that users re-login on the target machine.

## 2. Exact data layout on disk (for reference)

Path helpers in `src/environment-remote.ts:43-53` (`userDataPath`, `userDataRecipesPath`,
`userDataCertsPath`). Under the data dir:
- `config/settings.json|proxy.json|shortcuts.json|custom.css|sandboxes.json`
  (`src/electron/Settings.ts:62-67`, `src/features/appearance/index.ts:41`, `AppStore.ts:414,428`)
- `server.sqlite` — services + workspaces + local user (`src/internal-server/start.ts:48`;
  template at `src/internal-server/database/template.sqlite`)
- `recipes/`, `recipes/dev/`, `recipes/temp/`
- `Partitions/service-<id>/` — per-service sessions
- `Local Storage/` (Chromium LevelDB) — auth token, active service, UI state

Settings split (`src/stores/SettingsStore.ts`): `['app','proxy','shortcuts']` are JSON files
(via main-process `Settings`); `['service','stats','migration']` are in `mobx-localstorage`.

## 3. Recommended design — Option A: native action wrapping the (extended) server endpoints

Lowest effort, reuses the battle-tested UUID-remapping import. Keeps the `.ferdium-data` format so
old exports stay compatible.

### Export
1. **Extend `UserController.export`** (`UserController.js:226-243`) to also read the filesystem
   settings (`config/settings.json`, `proxy.json`, `shortcuts.json`, `custom.css`, `sandboxes.json` —
   it can resolve `USER_PATH` from `start.ts:53`) and embed them under a new `settings` key. Add a
   top-level `version` for forward-compat. (Decide whether to include proxy creds / `lockedPassword`
   — see risks.)
2. **Native trigger** instead of the browser page: new IPC channel (mirror
   `src/electron/ipc-api/localServer.ts`) that does the authenticated `GET /export` server-side
   (replicating the local token handshake from `apiBase.ts:38-47`), shows `dialog.showSaveDialog`,
   and writes the file. Wire from a new Settings button + Help-menu item.

### Import
1. **Native trigger**: `dialog.showOpenDialog` (accept `.ferdium-data,.ferdi-data,.json`) → read →
   `POST /transfer` (reuses `importFerdium`, `UserController.js:245-291`).
2. For the new `settings` block: write the JSON files back via the existing `updateAppSettings` IPC
   (`src/electron/ipc-api/settings.ts:11-13` → `Settings.set`), then relaunch.

### UI locations
- Settings: extend the Import/Export block in
  `src/components/settings/settings/EditSettingsForm.tsx:1262-1285` (+ i18n near `:238-240`) and
  `src/containers/settings/EditSettingsScreen.tsx:1463` — add native **Export configuration** /
  **Import configuration** buttons beside the existing browser-opening one.
- Menu: extend the Help submenu (`src/lib/Menu.ts:646-652`).
- Docs: update `docs/MIGRATION.md` for the native flow.

## 4. Alternative — Option B: pure renderer-side (no server round-trip)

Works in **both** local and cloud modes (the server endpoints only exist on the local server):
- **Export**: a store action serializes `stores.services.all`, `stores.workspaces.workspaces`,
  `stores.settings.all`; write via `fs-extra` (already used in renderer) + Save dialog.
- **Import**: parse, then per service call `actions.service.createService({recipeId, serviceData,
  skipCleanup:true})` (`ServicesStore.ts:453-510` — installs missing recipes automatically). Recreate
  workspaces via the workspaces store/api (`src/features/workspaces/{store,api}.ts`). Apply settings
  via `actions.settings.update` per type. Model on the legacy importer
  `src/stores/UserStore.ts:264-291` (`_importLegacyServices`).

**Recommendation:** Option A for services/workspaces (reuse `importFerdium` + UUID remap) **plus**
extend the export to include settings. If you need cloud-mode export too, layer in Option B's
renderer path as a fallback when not in local mode.

## 5. Risks / open questions

1. **Settings not currently exported** — must extend `/export` (or do renderer-side). Decide whether
   to include proxy creds / hashed `lockedPassword` (`SettingsStore.ts:217`) — privacy concern.
2. **Sessions are non-portable across machines** (`Partitions/`) — users re-login each service after
   import. Document clearly; not a bug. (On the *same* machine, copying `Partitions/` does preserve
   logins — see [`06-migrate-existing-data.md`](06-migrate-existing-data.md).)
3. **Local vs cloud asymmetry** — `/export` & `/transfer` only exist on the internal server and only
   when `settings.app.server === LOCAL_SERVER` with the server running. For cloud users, use Option B.
4. **Import appends, doesn't replace** (`docs/MIGRATION.md:37`) — re-import creates duplicates (new
   UUIDs each time). Offer a "replace / merge / append" choice.
5. **Recipes referenced by id, not bundled** — built-in recipes are re-installable; **custom/dev
   recipes** (`recipes/dev/`) must be bundled into the export to transfer fully offline.
6. **Crude full-migration alternative** — copying `server.sqlite` + `config/` + `recipes/` moves a
   whole local profile in one shot (brittle across schema versions, still no sessions). Useful as a
   power-user/CLI escape hatch.
7. **Token handshake** — native HTTP calls to the internal server must replicate the
   `ferdium-local-token` cookie/token (`routes.js:50-55,118-128`, `apiBase.ts:38-47`).
8. **`.ferdi-data` legacy compatibility** is already handled — preserve it.

### Files to touch (summary)
- `src/internal-server/app/Controllers/Http/UserController.js` (extend export/import payload)
- `src/components/settings/settings/EditSettingsForm.tsx:1262-1285`,
  `src/containers/settings/EditSettingsScreen.tsx:1463` (UI)
- `src/lib/Menu.ts:646-652` (menu)
- new `src/electron/ipc-api/exportImport.ts` (native dialog + authed HTTP), wired in
  `src/electron/ipc-api/index.ts` + `src/index.ts`
- `src/stores/ServicesStore.ts` / `src/features/workspaces/store.ts` (if doing Option B)
- `docs/MIGRATION.md` (update)
