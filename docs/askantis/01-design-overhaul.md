# Feature 1 — Design Overhaul

Goal: move from Ferdium's flat, square-cornered look to a modern **card-on-background** style
(à la Franz), with a redesigned Settings surface, **gradient accents derived from service-icon
colors**, a **hover-nav scroll-to-switch** interaction, and a new **Favorites** page that lets you
pin contacts and send a message that auto-routes through the right service.

> Read the "two theming systems" note in [`00-OVERVIEW.md`](00-OVERVIEW.md) §2 first. It is the
> single most important constraint here.

## 0. The theming model (so changes land everywhere)

There are **three** places color/shape are defined and they must stay in sync:

1. **react-jss runtime theme** — `src/themes/default/index.ts` (light, brand `#7266F0` at `:11`),
   `src/themes/dark/index.ts`, `src/themes/legacy/index.ts` (`themeBorderRadius = '6px'` at `:12`).
   Consumed via `ThemeProvider theme={ui.theme}` (`src/containers/layout/AppLayoutContainer.tsx:176`);
   the active theme is computed in `src/stores/UIStore.ts:91-98`.
2. **Static SCSS** compiled at build by `esbuild.mjs` — raw values in `src/styles/globals.scss`
   (`$raw-theme-border-radius: 6px` `:11`, brand RGB `'114,102,240'` `:1`), derived in
   `src/styles/colors.scss` (`$theme-border-radius` `:16`, and an **already-existing but unused**
   `$theme-brand-gradient` alias `:4`). Component/layout styling in `tabs.scss`, `layout.scss`,
   `services.scss`, `settings.scss`, `vertical.scss`.
3. **Runtime accent injector** — `src/features/appearance/index.ts`. On any relevant settings
   change it rewrites `<style id="custom-appearance-style">` (`:606-626`). `generateAccentStyle()`
   (`:45-137`) emits the accent rules and **hardcodes `.tab-item.is-active`** (`:132-135`:
   `background: accent.lightness(90)` + `box-shadow: inset 4px 0 0 0 accent`). It also computes
   service-ribbon widths/icon sizes with magic numbers (`generateServiceRibbonWidthStyle` `:139-318`).

**Rule of thumb:** structural shape (radius, spacing, backgrounds) → SCSS. Dynamic per-user / per-
service color → the appearance injector and/or the JSS theme object. Touch the matching layer in
all three or you get partial styling (especially for non-default accent colors).

### Recommended foundational refactor (do this first)
- Introduce CSS custom properties as the single source of truth: define `--ak-radius`,
  `--ak-radius-card`, `--ak-surface`, `--ak-surface-2`, `--ak-accent`, `--ak-accent-gradient`, etc.
  on `:root` (and `.theme__dark`). Set them once from the SCSS defaults, and let the appearance
  injector and JSS theme **override the same variables** instead of re-emitting whole rule blocks.
  This collapses the 3-way sync into "write a CSS var in one place." The codebase already uses CSS
  vars (e.g. `--workspace-drawer-width` in `layout.scss`), so this is idiomatic.
- Reconcile the two brand constants (`DEFAULT_ACCENT_COLOR='#7367F0'` in `src/config.ts:8` vs theme
  `'#7266F0'`) — pick one Askantis brand color as the source of truth (ties into the rebrand).

---

## 1. Rounded "card-on-background" style

### Current state
- Service tabs are full-width, square: `src/styles/tabs.scss:26-84`; active state is an inset
  box-shadow stripe (`:39-51`).
- App background `.app { background:#fff }` (`src/styles/layout.scss:103-104`); sidebar bg is
  `$theme-gray-lightest` with an inset shadow `::after` (`:160-185`); service content bg in
  `src/styles/services.scss:44-54` (light) / `:3-22` (dark).

### Plan
1. **Radius token** — bump `$raw-theme-border-radius` (`globals.scss:11`) and the JSS
   `borderRadius` (`legacy/index.ts:12`). Add a larger `--ak-radius-card` (e.g. 12–16px) for cards.
