# PaperPlane — Day 1 notes (Mon Nov 23 build day, executed Nov 24 ~03:30-04:00 UTC)

Status: **Day 1 complete.** Plugin scaffolded, hello-lens screen plus
gestures verified in the simulator with visual evidence. Backend skeleton
running with the pairing shape tested end to end. Nothing is blocked for
Day 2.

## What was built

### Plugin — `app/`
- `app.json` from `evenhub init`, edited: package id
  `com.pedieth.paperplane`, name PaperPlane, network whitelist
  `https://paperplane.pages.dev` (intended neutral Pages host, to be
  provisioned; see backend README for the domain rule).
- `public/index.html` + `public/app.js` + `public/vendor/even-hub-sdk.js`
  (SDK 0.0.16 ESM dist copied in, no build step — the dist has no Node
  built-ins, so it loads directly as an ES module).
- Startup screen: `createStartUpPageContainer` is the first UI call
  (validation via `validateEvenHubPageContainer` returns `{"valid":true}`,
  create returns result 0 = success). Three text containers on the 576x288
  lens: title, status (event capture), hint; plus a two-item contextual
  menu (Link with code / Refresh inbox).
- Gestures via one `onEvenHubEvent` subscription: single tap toggles the
  pairing hint, double-tap shows help, long-press previews the voice day,
  foreground-enter re-asserts the status. Status updates use cheap
  `textContainerUpgrade`, never a full rebuild.
- Fallback: with no bridge (plain browser) the page renders a preview in
  the phone pane after 5 seconds.
- `paperplane.ehpk` stamped by `evenhub pack` (54,512 bytes) — package
  validates. The CLI prints a note about "a different SDK"; the pack
  itself succeeded, so this is a benign version-check message.
- `app/README.md` carries the pre-existing-assets declaration (SDK/CLI/
  simulator versions, bot created 2026-11-20, HeyGen demo voice takes).

### Backend — `backend/`
- `worker/src/index.js`: Cloudflare Worker fetch handler. `GET /health`,
  `GET /api/inbox`, `POST /api/pairing/validate` (one-time, 10-minute
  codes), `POST /api/reply` (queues to the outbox), bridge-only ingest
  endpoints (`/api/ingest/pairing-code`, `/api/ingest/message`,
  `/api/ingest/outbox`) behind `Authorization: Bearer <BRIDGE_SECRET>`.
  Stores are in-memory for the skeleton; KV/D1 bindings land on Day 2.
  One fix made during testing: the Worker default export now keeps a
  single app instance per isolate — a fresh app per request would have
  lost every pairing code and inbox item.
- `dev-server.mjs`: runs the same Worker handler on this VM (`:8787`),
  no Cloudflare account needed.
- `bridge/bridge.mjs`: VM-side bridge. Long-polls Telegram via
  `ppbot.py` (offset persisted in `state.json`), handles `/pair` (code
  generation + Worker registration + code sent in chat), `/start`/`/help`,
  forwards watched-chat messages to the Worker inbox, drains the reply
  outbox. Boot verified: identity `PaperPlaneG2Bot (id 8762696280)`,
  clean poll cycles.
- `backend/README.md`: architecture diagram, endpoint table, the
  token-surrogate constraint, and the pairing design decision (below).

### Architecture decision — pairing v1 is a bot-issued code
The official Mini App `initData` check needs an HMAC keyed by the bot
token, and the token value must never leave the secure surrogate — so no
initData HMAC can run in the Worker or on this VM. Pairing v1 therefore
uses a 6-digit code: user sends `/pair` to the bot, the bridge generates
and registers the code and sends it in chat, the glasses validate it
against `POST /api/pairing/validate`. The Mini App initData flow is a
later enhancement, not v1.

## Verified in the simulator (evidence in `app/sim-evidence/`)
- `day-01-startup-v2.png` — lens shows "PaperPlane / Telegram, on your
  lens. / Tap once to link - double-tap for help."
- `day-01-after-click-v2.png` — after one tap the status line reads
  "Link: open the bot, send /pair." (toggle back verified in console).
- `day-01-after-double-click-v2.png` — after double-tap the status line
  reads the help text.
- Console log (via `/api/console`): bridge ready, validation valid,
  create result 0, "subscribed to lens events", all three gestures with
  `textContainerUpgrade ... ok: true`.
- Backend shape test (curl, dev server): pair code registered
  (`ttlMs: 600000`) → validate returns `linked: true` with the user id →
  second validate returns `unknown-code` (one-time use) → inbox ingest
  then `GET /api/inbox` returns the stored message newest-first.
- Reply queue: `POST /api/reply` → `queued: true`, outbox drains once
  (claim-on-read), second drain empty. Ingest without the bridge secret
  → 401.

## Simulator quirks found (recorded so Day 2+ does not re-debug them)
1. **`/api/screenshot/glasses` returns a static solid-green frame** in
   this simulator build — it never shows the rendered page. The real
   evidence is an x11grab crop of the Glasses Display window
   (offset 820,100, size 576x328). All `day-01-*.png` evidence in
   `sim-evidence/` is from that crop.
2. **A single tap arrives as a sysEvent with only `eventSource` and no
   `eventType`.** CLICK_EVENT is enum 0 and this build drops the field
   (double-click arrives fine with eventType 3). `app.js` now treats a
   sourceless event carrying a source as a tap; the typed
   `eventType: 0` path is also handled for real hardware.
3. **The VM was rebuilt since Nov 19**: the WebKitGTK libs were gone.
   Reinstalled from the Ubuntu archive with a resolver script
   (`/tmp/resolve-debs.py` — reads apt's on-disk Packages indexes,
   downloads the 51 needed .debs over HTTPS, SHA256-verifies, `dpkg -i`).
   The system os-intent replay was also running and held the apt/dpkg
   locks for ~20 minutes; the manual install raced a gap between its
   steps. Note: the replay is re-installing the Nov 19 toolchain
   packages itself (pulseaudio, gstreamer, etc.), so a future rebuild
   may restore the simulator libs on its own. `imagemagick` and
   `xdotool` are still missing on this VM (not needed — ffmpeg x11grab
   covers screenshots).

## Restart commands (services were stopped after verification)
```bash
Xvfb :99 -screen 0 1600x1000x24 &
cd ~/workspace/even-realities/app && python3 -m http.server 8901 --bind 127.0.0.1 --directory public &
cd ~/workspace/even-realities/backend && node dev-server.mjs &   # :8787
DISPLAY=:99 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  ../toolchain/node_modules/@evenrealities/sim-linux-x64/bin/evenhub-simulator \
  http://127.0.0.1:8901/index.html --automation-port 9898
# Verify: bash app/verify-sim.sh  (uses /api/input + /api/console; the
# glasses evidence frames come from x11grab crops, not /api/screenshot)
```

## Open items for Day 2 (Tue Nov 24)
- Plugin pairing screen (enter the 6-digit code on the lens, validate
  against the API, persist the link with `setLocalStorage`).
- Inbox read path: Worker per-user watchlist scoping (KV/D1 bindings);
  bridge `WATCHED_CHATS` set to the demo group and channel ids.
- `evenhub qr` for the dev server URL (sideload path, no login needed).
- STT reassessment is due Thu Nov 26 at the latest (Workers AI Whisper
  candidate vs local Whisper fallback).
- `ppbot.py` extension for reply threading (`reply_to_message_id`) — Day 3.
