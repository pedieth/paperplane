# PaperPlane — Telegram-native copilot for Even Realities G2

Hackathon: Heads Up — Even Realities (DoraHacks). Track 1: Messaging & News.
Targets: Best Telegram Integration ($1,000) + Track 1 placement.
One cash prize per project max — the Telegram prize is the primary target.
Build window: Nov 23 12:00 – Nov 29 23:59 (Dubai time). Demo Day Dec 3, remote OK.

## The idea in one line

Your Telegram, natively on the G2 lens: read what matters, reply by voice,
manage it all from a Telegram Mini App — no PC, no middleman apps.

## Why it is NOT a duplicate (originality check, 2026-11-19)

Survey of the 200+ app Even Hub catalog and GitHub (full detail in research.md):

- **Message Lens** — the only Telegram-on-G2 app. Reads chats via **Beeper
  Desktop**: needs a home computer left on, preset replies only, no voice,
  no Telegram account of its own. We beat it on every axis: phone-only,
  Telegram-native, real voice replies, AI drafts.
- **Chesly** — multi-network chat relay client; not Telegram-native, no bot,
  no Mini App.
- **Built-in notification mirroring** — read-only, raw, unfiltered.
- Nobody has built a **Telegram Bot API / Mini App companion** integration
  for G2. Track 1's own description names Telegram Mini Apps explicitly.
- Crowded areas deliberately avoided: AI chat assistants, captions/
  translation, teleprompters, navigation, news readers, weather, crypto
  tickers, generic notification mirroring, meeting summarizers.

## What it does (read AND write — 25% of the judging score)

1. **Priority inbox on the lens** — only the chats you marked important,
   as glanceable cards (576x288, one message per card, swipe to move on).
   Not a raw notification flood: a curated, quiet inbox.
2. **Voice replies** — long-press the temple, speak; the phone/backend
   transcribes and shows the text on the lens; one tap sends it.
   Optional AI polish ("make it short / formal") before sending.
3. **One-tap smart replies** — three contextual quick replies per message
   for when you cannot talk.
4. **Channel Brief** — a digest card: new posts from your watched Telegram
   channels, AI-summarized into a few lines on the lens. (Demo story:
   crypto listing channels — dozens of posts a day become one brief.)
5. **Mini App companion** — pairing by code (matches the SDK's no-Google-
   sign-in constraint), watchlist management, reply tone, quiet rules.
   All inside Telegram itself.

## How it works (architecture)

- **G2 plugin**: web app (HTML/JS) in the Even app WebView via
  `@evenrealities/even_hub_sdk`; screens built from SDK containers
  (text/list/image), temple + ring gestures; mic PCM streamed to backend.
- **Backend** (ours): holds all keys (safety criterion), talks to the
  **Telegram Bot API**; STT + AI drafting; pushes inbox/digest data to the
  plugin. External host whitelisted in app.json.
- **Telegram side**: the PaperPlane bot lives in the user's groups/channels
  (read + post as the bridge); the Mini App is the settings/pairing surface.
- Scope honesty: bot-bridge covers groups and channels for v1. Personal-DM
  reading via MTProto user API is the documented roadmap item, not v1.

## Hard constraints respected

- Foreground-only platform: no fake "background alerts" — the plugin is the
  glance-and-act layer while open; the bot/Mini App cover the rest.
- No camera, no speaker, monochrome green 16-level display, ~400-500 chars
  per text box, lists 20 items — UI designed for cards, not feeds.
- Money safety: no funds held, no secrets in the plugin package.
- Hackathon rule "build during the hackathon": design/research done before
  Nov 23 is planning; code is written in the window. Any pre-existing
  libraries/APIs used will be declared in the README.

## Demo plan (video, max 3 min, simulator is allowed)

1. Pairing: Mini App shows a code, plugin links in seconds.
2. A message lands in a watched group → card appears on the lens.
3. Voice reply: speak → text on lens → tap → sent (shown in Telegram).
4. Channel Brief: 20 listing posts → one summarized brief card.
5. Close: "Telegram, native on your glasses. No PC. No mirroring."

## Name

**PaperPlane** — Telegram's own paper-plane mark, as a concept: planes
landing on your lens. 10 chars, within the 20-char store limit, no clash
with any catalog app found. (Working name; pk confirms.)