2. **Tabs as cards** — in `tabs.scss:26-84` give `.tab-item` `margin: 4px 8px`, `border-radius:
   var(--ak-radius-card)`, a subtle resting surface, and a filled/elevated active state (replace the
   inset stripe). **Mirror in the injector** (`appearance/index.ts:132-135`) — rewrite that block to
   the card style (or, with the CSS-var refactor, just set `--ak-accent` and let one static rule do
   the rest).
3. **Background layering** — give `.app__service`/services area a recessed surface
   (`--ak-surface-2`) and let each service render on a rounded white/dark card with a small gutter,
   so the "card on background" reads through. Files: `layout.scss:103-185`, `services.scss`.
4. **Sidebar** — soften: remove the hard inset shadow (`layout.scss:172-185`), add the surface
   color + optional rounded outer corner.

### Risk
The injector's ribbon-width math (`appearance/index.ts:139-318`) assumes specific paddings/heights;
adding card margins can shift its layout. Test at several "service ribbon width" settings and in
horizontal mode (`useHorizontalStyle`).

---

## 2. Gradient accents from service-icon colors

### Current state
- `service.icon` resolves to a recipe SVG/PNG/favicon (`src/models/Service.ts:361-390`). Icons live
  at `recipes/recipes/<id>/icon.svg`.
- **No color-extraction code or library exists.** `$theme-brand-gradient` (`colors.scss:4`) is an
  unused alias.

### Plan
1. **Extract a dominant color per service.** Add a dependency (`node-vibrant` or a small canvas
   sampler). Since most icons are SVG, rasterize to an offscreen `<canvas>` in the renderer, sample,
   and cache. Cache the result on the `Service` model next to `icon` (`Service.ts:361`) as a
   `@computed`/observable `accentColor`, or in a small `Map<recipeId,color>` in `UIStore`.
2. **Feed it into CSS.** Write `--ak-accent` / `--ak-accent-gradient` (e.g.
   `linear-gradient(135deg, color, color.darken(12%))`) — globally for the **active** service
   (drive from `ServicesStore.active`, recompute in the appearance reaction or `UIStore.theme`),
   and/or per-tab by adding a `data-service-id` attribute to the tab `<li>`
   (`src/components/services/tabs/TabItem.tsx:373-396`, currently classnames only) and emitting
   `.tab-item[data-service-id="X"].is-active { background: linear-gradient(...) }`.
3. Color math: libs already present — `color` (Qix, used by themes + injector) and `tinycolor2`
   (used in `AppLayoutContainer.tsx`). No new color lib needed if you sample pixels yourself.

### Where
`src/features/appearance/index.ts:45-137` (new generator), `TabItem.tsx:373-396` (data attr),
`Service.ts:361` (cache), `UIStore.ts:91-98` (active-service gradient).

### Risk
Performance with many services (sample once, cache, recompute only on icon change). SVG rasterization
edge cases. Contrast/readability — clamp lightness so text stays legible.

---

## 3. Modern Settings redesign

### Current state
- Route `/settings` → `SettingsWindow` (portal into `#portalContainer`) → `SettingsLayout`
  (modal shell `.settings.franz-form`, `src/components/settings/SettingsLayout.tsx:52-77`).
- Left nav: `src/components/settings/navigation/SettingsNavigation.tsx:94-202` (`NavLink`s).
- The big app-settings form `src/components/settings/settings/EditSettingsForm.tsx` (1427 lines)
  uses an **in-form badge-row** of tabs (`general / services / appearance / privacy / language /
  advanced`, `:551-616+`) switched via `this.state.activeSetttingsTab`.
- Styles: `src/styles/settings.scss` (modal radius `:169`, dark overrides `:25-144`).
- Reusable themed primitives: `src/components/ui/{button,input,toggle,select,Slider,headline,
  colorPickerInput}`.

