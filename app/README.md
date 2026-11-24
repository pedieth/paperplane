# PaperPlane — G2 plugin

Your Telegram, natively on the Even Realities G2 lens: read what matters,
reply by voice, manage it all from a Telegram Mini App. No PC, no middleman
apps.

Hackathon: Even Realities "Heads Up" (DoraHacks), Track 1 — Messaging & News.
Primary target: the Best Telegram Integration prize.

## Day 1 status

- Hello-lens startup screen: `createStartUpPageContainer` is the first UI
  call, with three text containers (title, status, hint) and a two-item
  contextual menu (Link with code / Refresh inbox).
- Gestures: one subscription via `onEvenHubEvent`. A single tap on the
  status container toggles the pairing hint; double-tap shows help;
  long-press previews the voice-reply day; foreground-enter re-asserts the
  status line. Every event is logged to the console.
- The status line updates with cheap `textContainerUpgrade` calls, never a
  full page rebuild.
- No bridge, no problem: if the page loads outside the Even app (plain
  browser), it falls back to a preview rendering in the phone pane after
  five seconds.

## Run it (simulator)

```bash
# Serve the plugin (from this directory)
npm run serve            # http://127.0.0.1:8901/index.html

# In another shell, virtual display + simulator (see ../toolchain/simulator-vm.md)
Xvfb :99 -screen 0 1600x1000x24 &
DISPLAY=:99 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  ../toolchain/node_modules/@evenrealities/sim-linux-x64/bin/evenhub-simulator \
  http://127.0.0.1:8901/index.html --automation-port 9898
```

Drive it through the automation API (`http://127.0.0.1:9898/api/input`,
`{"action":"click"}`) and pull the real glasses framebuffer from
`/api/screenshot/glasses`. Evidence from the Day 1 run is in
`sim-evidence/`.

## Package it

```bash
npm run pack   # writes paperplane.ehpk (optional submission artifact)
```

## Layout (576x288 lens)

| Container | Position | Content |
| --- | --- | --- |
| title (id 1) | 24, 20 — 528x60, brightness 4 | PaperPlane |
| status (id 2, event capture) | 24, 96 — 528x64, brightness 3 | Status line, tap to toggle |
| hint (id 3) | 24, 176 — 528x48, brightness 2 | Tap once to link - double-tap for help |

## Pre-existing assets — hackathon declaration

Per the hackathon rules, what existed before the build window
(Nov 23, 12:00 Dubai time):

- Concept, UX design and research for PaperPlane were prepared before the
  build window (dated 2026-11-19) — planning documents only. **No PaperPlane
  application code existed before Nov 23, 12:00 Dubai time.** All
  application code in this repo was written during Nov 23–29, 2026.
- Libraries and platforms used (not written by us):
  `@evenrealities/even_hub_sdk` 0.0.16, `@evenrealities/evenhub-cli` 0.2.0,
  `@evenrealities/evenhub-simulator` 0.9.5 (Even Realities, MIT — versions
  verified on 2026-11-19); the Telegram Bot API and Telegram Mini Apps
  platform (Telegram); Node.js.
- The PaperPlane Telegram bot (@PaperPlaneG2Bot) was created 2026-11-20 via
  BotFather, before the build window — an infrastructure registration, no
  application code. Privacy mode is disabled; the bot is admin in the demo
  group and channel.
- Demo voice lines and takes (English only, synthesized with HeyGen Voice
  Turbo) were prepared 2026-11-20 in `../demo-voice/` — audio assets only,
  used for the demo video voice takes.
- The developer's earlier unrelated projects (Folio, Telegram sticker
  packs) share no code with this entry.

## Rules this repo follows

- English-only public-facing text; no mention of the developer's origin.
- No underscores in names or written text (hyphens instead); the only
  exceptions are fixed external identifiers (SDK method names, Telegram API
  field names) that cannot be renamed.
- No secrets in the plugin package. The bot token never leaves the backend.
