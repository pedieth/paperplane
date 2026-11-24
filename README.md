# PaperPlane

Your Telegram, natively on the Even Realities G2 lens — read what matters, reply by voice or with one tap, and manage it all from a Telegram Mini App. No PC, no middleman apps.

Built for the Even Realities "Heads Up" hackathon on DoraHacks, Track 1 (Messaging and News), during the build window of Nov 23–29, 2026.

## What it does

1. **Pairing in seconds.** Send /pair to the bot, get a one-time 6-digit code, enter it on the glasses. The link is stored on the device and the backend; codes live 10 minutes and work once, on either the glasses or the Mini App.
2. **Priority inbox on the lens.** Only the chats you chose to watch — nothing else. One glanceable list with unread counts, then a full message card per chat. Opening a card marks it read.
3. **Smart replies.** Three short replies are generated on the glasses from the message itself (a question gets answer-shaped replies, thanks gets gracious ones, and so on). One tap sends, threaded to the original message. A reply-tone setting (casual, short, formal) restyles them.
4. **Voice replies, reviewed before they fly.** Long-press a card, speak, and the transcript appears on the lens first. Nothing is ever sent without the on-lens approval tap; re-record or drop it instead. Speech-to-text is a local Whisper model — no audio leaves the backend machine.
5. **Channel Brief plus a Mini App companion.** The Brief folds everything new in your watched channels into one card stack (per channel: a count and the key posts). The Mini App page shows the pairing help, the live watchlist, and the tone picker.

## Architecture

```
G2 glasses (plugin)                 Telegram
      |  fetch()                         ^
      v                                  | Bot API (token via secure surrogate)
  Worker API  <---- ingest ----  VM bridge (long-polls via ppbot.py)
  (public)          (bridge secret)      |
      ^                                  v
      +------------- outbox -------------+
      |
  STT worker (local Whisper, claims voice jobs from the API)
```

- **Plugin** (`app/`) — a plain web app for the G2 WebView, built on the Even Hub SDK. Screens are text and list containers on the 576x288 monochrome canvas; every backend call is a plain fetch to the API.
- **Worker API** (`backend/worker/`) — the plugin-facing API: health, inbox, pairing, reply queue, brief, settings, voice jobs, and the Mini App page. The same handler also runs on a plain Node dev server (`backend/dev-server.mjs`), which is how the demo runs.
- **VM bridge** (`backend/bridge/`) — the only part that talks to Telegram. It long-polls the Bot API, issues pairing codes, forwards watched-chat messages into the API, and drains the reply outbox.
- **STT worker** (`backend/stt/`) — faster-whisper (small model, CPU) claiming transcription jobs from the API and posting transcripts back.

**Why a bridge at all?** The bot token lives in a secure credential surrogate that only this VM can use. A public Worker cannot hold or even see the token, so no Telegram call can be made from the Worker — and for the same reason, Telegram Mini App initData HMAC validation (which needs the token) cannot run there either. The design answers both: all Telegram traffic goes through the VM bridge, and identity is a one-time pairing code the bot issues in chat, exchanged by the glasses or the Mini App for a session. The token value is never printed, logged, stored in this repo, or sent anywhere else.

## Run the demo (simulator)

Everything runs on one Linux machine; the G2 simulator renders the lens.

```bash
# 1. Backend API (terminal 1)
cd backend
BRIDGE_SECRET=<redacted> node dev-server.mjs        # http://127.0.0.1:8787/health

# 2. Telegram bridge (terminal 2) — needs the bot helper on the VM
cd backend/bridge
cp watched-chats.example.json watched-chats.json  # then adjust if needed
node bridge.mjs

# 3. Speech-to-text worker (terminal 3, optional — voice replies only)
cd backend/stt
python3 -m venv venv && ./venv/bin/pip install faster-whisper
./venv/bin/python stt-worker.py                    # model downloads on first run

# 4. Plugin + simulator (terminal 4) — Xvfb and WebKit libs per docs/
cd app
npm run serve                                      # http://127.0.0.1:8901/index.html
# start the simulator against that URL (see docs/day-01-notes.md and
# toolchain/simulator-vm.md for the verified headless setup)
```

Then, in Telegram: send /pair to @PaperPlaneG2Bot, enter the code on the lens, and post in a watched chat. The demo chats are the public @PaperPlaneDemo channel and the PaperPlane Demo group. A narrated walkthrough of all five features is the demo video linked in the submission.

Hosting note, stated plainly: a neutral Cloudflare Pages project for the plugin exists (paperplane-4kt.pages.dev, already whitelisted in `app/app.json`), but as of Nov 24 the Pages direct-upload endpoint returns a Cloudflare-side error (HTTP 500, code 1101), so the verified demo path is the local dev host above. The Worker API code is deploy-ready for when the upload route recovers.

## Repo layout

| Path | What it is |
| --- | --- |
| `app/` | The G2 plugin (public web files, manifest, packaged paperplane.ehpk, simulator evidence) |
| `backend/` | Worker API, dev server, VM bridge, local Whisper STT worker |
| `demo-voice/` | Pre-recorded demo voice takes (see declaration) |
| `docs/` | Concept, research, build plan, and the day-by-day build notes |
| `toolchain/` | The verified local simulator setup notes and probe scaffold |

## Pre-existing assets — hackathon declaration

Declared per the hackathon rules (state what existed before Nov 23):

- **No PaperPlane application code existed before Nov 23, 2026, 12:00 Dubai time.** Everything in `app/` and `backend/` was written during the Nov 23–29 build window. Concept, UX design, research, and this build plan were prepared before the window (dated 2026-11-19) as planning documents only; they live in `docs/`.
- **Libraries and platforms used (not written by us):** `@evenrealities/even_hub_sdk` 0.0.16, `@evenrealities/evenhub-cli` 0.2.0, `@evenrealities/evenhub-simulator` 0.9.5 (Even Realities — versions verified 2026-11-19); the Telegram Bot API and Mini Apps platform (Telegram); Node.js; Python.
- **The Telegram bot** @PaperPlaneG2Bot was created on **2026-11-20** via BotFather, before the build window — an infrastructure registration, no application code. Privacy mode is disabled; the bot is an admin in the two demo chats.
- **Demo voice takes** in `demo-voice/` were synthesized with HeyGen Voice Turbo and recorded on **2026-11-20** — audio assets only, used as the spoken input for voice-reply tests and the demo narration.
- **Speech-to-text model:** OpenAI's Whisper (small), run locally on CPU through faster-whisper 1.2.1 — a pre-trained model, downloaded at setup time; no model code or weights were written by us.
- The developer's earlier unrelated projects share no code with this entry.

## Scope, honestly

- Version 1 watches groups and channels the bot belongs to (the bot-bridge scope). Reading personal direct messages would need an MTProto user client; it is a documented roadmap item, not part of this entry.
- The platform is foreground-only: no push and no background alerts on the lens. The plugin refreshes when it comes to the foreground; the bot chat is the alert surface.
- Single-user pairing in this build (one linked identity); the watchlist and stores are shaped so multi-user scoping can be added without changing the API.