### Plan
1. Replace the badge-row tabs (`EditSettingsForm.tsx:551-616`) with a proper **segmented control or
   left sub-nav**; keep the `activeSetttingsTab` state machine — only the presentation changes.
2. Restyle the modal in `settings.scss`: card radius, generous padding, modern type scale, section
   cards with the `--ak-surface` treatment, sticky header (`.settings__header`, `EditSettingsForm
   .tsx:540-543`).
3. Modernize `SettingsNavigation` (icons + active pill) and `SettingsLayout` (wider, rounded,
   subtle backdrop blur).
4. Reuse/upgrade the `src/components/ui/*` primitives so toggles/inputs/selects get the new look
   everywhere at once.

### Risk
`EditSettingsForm` is huge and class-based with `mobx-react-form`; restyle incrementally
(structure/CSS first, avoid rewiring form fields). Settings styling is global SCSS, so changes are
app-wide — verify all settings sub-screens (services, workspaces, account, recipes).

---

## 4. Hover-nav + scroll-wheel to switch services

### Current state
- The actions **already exist**: `ServicesStore._setActiveNext/_setActivePrev`
  (`src/stores/ServicesStore.ts:697-714`) with declared actions `setActiveNext/setActivePrev`
  (`src/actions/service.ts:11-12`). Currently only bound to menu items (`src/lib/Menu.ts`).
- Sidebar already has `actions` injected (`src/components/layout/Sidebar.tsx`).
- The sidebar inner container has `overflow: scroll` (`layout.scss:218`, `vertical.scss:27`).

### Plan
Add an `onWheel` handler to the tab list (`src/components/services/tabs/TabBarSortableList.tsx:50`)
or the sidebar root (`Sidebar.tsx:194`):
```tsx
onWheel={throttle((e) => {
  // only when hovering the nav; avoid fighting native scroll when content overflows
  e.deltaY > 0 ? actions.service.setActiveNext() : actions.service.setActivePrev();
}, 120)}
```
- Throttle/debounce the wheel delta (trackpads fire many small events).
- Selectively `preventDefault()` so it doesn't double as list scrolling when the list overflows.
- Handle both vertical and `useHorizontalStyle` layouts.
- Don't interfere with `react-sortable-hoc` drag (`TabItem.tsx:447`, `distance={20}`).
- No new store logic needed.

### Risk
Scroll conflict with the overflow container; drag-reorder interference; over-eager switching on
high-resolution trackpads (hence throttle + a small accumulated-delta threshold).

---

## 5. Favorites page (pin contacts → type → auto-route → send)

This is the most involved part: it needs a new screen, a data model, and **per-service "send"
plumbing**. See [`02-apple-messages.md`](02-apple-messages.md) §4 for the shared "inject/send into a
service" mechanism — Favorites and Apple Messages both rely on it.

### Current state
- **No favorites concept exists.** `onlyShowFavoritesInUnreadCount` (`Service.ts:123`) is unrelated
  (badge counting only).
- New top-level screens render through `AppLayout`'s `<Outlet/>` (`src/components/layout/
  AppLayout.tsx:238`); routes defined in `src/routes.tsx:110-196` (Settings is the model — portal +
  Outlet). UI actions like `openSettings` live in `src/stores/UIStore.ts` + `src/actions/ui`.
- **Sending into a service is recipe/site-specific** and not yet generalized. Two mechanisms exist:
  - `service.webview.executeJavaScript("…")` (already used at `Service.ts:452-456`) — drive the
    page DOM directly (fill composer, click send). Selectors differ per service.
  - Host→guest IPC + a recipe-side handler, mirroring `toggle-to-talk`
    (`src/webview/recipe.ts:157-164`, `RecipeWebview.ts:204-206`) — cleaner/extensible.
  - Deep-link to a conversation first via `service.webview.loadURL(url)` (`ServicesStore.ts:1044`)
    — URL schemes vary per service (e.g. `https://wa.me/<number>`, `tg://`...).

