# Feature 4 — Local AI Assistant

Goal: an in-app AI assistant (smart replies, short/long summaries, message classification,
structured responses, multi-step "agent" chat, complex analysis — the Franz feature set in your
screenshot), powered by:
- a **locally-downloaded model** the app can fetch/run (e.g. Qwen),
- a **local or remote Ollama** server over HTTP (incl. another machine on the LAN),
- **MCP** servers / local llama.

This is a self-contained feature panel and can be built in parallel with the design work.

## 0. Greenfield — no AI code exists yet

Grep for `ollama|llama|assistant|llm|openai|anthropic|gpt|mcp` across `src/` returns nothing. We're
adding this fresh, following two existing patterns: the **todos feature** (for the panel) and the
**translate IPC handler** (for calling an external endpoint from main).

## 1. Feature panel — clone the todos template

Create `src/features/aiAssistant/`, mirroring `src/features/todos/`:

| New file | Mirrors | Purpose |
|---|---|---|
| `index.ts` | `todos/index.ts:1-9` | `export const aiAssistantStore = new AiAssistantStore();` + `export default function initAiAssistant(stores, actions){ stores.aiAssistant = aiAssistantStore; aiAssistantStore.start(stores, actions); }` |
| `store.ts` | `todos/store.ts` | `extends FeatureStore` (`src/features/utils/FeatureStore.ts`), `makeObservable`; observables for chat messages, streaming buffer, provider status; `@computed get settings(){ localStorage.getItem('aiAssistant') }` for panel-local state; methods that call IPC (§3) |
| `actions.ts` | `todos/actions.ts` | `togglePanel`, `sendPrompt`, `stopGeneration`, `resize`, `runActionOnService` |
| `constants.ts` | `todos/constants.ts` | IPC channel names, default panel width |
| `containers/AiAssistantScreen.tsx` | `todos/containers/TodosScreen.tsx` | `@inject('stores','actions') @observer`; render `null` when disabled |
| `components/AiAssistantPanel.tsx` | `todos/components/TodosWebview.tsx` | **native React chat UI** (not a `<Webview>`), `react-jss` styled right-side sliding panel with a resize handle |

**Registration (the wiring you must touch):**
1. `src/stores/FeaturesStore.ts` — add the import (with the others at `:11-18`) and call
   `aiAssistant(this.stores, this.actions);` inside `_setupFeatures()` (after `:90`).
2. `src/components/layout/AppLayout.tsx` — import the screen (near `:23`) and render
   `<AiAssistant />` next to `<Todos />` at `:240`. (For a modal instead, render it inside
   `app__service` like `<QuickSwitch/>` at `:234-236`.)
3. `src/@types/stores.types.ts` — add `aiAssistant` to the stores type so `@inject('stores')`
   typechecks (it already lists feature stores like `todos`).

Panel/session state → `mobx-localstorage` key `'aiAssistant'`. **Provider config** (mode, Ollama URL,
model name, keys) → **app settings** (§4) so it persists to disk and is editable in Settings.

## 2. Rendering AI output safely
The renderer runs `contextIsolation:false`/`nodeIntegration:true` (`src/index.ts:243-244`), so model
output is dangerous if injected raw. Render markdown via the already-bundled `markdown-to-jsx`
(`package.json:96`); **never** `dangerouslySetInnerHTML` raw model text.

## 3. Main-process IPC + provider plumbing

