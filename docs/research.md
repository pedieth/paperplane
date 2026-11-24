# Even Realities "Heads Up" Hackathon — Research

Researched 2026-11-19 (web search + page fetches only). Every claim cites its source URL.
Items that could not be verified are marked **[UNVERIFIED]**.

Primary sources:
- Hackathon page: https://dorahacks.io/hackathon/even-realities/detail
- Even Hub developer docs: https://hub.evenrealities.com/docs

---

## 1) HACKATHON FACTS

Source for this whole section unless noted: https://dorahacks.io/hackathon/even-realities/detail

### Format
- "Heads Up" — a 7-day **online** hackathon by Even Realities × TVM Ventures × Daos Hub. Build apps for the Even Realities G2 smart glasses using existing services' APIs.
- Teams of **1 to 4 people**, from anywhere in the world; you can join one team only. Solo entry is allowed (also confirmed by https://aihackathon.app/).
- No physical glasses needed: build and test in the free Even Hub simulator.

### Tracks (pick ONE; only the listed apps qualify — all have open APIs)
1. **Messaging & News** — Telegram (accounts, bots, channels, Mini Apps), Discord, Slack.
   Read: new messages, short digests of Telegram channels and crypto communities.
   Write: reply by voice, or approve a reply drafted by an AI agent.
2. **Crypto & DeFi** — Polymarket, Kalshi, Hyperliquid, CoinGecko, Gram Wallet, Trust Wallet.
   Read: live odds, prices, positions, wallet balances. Write: place a testnet bet/order by voice, confirm with one tap.
3. **Exchanges & Stocks** — Binance, OKX, Bybit, Coinbase, Interactive Brokers, Alpaca.
   Read: a "trading session" with PnL, positions, price alerts. Write: quick confirmations ("Move $500 from spot to margin? Yes/No").
4. **AI Assistants & Work** — ChatGPT, Claude, Gemini, Perplexity, Gmail, Google Calendar, Outlook, Notion.
   Read: inbox triage in 30 seconds, pre-meeting briefs. Write: reply to email, add task, move meeting by voice.
- Rule: **"Use only the apps listed in your track."**

### Special prize — Best Telegram integration (CONFIRMED)
- **$1,000**, listed separately in the prize table as "⭐ Best Telegram integration: $1,000".
- Open to projects **from any track**: "the best use of Telegram (accounts, bots, channels or Mini Apps) on G2."
- One caveat: "A project can win one cash prize." So a project that wins its track prize presumably cannot also take the Telegram prize (the page does not spell out whether the special prize counts as that one cash prize — **[UNVERIFIED]** detail).

### Prize breakdown (total $10,000 USDT, 10 winners)
- Grand Prize: **$2,000** + 2 pairs of G2
- 1st place in each of the 4 tracks: **$1,250** each (4 × $1,250 = $5,000) + 1–2 pairs of G2
- 2nd place in each of the 4 tracks: **$500** each (4 × $500 = $2,000)
- Best Telegram integration: **$1,000**
- Sum: 2,000 + 5,000 + 2,000 + 1,000 = **$10,000** ✔
- Plus up to 10 pairs of G2 glasses total. G2 prizes are **refurbished, fully working units with standard (non-prescription) lenses**, shipped by Even Realities to winners worldwide after the event.
- Cash is paid in **USDT within 7 days of Demo Day**.
- Every finalist also gets: a fast-track pitch to TVM Ventures and partner VCs, a Demo Day demo slot (on site or remote), hackathon merch. More sponsor prizes "may be announced during registration."

### Schedule (all times Dubai, GMT+4)
- Nov 18, 2026 — registration opens
- **Nov 23, 12:00 — online kickoff + Even Realities tech briefing; build starts**
- **Nov 29, 23:59 — submission deadline** (23:59 Dubai = 19:59 UTC; the DoraHacks event listing shows the hackathon ending 2026-11-29T19:59:00Z)
- Nov 30 – Dec 1 — judging; finalists announced
- **Dec 3, 14:00–18:00 — Demo Day and awards at Daos Hub, Dubai**

### Submission requirements
Submit on the DoraHacks hackathon page before the deadline:
- ✅ A **public GitHub/GitLab repository** with a README that explains setup
- ✅ A **demo video of up to 3 minutes**, running in the simulator or on a real G2
- ✅ A short description: the problem, who it is for, how it works, and the track
- ➕ Optional: a packaged `.ehpk` build (an Even Hub listing is **NOT** required for submission)

### Rules that matter
- **"Build during the hackathon."** Open-source libraries and existing APIs are allowed; you must **state in your README what existed before Nov 23**. So pre-building the actual project before Nov 23 is against the rules; preparation/research is fine, pre-existing libraries/APIs are fine if declared.
- **Money safety:** demos use testnet, paper trading or read-only data. Do not hold user funds. No financial advice. Never commit API keys or secrets.
- Respect the terms of the services integrated and the privacy of people whose messages are shown.
- Organizers may disqualify projects that break the rules or the DoraHacks terms.
- **Region/eligibility restrictions:** the page says teams "from anywhere in the world" and G2 prizes ship "worldwide". No country exclusion list appears on the hackathon page. **[UNVERIFIED]** — the underlying DoraHacks platform terms may still apply; no Iran-specific restriction was found on the page itself.

### Demo Day (Dec 3)
- Finalists pitch/demo at Daos Hub, Dubai, Dec 3, 14:00–18:00 Dubai time.
- **Remote presentation is explicitly accepted**: "finalists can demo remotely"; finalist perks list "a demo slot at Demo Day in Dubai, on site or remote". (Our registration was filed as remote.)
- Finalists also get the VC fast-track pitch (TVM Ventures + partner VCs). Whether the VC pitch is part of the same remote slot or separate is **[UNVERIFIED]**.

### Judging criteria and weights (CONFIRMED)
Judges come from Even Realities, TVM Ventures, partner venture funds, sponsors and Daos Hub.
1. **Usefulness on G2 — 30%.** Solves a real moment, glanceable and hands-free.
2. **Read and write — 25%.** Users don't just see information, they act on it. Writing is fast: a short phrase, one tap or the ring, with smart defaults or AI drafts instead of long dictation.
3. **Technical execution — 20%.** Works end to end, reliable, clean code.
4. **UX for display and voice — 15%.** Clear on a 576 × 288 monochrome display, natural by voice.
5. **Business potential and safety — 10%.** Real users and demand, careful with data and money.

The stated bar: "We look for apps that go beyond notifications. A great G2 app lets you read and write."

### Platform constraints the judges/design brief insist on
- Display: monochrome green, **576 × 288 per eye**. Input: microphone, touch controls on the glasses, R1 ring. **No camera, no speaker on the glasses.**
- Your app is a web app (HTML/CSS/JS/TS) running in a WebView inside the Even Realities phone app, talking to G2 over Bluetooth via the Even Hub SDK.
- **One app on screen at a time.** While your app is open it can show live data and take input; when the user switches away it cannot show anything or pop up alerts (foreground-only).
- **No access to other apps' notifications** — talk to the service directly through its API.
- **Bring your own speech-to-text:** the SDK gives raw microphone audio; send it to your own server (e.g. Whisper).
- **Use a backend:** external calls must be whitelisted in `app.json` and pass CORS; route API calls through your own server; never ship API keys inside the app.
- **Sign-in:** Google sign-in does not work inside the WebView — use a separate login page or a pairing code.
- Design guidance: "Design for a glance. One thing on screen, a few words, one action by tap, ring or a short phrase."

### Setup (official 5 steps from the page)
1. Read the Even Hub docs (https://hub.evenrealities.com/docs).
2. `npm install -g @evenrealities/evenhub-cli` and `npm install -g @evenrealities/evenhub-simulator`
3. Start from the official minimal template; point the simulator at your local dev server.
4. Change one line of text and check one input works before building the full project.
5. With a real G2: install the Even Realities App, pair/update, enable developer access on the portal.

---

## 2) EVEN HUB SDK

### G2 hardware — what the glasses can do
Official docs overview (https://hub.evenrealities.com/docs, last updated 2026-08-29):
- **Display:** dual micro-LED, one per lens, **576 × 288 px per eye**, monochrome green, **16 levels** of green. (Note: Even's consumer spec sheet cites 640×350 hardware resolution and 60 Hz / up to 1,200 nits / ~27.5° FOV — via https://extentos.com/docs/ecosystem/platforms/even-realities and https://spatialfieldnotes.com/articles/even-g2-enterprise-sdk-direct-app-work-japan. The developer canvas is 576×288.)
- **Input:** touchpads on **both temples** — press, double press, swipe up, swipe down, long press and release. **Even R1 ring** (optional accessory) with the same gesture set; per Verticar, roughly 9 in 10 G2 owners chose the ring (https://www.verticar.nl/journal/even-realities-g2). R1 price $249 (https://blog.constella.app/blog/what-can-even-g2-do).
- **Audio input:** 4-mic array, single stream, **16 kHz PCM**. **No speaker, no camera** — deliberate design ("the omission is the point"). Plugins can still reach the **phone's** camera and photo album through the SDK with user permission.
- **Sensors:** IMU (head orientation & motion) (https://www.verticar.nl/journal/even-realities-g2).
- **Connectivity/compute:** Bluetooth LE 5.2 to the phone; all code runs on the phone (docs say BLE 5.2; one Even engineering blog reference mentions Bluetooth 5.4 — **[UNVERIFIED]** discrepancy, docs are authoritative for building).
- Weight ~36 g; price from $599 (https://www.verticar.nl/journal/even-realities-g2).
- G1 (2024, for context): ~44 g, 640×200 green display, mic array, no camera; **no first-party SDK or store** — reachable via MentraOS, Even's BSD-2-Clause EvenDemoApp raw-BLE reference, or Gadgetbridge (https://extentos.com/docs/ecosystem/platforms/even-realities).

### What the Even Hub SDK lets a third-party app do
- **One live surface today: "plugins"** — web apps (HTML, CSS, JS or TypeScript; any stack — Vite, React, plain JS) that run in a WebView inside the Even Realities phone app. Three more surfaces are announced but not live: dashboard widgets, dashboard layouts, AI skills (https://hub.evenrealities.com/docs).
- The SDK bridge turns your code into **display containers** on the lenses and turns taps/swipes/mic audio back into events in your code (https://www.verticar.nl/journal/even-realities-g2).
- **Canvas/container limits** (from SDK docs as reported by https://www.verticar.nl/journal/even-realities-g2):
  - Per screen: max **4 image containers + 8 other containers**; exactly **one** container receives input.
  - Text: ~400–500 characters in a full-screen text box; one firmware font, no sizes/bold, left-aligned; 5 brightness levels for hierarchy. Line height 27 px (≈9 rows) per https://www.b-d.io/devices/even-g2.html.
  - Lists: up to 20 items × 64 chars, native firmware scroll/highlight.
  - Images: max 288×144 px, 4-bit greyscale, sent after the page exists; full-screen refresh ~800 ms — effectively no animation.
  - **Not available:** arbitrary pixel drawing, audio output, font control, background fills, animations, direct Bluetooth access.
- **Device APIs** available to plugins: mic capture (glasses or phone), one-shot and continuous GPS, IMU, phone camera and photo album, battery and wear status, local storage (https://www.verticar.nl/journal/even-realities-g2).
- **Real-time data:** while the plugin is in the foreground it can fetch live data (via whitelisted domains in `app.json` / your own backend) and update containers in place. **Foreground-only:** plugins cannot push notifications to the lens or run visibly in the background (https://www.hinty.eu/blog/even-hub-apps; also hackathon page).
- **Phone companion requirement:** the Even Realities app on iPhone (iOS 16+) or Android (11+) runs everything; the glasses are paired to the phone (https://blog.constella.app/blog/what-can-even-g2-do). Developer access: sign in at https://hub.evenrealities.com with your Even account and a developer section appears in the app's Even Hub tab — self-serve, no pilot gate (https://extentos.com/docs/ecosystem/platforms/even-realities).

### Tech stack and tooling (all on npm, MIT/open tooling)
- SDK: `@evenrealities/even_hub_sdk` (TypeScript bridge)
- CLI: `@evenrealities/evenhub-cli` (alias `eh`) — requires Node.js 20.17+ (Node 20), 22.13+ (Node 22), or 23.5+ (https://hub.evenrealities.com/docs/cli/)
- Simulator: `@evenrealities/evenhub-simulator`
- Official bundle repo: `even-realities/everything-evenhub` (SDK + CLI + simulator + docs) and `evenhub-templates` starter scaffolds, both MIT (https://extentos.com/docs/ecosystem/platforms/even-realities; https://the-agent-daily.org/only-geeks/deep-dives/even-realities-g2-text-terminal-you-wear)
- `@evenrealities/pretext` — MIT package with the official font metrics (27 px line height) (https://www.b-d.io/devices/even-g2.html)
- Typical code shape: `waitForEvenAppBridge()` → `bridge.createStartUpPageContainer({...})` → `bridge.onEvenHubEvent(...)` → `bridge.textContainerUpgrade(...)` (https://www.verticar.nl/journal/even-realities-g2).

### Simulator
- Desktop simulator that renders your app as the lenses would: `evenhub-simulator http://localhost:5173` pointed at your local dev server (https://hub.evenrealities.com/docs).
- Runs on **Windows, macOS and Linux**; takes clicks and swipes as input and can use your computer's microphone (https://www.hinty.eu/blog/even-hub-apps).
- On-device preview without publishing: `evenhub qr --url <dev-server-url>` generates a QR code to load the app onto a real G2 (https://hub.evenrealities.com/docs).

### Publishing to Even Hub
- Package the app into a single **`.ehpk`** file: `evenhub pack app.json dist -o my-app.ehpk`; `evenhub create` registers the app and uploads the first build (https://hub.evenrealities.com/docs/cli/).
- Testing stages: QR sideload (live reload) → private build (owner-only install) → beta channel for testers invited by email (needs build on beta channel + Active tester membership).
- Public publishing goes through the **developer portal** (https://hub.evenrealities.com): listing details, artwork, privacy policy, then **manual review** — a reviewer installs the build like a beta tester and checks it against the published App Submission & QA Guidelines (https://www.hinty.eu/blog/even-hub-apps summarizing https://hub.evenrealities.com guidelines).
- Review checks include: works with phone locked / Even app in background; no black screen on first launch; setup explained on the glasses and remembered; double tap on main screen opens the system exit dialog; privacy policy covers every permission; **no API keys inside the package**; app name ≤ 20 characters and without "Even" (https://www.hinty.eu/blog/even-hub-apps).
- Publishing is permanent (no rollback; fixes need a new version), visible worldwide with no country targeting; review duration not published (https://www.hinty.eu/blog/even-hub-apps).
- Even Hub store facts: launched publicly **April 3, 2026** (with Even Realities app v2.1.1); ~50 apps at launch and 2,000+ developers; **200+ plugins** in the public catalog by Nov 13, 2026; **no paid distribution yet** — installs are free, some apps sell their own subscriptions outside the store (https://www.hinty.eu/blog/even-hub-apps; https://extentos.com/docs/ecosystem/platforms/even-realities).
- Store categories: AI, Productivity, Lifestyle, Music, Travel, Entertainment; Discovery page has Editor's choice, Trending and Fresh lists (https://www.hinty.eu/blog/even-hub-apps).

### Telegram / messaging APIs in the SDK
- There is **no Telegram-specific API in the Even Hub SDK**. Messaging integrations are built by the plugin/backend calling the service's own API — the hackathon page explicitly directs this: "No access to other apps' notifications. Talk to the service directly through its API." For Telegram that means the **Telegram Bot API** and/or the **user-account API (MTProto)** from your own backend, plus Telegram **Mini Apps** as a companion surface (Track 1 names all three: accounts, bots, channels, Mini Apps).
- External network calls from the plugin must be **whitelisted in `app.json`** and pass CORS; keys must live on your backend (hackathon page, https://dorahacks.io/hackathon/even-realities/detail).

### Alternative/parallel platforms (context, not the hackathon route)
- **MentraOS** (Mentra, formerly AugmentOS) — open-source (Apache-2.0) smart-glasses OS + TypeScript SDK supporting **both Even G1 and G2** (plus Mentra Live, Vuzix Z100), phone-local miniapps in MentraOS 3.0, no Even store review (https://extentos.com/docs/ecosystem/platforms/even-realities; https://oxivue.com/guides/open-source-smart-glasses). The hackathon, however, is built on the Even Hub SDK/simulator.
- **Enterprise SDK** (announced Nov 10, 2026): native Android/iOS + Flutter SDKs (`0.1.0-beta.14`) for organizations to connect G2 directly to their own apps; application-based alpha, license-gated — not relevant to this hackathon (https://hub.evenrealities.com/docs/enterprise/native; https://spatialfieldnotes.com/articles/even-g2-enterprise-sdk-direct-app-work-japan).
- Raw-BLE community: i-soxi/even-g2-protocol documents the G2 BLE protocol; the hackathon expects the official SDK route.

---

## 3) ORIGINALITY SURVEY — what already exists for Even G1/G2

Even Hub catalog size: 200+ plugins as of Nov 13, 2026 (https://www.hinty.eu/blog/even-hub-apps). A community GitHub list, **awesome-even-realities-g2** (https://github.com/pangoleen/awesome-even-realities-g2), tracks 250+ G2 projects (per https://blog.constella.app/blog/best-even-g2-apps). The hackathon page itself warns: "Browse the Even Hub catalogue before you pick an idea: messages, news, AI assistants, navigation, timers. Build something new, or something clearly better."

### Built-in G2 features (first-party — do NOT rebuild these)
Source: https://www.hinty.eu/blog/even-hub-apps; https://blog.constella.app/blog/what-can-even-g2-do
- **Conversate** — live conversation captions + AI Cues, Prep Notes, post-meeting AI summary; v2.4.0 added Conversate Pro Mode and a personal Knowledge Base.
- **Teleprompt** — script scrolls at speaking pace or via ring.
- **Translate** — live subtitles in your language.
- **Navigate** — built-in turn-by-turn directions.
- **Even AI** — "Hey, Even" voice assistant (Even AI 2.0 in app v2.4.0).
- **Dashboard** — widgets: headlines/news, stocks, calendar, tasks, health data.
- **Notifications** — filtered phone-notification mirroring (per-app opt-in; last 10 kept on the frame; tap marks read; read-only, no replies).
- **QuickNote / QuickList** — notes and tasks on the glasses.
- **Terminal Mode** — shows whether your AI coding agents (Claude Code, Codex) are running/blocked/waiting and lets you approve their next step with a ring tap (https://www.verticar.nl/journal/even-realities-g2).
- Health/activity from the R1 ring.

### Even Hub third-party apps (one line each)
Trending/Editor's-choice core, Nov 2026 (https://www.hinty.eu/blog/even-hub-apps; https://blog.constella.app/blog/best-even-g2-apps):
- **Weather** (Nick Ustinov) — glanceable forecast in the lens; free, open source.
- **Books** (Nick Ustinov) — read 70,000+ Project Gutenberg classics or your own ePubs in the lens.
- **OcuClaw** — bring-your-own-model AI agent on the glasses.
- **IRIS** — personal AI assistant ($14.99/mo or own keys).
- **Aside** — factual answers surfaced during conversations (own AI keys).
- **Constella** — "AI second brain": answers and meeting cues from your own email and notes ($19.99–39.99/mo plans).
- **Navigaze** — turn-by-turn navigation for car/bike/walking/transit (Pro $4.99/mo).
- **DisplayPlus Music** — now-playing, album art, lyrics and Spotify controls.
- **Live News** — news radio, weather, games and tools bundle; optional "Foresight" mode surfaces related info in meetings.
- **Messages / Message Lens** (Thibaut Rey) — WhatsApp, Signal **and Telegram** chat browsing with unread badges and preset replies, via **Beeper Desktop running on your home computer** (see §4).
- **Visionote** — your photos, drawings and notes on the lens.
- **Notes** — notes, checklists, voice memos.
- **Pomodoro Timer** — simple focus timer. **Timer** — basic timer.
- **ER Kitchen** — step-by-step recipes and cooking timers.
- **Breathe** — evidence-ranked breathing exercises, offline.
- **EverReply Translator** — translates and suggests replies (own Gemini key).
- **Chess** — play Stockfish using the ring.
- **terminally** — an SSH terminal in the lens.
- **ER Market / My Markets** — stocks and crypto prices.
- **Tesla Controls / Tesla** — vehicle status and controls.
- **Calendar G2** — Google Calendar on the lens; **Control Spotify** — Spotify control.
- **SubwayLens** (NYC), Seoul and Tokyo subway apps — transit departures.
- **Cue Prompter / Telepages** (+ Arabic, Hebrew, Tamil versions) — third-party teleprompters.
- **Glass Caption / Open Caption / Two-Way Translate / Soniox Translate** — captions and translation.
- **Hinty Voice Assistant** — interview/meeting answer hints from your own documents (built, in review at time of writing).

More catalog apps (https://buildforglasses.com/even-g2-apps-and-plugins/):
- **Darts** — darts scoreboard on the lens.
- **EvenBrowse** — browse websites on the phone, read the text on G2.
- **MuSe** — identifies music playing around you, shows cover art/title/artist/album.
- **Perron-NS** — live Dutch Railways (NS) departures.
- **PolyGot** — language-learning coach.
- **Weather for Even G2** — nine swipeable forecast screens (Open-Meteo).
- **Even Transit** — public transport planner (GitHub source only).
- **Hevy for Even G2** — run a Hevy gym workout from the glasses (GitHub source only).
- **Connect Remote** — Genesis/Kia/Hyundai vehicle status on G2.
- **EDITH 2.0** — an AI assistant for G2.
- First-party-adjacent extras named in reviews: eBook readers, Mirai's AR Radio (news), a virtual-pet/Tamagotchi app, guided workouts, Tesla Charge Indicator, Stillness breathing, Prep Notes (https://www.phonearena.com/reviews/even-realities-g2-ar-glasses-review_id8089; https://www.smartwearables.io/blog/even-realities-even-hub-smart-glasses-apps-2026).

### Notable open-source G1/G2 projects on GitHub
- **pangoleen/awesome-even-realities-g2** — curated index of G2 SDKs, tools and apps (https://github.com/pangoleen/awesome-even-realities-g2).
- **MentraOS** (Mentra Labs) — open-source glasses OS/SDK for G1 + G2 and other glasses; its store apps include live captions, **Mentra AI** (voice assistant), **Merge** (proactive AI that answers unprompted), Mentra Notes, Mentra Maps, Calendar Reminders, Dash (run/cycle stats), MemCards (https://extentos.com/docs/ecosystem/platforms/even-realities; https://glasses.appson.cloud/apps).
- **even-realities/everything-evenhub** — Even's official developer kit (SDK, CLI, simulator, docs); **evenhub-templates** — official starters (MIT).
- **even-realities-app-template** (r4stl1n) — MIT native SwiftUI baseline for G2 + R1 with direct BLE, LC3 audio, mic capture, on-device speech-to-text (https://github.com/pangoleen/awesome-even-realities-g2 via search result; https://www.b-d.io/devices/even-g2.html).
- **i-soxi/even-g2-protocol** — community documentation of the G2 BLE protocol (https://www.b-d.io/devices/even-g2.html).
- **cc-g2** (wmoto-ai) — approve Claude Code / Codex / Copilot CLI prompts from G2 by voice or touch; **Claude Code G2** (sam-siavoshian) — run Claude Code by voice; **Claude Remote for G2** (ThatCrispyToast) — HUD for Claude remote sessions: watch the stream, approve and reply (https://glasses.appson.cloud/apps).
- **G2CC** (expectbugs) — windowed G2 environment driven from your PC: Claude Code, reader, music, games (https://glasses.appson.cloud/categories/utilities).
- **weather-even-g2** (nickustinov) — five/nine-screen weather from Open-Meteo, no backend; **stt-even-g2** — real-time on-glasses speech-to-text via Soniox; **Soniox Note** — transcription saved as a voice note on G1/G2 (https://github.com/pangoleen/awesome-even-realities-g2).
- **Cue** (nodesbio) — open-source teleprompter for the G1 (https://glasses.appson.cloud/apps).
- **G1 Extended** (LabbeSimon) — telemetry-free Android client unlocking custom HUD layouts on G1 (https://glasses.appson.cloud/categories/utilities).
- **EvenDemoApp** — Even's official BSD-2-Clause raw-BLE reference app for G1 (https://extentos.com/docs/ecosystem/platforms/even-realities).
- **g2-vi-en-realtime / g2-relay** — Vietnamese→English live translation for G2 via OpenAI Realtime + a Cloudflare Worker relay (https://www.carlmasters.com/).

### Public posts / projects about THIS hackathon's likely entries
- Registration opened Nov 18, 2026; as of Nov 19 **no public entries or entry announcements were found** — DoraHacks project listings appear at submission time (Nov 23–29). Searches of the web for declared "Heads Up" entries returned only organizer/promotional pages (DoraHacks, Eventbrite listing https://www.eventbrite.com/e/heads-up-even-realities-hackathon-by-tvm-ventures-daos-hub-tickets-2004953173915, and the aggregator https://aihackathon.app/). **[No entrant projects verifiable yet — re-check DoraHacks during build week.]**
- One studio (ViewFyre) publicly says it is "creating software for the Even Realities G2" — glanceable, text-first tools driven by ring, voice and agents (https://www.viewfyre.com/work.html) — not confirmed as a hackathon entry. **[UNVERIFIED as an entry]**
- The strongest signal of what the crowd will build is the hackathon page itself: its track descriptions (channel digests, voice replies, AI-drafted replies, price/odds tickers, voice testnet trades, inbox triage) are the templates most teams will follow literally.

### OBVIOUS / CROWDED concept areas to AVOID (with evidence)
1. **Generic AI chat / voice assistant on glasses** — built-in Even AI; OcuClaw, IRIS, EDITH 2.0, Mentra AI, Merge; hackathon Track 4 invites exactly this.
2. **Live captions / translation / conversation AI cues** — built-in Conversate + Translate; Glass Caption, Open Caption, Two-Way Translate, Soniox Translate, EverReply Translator, Aside, Constella, Hinty; Mentra captions.
3. **Teleprompters** — built-in Teleprompt; Cue Prompter, Telepages (+3 script variants), Cue (G1).
4. **Navigation / transit boards** — built-in Navigate; Navigaze; SubwayLens, Seoul/Tokyo subway apps, Perron-NS, Even Transit, Mentra Maps; the Verticar article even uses a transit board as its mock example.
5. **News readers / news digests** — built-in Dashboard headlines; Live News; Mirai's AR Radio; the hackathon page lists "news" among existing catalogue categories to avoid duplicating.
6. **Weather** — Weather and Weather for Even G2 are top-of-store; weather-even-g2 open source.
7. **Crypto/stock price tickers** — built-in Dashboard stocks widget; ER Market, My Markets; and Tracks 2–3 will flood the field with price/PnL viewers. (A ticker alone also fails the "read AND write" judging weight.)
8. **Notification mirroring / generic message inbox** — built-in per-app notification mirroring; Message Lens already does multi-network chat reading incl. Telegram.
9. **Timers / Pomodoro / breathing** — Timer, Pomodoro Timer, Breathe, Stillness.
10. **Music control / now playing** — DisplayPlus Music, Control Spotify, MuSe.
11. **E-book / text readers** — Books, ePub Reader for Even G2.
12. **Calendar viewers** — built-in Dashboard calendar; Calendar G2; Mentra Calendar Reminders.
13. **Coding-agent monitors/approvers** — built-in Terminal Mode; cc-g2, Claude Code G2, Claude Remote for G2, G2CC, terminally (SSH). Very crowded with exactly our skill set — avoid.
14. **Meeting-prep / inbox-triage summaries** — built-in Prep Notes/Conversate summaries; Constella; Track 4's example text literally describes "inbox triage in 30 seconds" — expect many clones.
15. **Games** — Chess (Stockfish), darts scoreboard, virtual pet already exist.
16. **Voice-reply-to-messages as the whole product** — VOX, Chesly, GlassMail and other reply apps launched on Even Hub in 2026 (https://blog.constella.app/blog/what-can-even-g2-do); Message Lens has preset replies. A bare "reply by voice" entry will look derivative; it needs a sharper angle.

---

## 4) TELEGRAM ANGLE

### Existing Telegram integrations for Even glasses
- **Message Lens (formerly "Messages")** by Thibaut Rey — the only established Telegram-on-G2 app found. It brings **WhatsApp, Signal and Telegram** to the lens **through Beeper**: browse chats, see unread badges, read messages, send **quick preset replies**. It sits in Even's Editor's choice row. Hard limitation, stated in its own listing: **"Requires Beeper Desktop running on your local network"** — a home computer must stay on (https://blog.constella.app/blog/best-even-g2-apps; https://www.hinty.eu/blog/even-hub-apps).
- **Chesly** — a Beeper alternative whose chats reach the G2 ("Read it on your glasses… reply by voice, or type without saying a word, with Chesly Plus"); covers Telegram among ~20 networks, with AI Notifications that decide which messages alert you (Chesly Plus). It is a multi-network client play, not a Telegram-native integration (https://chesly.app/beeper-alternative).
- **Built-in notification mirroring** — the G2 already shows Telegram (and any app's) phone notifications in the lens: per-app opt-in in the Even app, alerts auto-display in the foreground, last 10 stored on the frame, tap marks read; **read-only — no replies** (https://www.arcompare.com/guides/glasses-that-show-text-messages/; https://www.framesandfeatures.com/features/notifications/).
- **Reply apps generally:** VOX, Chesly, GlassMail "and others" appeared on Even Hub in 2026 specifically because the G2 can't answer messages out of the box (https://blog.constella.app/blog/what-can-even-g2-do). None found is Telegram-first or bot-based.
- No Telegram **bot-driven** or **Mini App** companion integration for Even glasses was found in the Even Hub catalog coverage, GitHub lists, or web search. **[As of 2026-11-19; catalog has 200+ apps and no complete public index was crawlable — absence is probable, not proven.]**
- Smart glasses generally: Meta Ray-Ban Display shows WhatsApp/Messenger/Instagram with replies via its Neural Band — but Telegram is not among Meta's named messaging apps (https://www.arcompare.com/guides/glasses-that-show-text-messages/).

### What a Telegram integration can technically do via the Even Hub SDK
Mechanics (all from §1–2 sources):
- **Architecture:** the plugin (web app in the Even app's WebView) cannot hold Telegram credentials safely and cannot reach arbitrary hosts — external calls must be **whitelisted in `app.json`**, pass CORS, and API keys must live on **your own backend**. So: plugin ⇄ your backend ⇄ Telegram APIs.
- **Via the Telegram Bot API (backend):** a bot the user chats with can push content to your backend, which the open plugin polls/fetches and renders as text/list containers — e.g. channel digests, alerts, approval requests. The user acts with tap/ring/voice; the backend executes via the bot (post, forward, reply in the bot chat). Bot API cannot read a user's existing chats/channels — it only sees chats the bot is in.
- **Via a user account (MTProto, backend):** full read of the user's chats/channels is technically possible server-side (this is what Track 1 means by "Telegram (accounts…)"), enabling real channel digests and message replies. Sign-in can't use Google-style flows in the WebView; the hackathon page prescribes "a separate login page or a pairing code" — a Telegram login-code flow fits this pattern. Handle credentials server-side only; the rules require respecting Telegram's terms and message privacy.
- **Voice replies / AI-drafted replies:** the SDK delivers raw mic audio (16 kHz PCM) — your backend runs STT (e.g. Whisper) and/or an LLM draft; the glasses show the draft; one tap/ring press approves sending (exactly the pattern Track 1 and judging criterion 2 reward: "approve a reply drafted by an AI agent", "smart defaults or AI drafts instead of long dictation").
- **Telegram Mini App as companion:** Track 1 explicitly lists Mini Apps. A Telegram Mini App (inside Telegram on the phone) can serve as the pairing/settings/companion surface for the glasses plugin — e.g. pairing code shown in the Mini App, channel selection, digest preferences — while the G2 plugin is the glanceable read/act layer. No existing Even-glasses project was found doing this.
- **Hard limits to design around:**
  - **Foreground-only:** the plugin can only show data while it is the open app; it **cannot pop up alerts** or mirror notifications in the background, and it has **no access to the phone's notification stream**. Any "alert" concept must work while the user has the app open, or lean on the G2's built-in notification mirroring for the actual alert and the plugin for the follow-up action.
  - One app on screen at a time; ~400–500 chars per text container; lists ≤ 20 × 64 chars; images ≤ 288×144 4-bit greyscale.
  - No speaker: all feedback is text. No camera on the glasses (phone camera/album reachable via SDK with permission).
  - Money safety rules: testnet/paper/read-only for anything financial; never hold user funds; no secrets in the app package.

### White space suggested by the survey (for ideation, not a decision)
- Telegram-**native** (Bot API / account API) instead of Beeper-relayed: no home PC required — the exact weakness of Message Lens.
- Bot-driven glanceable workflows (approvals, digests, channel triage) where the **bot is the product** and the glasses are its approve/act surface.
- A **Telegram Mini App companion** for pairing and configuration — named in Track 1, not seen in the existing catalog.
- AI-drafted replies with one-tap approval aimed at Telegram channels/communities specifically (track language), rather than generic chat reading.

---

## Source list
- https://dorahacks.io/hackathon/even-realities/detail
- https://hub.evenrealities.com/docs
- https://hub.evenrealities.com/docs/cli/
- https://hub.evenrealities.com/docs/enterprise/native
- https://www.hinty.eu/blog/even-hub-apps
- https://blog.constella.app/blog/best-even-g2-apps
- https://blog.constella.app/blog/what-can-even-g2-do
- https://buildforglasses.com/even-g2-apps-and-plugins/
- https://www.verticar.nl/journal/even-realities-g2
- https://extentos.com/docs/ecosystem/platforms/even-realities
- https://www.b-d.io/devices/even-g2.html
- https://github.com/pangoleen/awesome-even-realities-g2
- https://glasses.appson.cloud/apps
- https://chesly.app/beeper-alternative
- https://www.arcompare.com/guides/glasses-that-show-text-messages/
- https://www.framesandfeatures.com/features/notifications/
- https://aihackathon.app/
- https://www.eventbrite.com/e/heads-up-even-realities-hackathon-by-tvm-ventures-daos-hub-tickets-2004953173915
