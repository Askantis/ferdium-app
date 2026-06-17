# Feature 2 — Local Apple Messages (iMessage) integration

Goal: add iMessage as a **native service** (no webview / no website). With the user's permission,
read the local Messages database on macOS, show conversations + recent messages in an in-app React
panel, surface unread counts/notifications, and (stretch) send messages. Beeper-style, but local.

> This is the most novel and highest-risk feature: it requires native macOS data access, OS
> permissions, and a non-webview content path. Plan it on its own track.

## 0. How macOS Messages stores data

- Database: `~/Library/Messages/chat.db` — a **SQLite** file. Key tables: `message`, `handle`
  (contacts/addresses), `chat`, `chat_message_join`, `chat_handle_join`, `attachment`. Message text
  is in `message.text` (and, on newer macOS, encoded in `message.attributedBody` as a serialized
  `NSAttributedString` — you must decode that blob when `text` is null). Timestamps are Apple epoch
  nanoseconds (since 2001-01-01); convert accordingly.
- **Full Disk Access (FDA)** is required for any process to read `chat.db`. The user must grant it in
  System Settings → Privacy & Security → Full Disk Access for the app (in dev, that's the Electron
  binary / your terminal). The app must **detect** the lack of access and guide the user.
- Reading is local-only and safe-ish. **Sending** an iMessage is a separate, harder problem
  (AppleScript/Shortcuts automation + Automation permission) — treat as a stretch goal.

## 1. Why a non-webview service is the right model

Today every service renders a `<webview>`. The render branch point is **narrow and isolated**:
`src/components/services/content/ServiceView.tsx:182-193` chooses `<ServiceWebview>` when the service
is enabled and not hibernating — with **no check for a "local/native" recipe**. That single spot is
where we branch to a custom React component.

There's already precedent for a "special, non-standard service": the **todos** feature is filtered
out of the normal services map (`src/components/services/content/Services.tsx:138`) and mounted
separately with its own store/preload. Apple Messages follows the same "special service" idea but
renders **native React** instead of a webview.

## 2. Architecture

```
┌────────────────────────── renderer ──────────────────────────┐
│ AppleMessagesView (React)  ──IPC──▶  main: ipc-api/appleMessages │
│  - conversation list                                 │ reads chat.db (better-sqlite3)
│  - message thread                ◀──IPC── push      │ decodes attributedBody
│  - compose box (stretch: send)                       │ watches file for changes
│  writes service.unreadDirectMessageCount directly    │ AppleScript send (stretch)
└──────────────────────────────────────────────────────────────┘
```

All `chat.db` access lives in the **main process** (consistent with the app's IPC convention and
required because we'll use a native SQLite addon). The renderer panel only talks IPC.

## 3. Implementation plan

### 3a. Recipe + service record
- Ship an `applemessages` recipe (`recipes/recipes/applemessages/`) with `package.json`:
  ```json
  { "id":"applemessages", "name":"Apple Messages",
    "config": { "serviceURL": "about:blank", "local": true } }
  ```
  `index.js`/`webview.js` can be no-ops (the React panel replaces rendering).
- **Flag semantics caution:** `recipe.local` already means "dev recipe loaded from
  `userData/recipes/dev`" (`src/api/server/ServerApi.ts:612`, read by
  `src/stores/RecipePreviewsStore.ts:55`). **Do not reuse it.** Add a distinct flag, e.g.
  `config.kind: 'native'` (extend `RecipeData`/`Recipe` at `src/models/Recipe.ts:7-30,185`).
- Create the service through the normal `_createService` flow (`src/stores/ServicesStore.ts:453-510`)
  so it gets a record in the local/cloud server like any other service.

### 3b. Render branch
In `src/components/services/content/ServiceView.tsx:182-193`:
```tsx
{service.recipe.kind === 'native' && service.recipe.id === 'applemessages'
  ? <AppleMessagesView service={service} />
  : <ServiceWebview ... />}
```
New components under `src/features/appleMessages/components/` (chat list, thread, composer),
styled with `react-jss` like the rest.

### 3c. Guard webview-only lifecycle
The `Service` model and `ServicesStore` assume a `_webview` in several places. For a native service,
guard or stub these (return early when `recipe.kind === 'native'`):
- polling `ServicesStore._initRecipePolling` (`:1440-1459`)
- focus `ServicesStore._focusActiveService` (`:764-792`)
- reload `ServicesStore._reload` (`:1030-1044`)
- `Service.initializeWebViewEvents` (`src/models/Service.ts:416`)

### 3d. Main-process data layer (new)
- New IPC module `src/electron/ipc-api/appleMessages.ts`, registered in
  `src/electron/ipc-api/index.ts:20-29` (it receives `{ mainWindow, settings, trayIcon }`).