### Plan
**Data model**
- Add a `Favorite` concept: `{ id, label, serviceId, target }` where `target` is the per-service
  address (phone for WhatsApp, channel/DM id for Slack, email for Gmail, handle for Telegram…).
- Persist it. Two options:
  - Renderer-local via `mobx-localstorage` (simple, like the todos feature's settings) — fastest to
    ship.
  - Or as a first-class synced entity (a `favorites` table in the internal server + cloud) — more
    work, survives export/import (#3) naturally. Recommend starting local, then promoting.

**Screen + nav**
- New route `/favorites` in `src/routes.tsx` (child of `/`), container
  `src/containers/favorites/FavoritesScreen.tsx` (model on `SettingsWindow.tsx`).
- Add `openFavorites` action (`src/actions/ui`) + `UIStore` handler, and a sidebar button
  (copy the settings button block in `Sidebar.tsx:373-393`).
- UI: a grid of pinned contacts (avatar + name + service badge), a compose box, send button.
  Reuse the QuickSwitch styling (`src/features/quickSwitch/Component.tsx:40-84`) and MRU ordering
  (`Component.tsx:152-170`) as a starting point for layout.

**Send routing (the hard part)**
- Define a normalized command `sendToService(serviceId, target, text)` in `ServicesStore`.
- Implement a per-recipe adapter registry. For each supported service:
  1. Ensure the service is awake (`_awake`, used by `_setActive`) and attached
     (`isAttached`, `Service.ts:42`).
  2. Navigate to the conversation: `service.webview.loadURL(deepLink(target))` where supported.
  3. Fill + send via either `executeJavaScript(siteSpecificScript(text))` **or** the IPC+recipe
     handler (`_sendIPCMessage({serviceId, channel:'favorites-send', args})`,
     `ServicesStore.ts:990-999`; add the channel to `recipe.ts:157-164` and a `webview.js` handler).
- Start with **2–3 high-value services** (WhatsApp via `wa.me`, Telegram via `tg://`/web, Slack)
  and expand. Document each adapter's selectors centrally so site changes are easy to patch.

### Risks
- DOM selectors are brittle across web-app updates; centralize and version them.
- Some services have no deep-link to a conversation → can only prefill if already open.
- The target service must be logged in (shared `persist:general-session` unless `sandboxServices`).
- New `isFavorite`/favorites data must serialize through the server round-trip if promoted to
  first-class (see `Service.ts` toJson path ~`:305-306`) — confirm the server tolerates new fields.
- Hibernated services must be woken before injecting.

---

## File-touch map (quick reference)

| Sub-feature | Primary files |
|---|---|
| Rounded cards + bg | `src/styles/{globals,colors,tabs,layout,services}.scss`, `src/features/appearance/index.ts:132-135` |
| Gradient from icons | `src/features/appearance/index.ts:45-137`, `src/components/services/tabs/TabItem.tsx:373-396`, `src/models/Service.ts:361`, `src/stores/UIStore.ts:91-98` |
| Modern settings | `src/components/settings/settings/EditSettingsForm.tsx:540-616`, `src/components/settings/navigation/SettingsNavigation.tsx`, `src/components/settings/SettingsLayout.tsx`, `src/styles/settings.scss`, `src/components/ui/*` |
| Hover-scroll switch | `src/components/services/tabs/TabBarSortableList.tsx:50` (or `Sidebar.tsx:194`); reuse `ServicesStore.ts:697-714` |
| Favorites page | `src/routes.tsx:110-196`, new `src/containers/favorites/*`, `src/components/layout/Sidebar.tsx:373`, `src/actions/ui` + `src/stores/UIStore.ts`, `src/stores/ServicesStore.ts` (send routing), `src/webview/recipe.ts:157-164` + recipe `webview.js` (per-service send) |
