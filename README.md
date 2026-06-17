<div align="center">

# Sophie

### All your messaging, productivity & AI — in one private, local-first place.

**by [Askantis](https://askantis.ch)** · a friendly fork of [Ferdium](https://github.com/ferdium/ferdium-app) · Apache-2.0

</div>

---

## What is Sophie?

Sophie is a desktop app that brings **all your chat and messaging services** — WhatsApp, Telegram,
Slack, Discord, Gmail, Microsoft Teams, and many more — together into a single, tidy window. Add as
many services as you like, organize them into workspaces, and stop juggling twenty browser tabs.

It is built on the excellent open-source [Ferdium](https://github.com/ferdium/ferdium-app) (itself a
hard-fork of Franz/Ferdi), and extends it with an **Askantis touch**: a modern redesign, native
local integrations, painless account-free data portability, and — the big one — **a local-first AI
assistant**.

> **Our north star:** your conversations are yours. Sophie is designed to keep your data on your
> machine. No mandatory account, no forced cloud, and AI that can run entirely locally.

## Why we forked

Ferdium is great, and we love it — we still contribute fixes back upstream. But we wanted to build a
more opinionated product around a few ideas Ferdium doesn't focus on:

1. **A modern, delightful UI.** A card-on-background look with rounded corners, gradient accents
   derived from each service's icon, a reworked Settings surface, and quality-of-life touches like
   hover-and-scroll to flip between services.
2. **Local-first AI.** An in-app assistant for smart replies, summaries, and classification —
   powered by a model running on *your* hardware (or your own Ollama box on the LAN), not a vendor's
   cloud. (More below.)
3. **Native local integrations.** First up: **Apple Messages (iMessage)** read directly and securely
   from your Mac, Beeper-style — no bridge server required.
4. **Own your data.** A one-file **export/import** so you can move your whole setup between machines
   without ever creating an account.
5. **A Favorites hub.** Pin the people you talk to most, type once, and let Sophie route the message
   to the right service.

We maintain Sophie as a clean fork: generic improvements flow **back to Ferdium** via pull requests,
while Sophie-specific work lives on our own branch.

## The AI vision 🤖

Sophie's assistant is **local-first and bring-your-own-model**:

- **Run a model locally.** Download a model like **Qwen** from inside the app and chat with it
  offline. Nothing leaves your device.
- **Connect to Ollama.** Point Sophie at a local Ollama instance — or one running on **another
  machine on your network** — over plain HTTP.
- **MCP & tools.** Connect [Model Context Protocol](https://modelcontextprotocol.io) servers so the
  assistant can use tools and act as a multi-step agent.
- **What it does:** smart replies, short & long summaries of chats/emails, message classification,
  structured responses, and complex analysis — surfaced right where you're already talking.
- **Privacy by design.** You always know where inference happens: local model / local Ollama =
  nothing leaves your machine; your own LAN box = stays on your network; a cloud endpoint only if
  *you* configure one.

See the detailed engineering plan in [`docs/askantis/04-local-ai.md`](docs/askantis/04-local-ai.md).

## Roadmap

| Status | Feature | Design doc |
|:--:|---|---|
| 🛠️ planned | Design overhaul (cards, gradients, modern Settings, Favorites) | [01](docs/askantis/01-design-overhaul.md) |
| 🛠️ planned | Local Apple Messages (iMessage) integration | [02](docs/askantis/02-apple-messages.md) |
| 🛠️ planned | Account-free export / import | [03](docs/askantis/03-export-import.md) |
| 🛠️ planned | Local AI assistant (Qwen / Ollama / MCP) | [04](docs/askantis/04-local-ai.md) |
| ✅ done | Rebrand to Sophie | [05](docs/askantis/05-rebrand-and-naming.md) |

Start with the [project overview](docs/askantis/00-OVERVIEW.md).

## 🥚 Why "Sophie"?

The lineage is half the fun. **Franz** became **Ferdi** became **Ferdium** — every app in this family
tree is named after **Archduke Franz Ferdinand** of Austria.

His wife was **Sophie, Duchess of Hohenberg**. Franz Ferdinand famously defied the imperial court to
marry her — for love, not politics. So when we forked Ferdium, naming it **Sophie** felt exactly
right: if Ferdium is the heir to the throne, Sophie is the one who actually **brought everyone
together** — which is, after all, the entire point of this app. 💙

Every other messenger keeps your people scattered across a dozen apps. Sophie reunites them.

## Quick start (development)

Requires Node **22.18.0** and pnpm **10.14.0** (both pinned).

```bash
# one-time: a Node version manager that reads .nvmrc
brew install fnm

# every shell
eval "$(fnm env)" && fnm use     # selects 22.18.0
corepack enable                  # provides pnpm 10.14.0

# install + run
pnpm install
pnpm start:all-dev               # esbuild watch + launch the app
```

Other handy scripts: `pnpm dev` (watch only), `pnpm start` (launch built app), `pnpm build`
(production package), `pnpm typecheck`, `pnpm lint`, `pnpm test`.

Full setup, architecture notes, branching/upstream workflow, and how to migrate an existing
profile are in [`docs/askantis/`](docs/askantis/).

## Credits & license

Sophie stands on the shoulders of [**Ferdium**](https://github.com/ferdium/ferdium-app) and
[**Franz**](https://github.com/meetfranz/franz) — huge thanks to their contributors. Sophie is
distributed under the **Apache-2.0** license, the same as Ferdium; see [`LICENSE`](LICENSE).
"Ferdium" and "Franz" are the marks of their respective projects; "Sophie" and "Askantis" are ours.

<!--
  Askantis: feel free to refine the company description above. We kept the "what Askantis does"
  framing focused on Sophie's product vision (private, local-first, AI-augmented) rather than
  asserting unverified company details.
-->
