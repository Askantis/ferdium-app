# Migrating your existing Ferdium data into the local build

You installed Ferdium via Homebrew and set up 9 services. The locally-built app uses a
**different data directory**, so out of the box it starts empty. This doc explains exactly why and
gives you a safe copy procedure (including your logged-in sessions).

## ⚙️ Current setup: shared profile via symlink (temporary dev override)

Right now Sophie's dev data dir is **symlinked to the brew Ferdium profile**, so both apps share one
set of services + logins. Only one app may be open at a time (Electron holds an exclusive
`SingletonLock` on the dir):

```
~/Library/Application Support/SophieDev  ->  ~/Library/Application Support/Ferdium
~/Library/Application Support/Sophie      ->  ~/Library/Application Support/Ferdium   (for a future packaged build)
```

A standalone backup of the earlier copy is kept at `SophieDev.standalone.bak` (safe to delete).

**To revert to independent dirs:** `rm "~/Library/Application Support/SophieDev"` (removes only the
symlink), then either restore the backup (`mv SophieDev.standalone.bak SophieDev`) or let Sophie
create a fresh dir on next launch.

### 📌 TODO (before release): Sophie should own its own data dir

The symlink is a convenience for development only. The shipped product should use its **own** data
dir (`Sophie` / `SophieDev`) and offer a proper one-time migration instead of piggybacking on
Ferdium's:

- On first launch, if `Sophie` doesn't exist but `Ferdium` does, prompt *"Import your Ferdium
  setup?"* and **copy** (not symlink) — mirroring Ferdium's own Ferdi→Ferdium migration
  (`src/stores/UserStore.ts:264-291`, `docs/MIGRATION.md`).
- Optionally add a `SOPHIE_APPDATA_DIR` override (cf. `FERDIUM_APPDATA_DIR`,
  `src/environment-remote.ts:21-23`) for power users.
- Once that lands, remove the symlink and the `Sophie`/`SophieDev` links.

## Why they don't already share data

Data directory is resolved in `src/environment-remote.ts:20-41`. The relevant bit:

```ts
export const isDevMode = !app.isPackaged;            // true when you run `pnpm start`
if (isDevMode) {
  app.setPath('userData', join(app.getPath('appData'), `${app.name}Dev`));  // <- "FerdiumDev"
}
```

`app.name` resolves to the `productName` `"Ferdium"` (from `package.json`). So:

| App | `isPackaged` | Data dir (macOS) |
|---|---|---|
| Brew-installed Ferdium | yes | `~/Library/Application Support/Ferdium` |
| Your `pnpm start` build | no (dev) | `~/Library/Application Support/FerdiumDev` |

That separation is a feature — it means hacking on the app can't corrupt your real profile.

## What's actually in the profile

(From the persistence research — see [`03-export-import.md`](03-export-import.md) for the full table.)

| Path under the data dir | What it holds |
|---|---|
| `config/settings.json` | All app settings (incl. `server` = cloud vs local mode) |
| `config/proxy.json`, `shortcuts.json`, `custom.css`, `sandboxes.json` | Other settings |
| `server.sqlite` | **Your services + workspaces** (only used in accountless/local mode) |
| `recipes/` | Installed recipe packages |
| `Partitions/service-<id>/` | **Each service's logged-in session** (cookies/localStorage) |
| `Local Storage/` | auth token, active service, UI state |

> Key insight: because both apps run on the **same Mac**, copying `Partitions/` **carries your
> logins over** — unlike cross-machine transfer (`docs/MIGRATION.md`), where sessions are not portable.

## First: which mode is your installed app in?

This determines the launch command, because services live in different places:

- **Accountless / local server** → services are in `server.sqlite` (copying the folder moves them).
- **Cloud / Ferdium account** (or a custom server) → services live on the server; the local copy is
  mostly sessions + settings, and you re-sync by logging in.

Check it:
```bash
/usr/bin/plutil -extract server raw -o - \
  ~/Library/Application\ Support/Ferdium/config/settings.json 2>/dev/null \
  || python3 -c "import json;print(json.load(open('$HOME/Library/Application Support/Ferdium/config/settings.json')).get('server'))"
```
- Output `You are using Ferdium without a server` → **local mode**.
- A URL like `https://api.ferdium.org` → **cloud/account mode**.

## Migration procedure (recommended: full copy)

This copies everything including logins. Do it with **both apps closed**.

```bash
SRC="$HOME/Library/Application Support/Ferdium"
DST="$HOME/Library/Application Support/FerdiumDev"

# 1. Quit the installed Ferdium app completely (Cmd-Q), and stop any `pnpm start`.

# 2. Back up the dev profile if one exists.
[ -d "$DST" ] && mv "$DST" "$DST.bak.$(date +%s)"

# 3. Copy, excluding lock/singleton files that must not be cloned.
mkdir -p "$DST"
rsync -a \
  --exclude 'Singleton*' \
  --exclude 'lockfile' \
  --exclude '*.lock' \
  "$SRC"/ "$DST"/

echo "Copied $(du -sh "$DST" | cut -f1) into $DST"
```

Then launch:

```bash
# Local-mode users:
pnpm start

# Cloud/account users — point the dev build at the LIVE API so sync works:
pnpm start:live
```

> Why `start:live` for cloud users: in dev mode, without a flag, the app defaults to Ferdium's
> **dev/staging** API (`DEV_FRANZ_API`, `environment-remote.ts:70`), not the live one. `start:live`
> sets `USE_LIVE_API=1`. (Local-mode users don't care — their `settings.json` already pins
> `server = LOCAL_SERVER`, and `apiBase()` routes to the bundled internal server regardless.)

## Alternative: don't copy, just point at the real dir (read/writes your real profile!)

The `FERDIUM_APPDATA_DIR` env var (`environment-remote.ts:21-23`) overrides the base. **But note**
the dev-mode line still appends `Dev`, so this lands at `<DIR>/FerdiumDev`, not `<DIR>` — to truly
reuse the installed profile you'd have to also force `ELECTRON_IS_DEV=0`, which changes other dev
behavior. **Not recommended** — the copy approach above is cleaner and keeps your real profile safe.

## ⚠️ After the rebrand, the path changes again

Once we rename the app (see [`05-rebrand-and-naming.md`](05-rebrand-and-naming.md)), `app.name`
changes, so the data dir becomes `~/Library/Application Support/<NewName>` (prod) and
`<NewName>Dev` (dev). At that point:

- Re-run the copy above with the new `DST`, **or**
- Better: build the in-app **import** feature (#3) first and use an export file to move the profile —
  it's name-independent and is the intended long-term migration path.

We can also add a tiny **one-time auto-migration** on first launch of the renamed app: if
`<NewName>` doesn't exist but `Ferdium` does, offer to copy it over. (Ferdium itself shipped exactly
this kind of Ferdi→Ferdium migration; see `docs/MIGRATION.md` and the legacy import in
`src/stores/UserStore.ts:264-291` as prior art.)