- Channels:
  - `applemessages:check-access` → returns whether `chat.db` is readable (FDA granted).
  - `applemessages:list-chats` → recent conversations (id, display name, participants, last msg,
    unread).
  - `applemessages:get-thread` → messages for a chat (paginated).
  - `applemessages:watch` (push) → on `chat.db` change, `mainWindow.webContents.send(
    'applemessages:update', …)`. Model the push pattern on `ipc-api/localServer.ts:51`.
  - `applemessages:send` (stretch) → AppleScript/Shortcuts.
- SQLite addon: add **`better-sqlite3`** (sync, fast, simple) as a `pnpm.onlyBuiltDependencies`
  entry (`package.json:227-237`) since it's a native module that needs rebuilding for Electron.
  Open `chat.db` **read-only, immutable** (`new Database(path,{readonly:true,fileMustExist:true})`)
  and ideally against a copied snapshot to avoid WAL lock contention with Messages.app.
- Put query logic in a helper `src/helpers/apple-messages-helpers.ts` (mirrors
  `src/helpers/translation-helpers.ts`), so the IPC module stays thin.
- Watch for new messages with `fs.watch` on `chat.db`/`chat.db-wal` (debounced) — or poll every few
  seconds.

### 3e. Unread + notifications (reuse existing plumbing)
A native service can set `service.unreadDirectMessageCount` / `unreadIndirectMessageCount` directly
(same fields the webview path writes via `_setUnreadMessageCount`, `ServicesStore.ts:717-722`). The
tray/OS-badge aggregation reaction (`_getUnreadMessageCountReaction`, `:1304-1345`) is
webview-agnostic, so the tray badge "just works." Fire desktop notifications via `actions.app.notify`
(same path the `'notification'` IPC case uses, `:852-941`).

### 3f. Permissions UX
- On first open, call `applemessages:check-access`. If not granted, render an explainer card with a
  button that opens the FDA pane:
  `x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles`.
- The app already has a macOS-permissions helper (`src/electron/macOSPermissions.ts`) and stores a
  screen-capture-permission flag in userData — follow that style for a one-time FDA check flag.

### 3g. Sending (stretch)
- Reading ≠ sending. To send: AppleScript (`osascript`) `tell application "Messages" to send …` or a
  user-installed Shortcut. Requires the **Automation** permission (separate prompt) and is fragile
  across macOS versions. Gate behind a clearly-labeled experimental setting. This also unlocks the
  Favorites "send via iMessage" route (see [`01-design-overhaul.md`](01-design-overhaul.md) §5).

## 4. Shared "send into a service" mechanism (used by Favorites too)

For webview-backed services, two mechanisms exist already (no ready-made `send(contact,text)`):
- `service.webview.executeJavaScript("…")` — drive page DOM (selectors per service).
- Host→guest IPC + recipe handler — mirror `toggle-to-talk`
  (`src/webview/recipe.ts:157-164`, `src/webview/lib/RecipeWebview.ts:204-206`,
  `ServicesStore._sendIPCMessage` `:990-999`), plus deep-link via `service.webview.loadURL(url)`.

For Apple Messages (native), "send" is the `applemessages:send` IPC → AppleScript path above.

## 5. Risks / open questions

1. **Full Disk Access** is mandatory and per-binary; in dev the granted binary is the Electron dev
   build, in prod it's the packaged app — users must re-grant after rename/repackage. Detect + guide.
2. **`attributedBody` decoding** — newer macOS stores text in a serialized `NSAttributedString` blob,
   not `message.text`. Need a typedstream/NSKeyedUnarchiver-style decoder (there are JS ports;
   budget for it).
3. **WAL/locking** — Messages.app keeps `chat.db` open with WAL; open read-only/immutable or snapshot
   to a temp copy before querying.
4. **`better-sqlite3` native build** must target the Electron ABI (electron-rebuild / the
   `onlyBuiltDependencies` mechanism); verify packaging in `electron-builder.yml` and asar unpacking
   (`src/helpers/asar-helpers.ts`).
5. **Service model is webview-centric** — every guard you miss (focus/poll/reload) can throw; audit
   call sites.
6. **Service persistence is server-mediated** — confirm the local/internal server accepts a service
   whose recipe never loads a URL (`recipe.path` + `require(webview.js)` still expected to exist;
   ship a no-op `webview.js`).
7. **Sending iMessages** is a genuinely separate permission + reliability surface; keep it
   experimental and optional.
8. **Privacy** — make it explicit/opt-in; never upload message content anywhere (especially relevant
   once the Local AI feature exists — keep iMessage data local unless the user explicitly invokes AI
   on it).