All network/process/model I/O goes through main (per the app's convention and the security posture).
Create `src/electron/ipc-api/aiAssistant.ts`, register it in `src/electron/ipc-api/index.ts:20-29`
(it receives `{ mainWindow, settings, trayIcon }`). Put provider logic in
`src/helpers/ai-helpers.ts` (mirrors `src/helpers/translation-helpers.ts`).

### 3a. Ollama / HTTP chat (the easy, primary path)
Copy the LibreTranslate fetch pattern (`src/helpers/translation-helpers.ts:24-44`) but hit Ollama:
```ts
// ipcMain.handle('ai:chat', async (_e, { baseUrl, model, messages, options }) => …)
const res = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, messages, stream: false, options }),
});
return (await res.json()).message;        // { role, content }
```
- Renderer calls `await ipcRenderer.invoke('ai:chat', …)` (pattern: `contextMenuBuilder.ts:647`).
- **Streaming**: `invoke` is request/response only. For token streaming use
  `ipcMain.on('ai:chat-stream', …)` reading Ollama's NDJSON stream and pushing each token with
  `event.sender.send('ai:chat-token', { id, token })`; renderer subscribes
  `ipcRenderer.on('ai:chat-token', …)`. Model the push on `ipc-api/localServer.ts:51`. Add a
  per-request `id` (multiplex concurrent generations) and an `ai:stop` cancel channel.
- **Remote/LAN Ollama**: `baseUrl` can be `http://192.168.x.x:11434` — plain Node fetch from main,
  no Electron sandbox constraints. Validate the URL first (`isValidExternalURL`,
  `src/helpers/url-helpers.ts`).

### 3b. Local model download (Qwen) — "download within the app"
- `ipcMain.on('ai:download-model', …)`. Reuse `electron-dl`'s `download()` and dialogs as in
  `src/electron/ipc-api/download.ts:27,45,56`, but write to a dedicated
  `userDataPath('ai-models', …)` (NOT the user's Downloads — and bypass the global `will-download`
  redirect at `src/index.ts:340-348`). `tar` + `fs-extra` are available for unpacking.
- Emit progress events to the renderer. **Add checksum verification** (none exists in the repo).
- Two realistic shapes:
  1. **Pull via Ollama** — if Ollama is installed, the simplest "download Qwen" is
     `POST {baseUrl}/api/pull {name:'qwen2.5'}` (streamed progress). No weights to manage ourselves.
  2. **Bundle/manage a runtime ourselves** — download a GGUF + run a llama.cpp/`node-llama-cpp`
     binding in main. Heavier (binaries per-platform, large weights, packaging) — see §3c/risks.

### 3c. Spawn / manage a local model process
- **No `child_process.spawn` precedent exists** (`src/api/server/LocalApi.ts:1` only imports a type).
  Build lifecycle management from scratch, modeled on `ipc-api/localServer.ts`: singleton "started"
  guard, free-port discovery (`node:net`), teardown on `app` `will-quit`. Channels `ai:spawn` /
  `ai:stop`. A process-manager UI hook already exists
  (`@syed_umair/electron-process-manager`, `ipc-api/processManager.ts`).
- Simplest first version: **don't spawn anything ourselves** — require/allow Ollama and just talk
  HTTP. Add self-managed local runtime later behind a setting.

### 3d. MCP
- MCP servers are typically stdio or SSE/HTTP child processes. Same child_process gap as §3c, plus an
  MCP client (no `@modelcontextprotocol/sdk` in deps yet — add it). Run the MCP client in **main**,
  expose tool-calls to the renderer via IPC relays. Lets the assistant call tools / act as an agent
  ("Agent chat (multi-step reasoning)" in your screenshot).

## 4. Settings integration

Add keys to `DEFAULT_APP_SETTINGS` in `src/config.ts` (the big object, "Ferdium specific options"
start ~`:570`):
```ts
isAiAssistantEnabled: false,
aiProvider: 'ollama',                 // 'ollama' | 'localModel' | 'mcp'
aiOllamaUrl: 'http://localhost:11434',
aiModelName: 'qwen2.5',
aiApiKey: '',                          // only if a cloud provider is ever added
```
Persistence is automatic: `app` settings are JSON on disk via `src/electron/Settings.ts`; renderer
writes through `actions.settings.update({type:'app',data})` → `updateAppSettings` IPC
(`src/electron/ipc-api/settings.ts:11-13`). Read as `stores.settings.all.app.<key>`.

Wire the form in `src/containers/settings/EditSettingsScreen.tsx` exactly like `translatorEngine`
and the todo-server fields:
1. i18n messages in `defineMessages` (cf. `translatorEngine` `:127-130`, `enableTodos` `:335-338`).
2. Field config in `prepareForm()`'s `config.fields` (cf. `translatorEngine` `:842-850`,
   `predefinedTodoServer` `:914-922`, checkbox `enableTodos` `:1399-1407`).
3. Persist in `onSubmit`/`newSettings` (cf. `:440,448-449`).
4. Feature-toggle side effect: compare old vs new `isAiAssistantEnabled` and call
   `aiAssistantActions.togglePanel()` (mirrors the todos toggle at `:580-582`).
5. Controls (`<Select>`/`<Toggle>`/`<Input>`) in
   `src/components/settings/settings/EditSettingsForm.tsx` (cf. `<Select field={form.$(
   'translatorEngine')} />` `:1087`).

## 5. "Features with this model" (the screenshot) → how each maps

- **Smart replies / summaries / classification / structured responses** → prompt templates over
  `ai:chat`; expose quick-actions in the panel and (optionally) a context-menu item on a selected
  message (the context-menu builder already does `ipcRenderer.invoke('translate', …)` at
  `contextMenuBuilder.ts:647` — add an `AI: summarize / reply` item the same way).
- **Email/chat summaries on a service** → grab visible text from the active service via
  `service.webview.executeJavaScript(...)` (see [`02-apple-messages.md`](02-apple-messages.md) §4),
  feed to the model. (Privacy: keep local; only send to remote endpoints the user configured.)
- **Agent chat (multi-step) + complex analysis** → MCP tools (§3d) + multi-turn loop in the store.

## 6. Risks / open questions

1. **Streaming over IPC** is a new convention here (no example beyond a single push). Build
   request-id multiplexing + cancellation + backpressure.
2. **No child_process precedent** — local spawn/MCP lifecycle is from scratch; ship Ollama-HTTP first.
3. **Bundling/large weights** — model files are big; download-on-first-run to `userDataPath`, verify
   checksums, mind `electron-builder.yml`/asar packaging.
4. **Secrets** — `settings.json` is plaintext (`Settings.ts:56`). Prefer local providers (no secret);
   if cloud keys are added later, use an OS keychain.
5. **Security** — sanitize/markdown-render output; never raw-inject into the Node-enabled renderer.
6. **Privacy** — be explicit about what leaves the device. Local model / local Ollama = nothing
   leaves; remote Ollama/LAN = leaves to that host; cloud = leaves to provider. Surface this in UI.
7. `@electron/remote` is leaned on app-wide; keep the AI feature on **IPC** (future-proof), not
   `remote`.

### Files to touch (summary)
- new `src/features/aiAssistant/*` (clone `src/features/todos/*`)
- `src/stores/FeaturesStore.ts` (register), `src/components/layout/AppLayout.tsx` (mount),
  `src/@types/stores.types.ts` (type)
- new `src/electron/ipc-api/aiAssistant.ts` + register in `src/electron/ipc-api/index.ts`;
  new `src/helpers/ai-helpers.ts`
- `src/config.ts` (settings + constants), `src/containers/settings/EditSettingsScreen.tsx` +
  `src/components/settings/settings/EditSettingsForm.tsx` (UI)
- optionally `src/webview/contextMenuBuilder.ts` (AI context-menu actions)
