# PaperPlane — Build Plan, Nov 23–29, 2026

Hackathon: Even Realities "Heads Up" (DoraHacks), Track 1 — Messaging & News.
Targets: Best Telegram Integration ($1,000) + Track 1 placement.
Deadline: **Nov 29, 23:59 Dubai time**. Demo Day Dec 3 (remote accepted).
Concept: `concept.md`. Research: `research.md`. Toolchain record: `toolchain/toolchain-notes.md`.

**Rule compliance:** no PaperPlane application code exists before Nov 23. Everything before
the window is research, design, toolchain verification, and this plan. All pre-existing
assets are declared in the README (draft declaration at the bottom of this file).

---

## Verified foundation (2026-11-19)

### Toolchain
- Node v24.22.1, npm 10.9.4.
- `@evenrealities/even_hub_sdk` **0.0.16**, `@evenrealities/evenhub-cli` **0.2.0**,
  `@evenrealities/evenhub-simulator` **0.9.5** — installed and inspected.
- `evenhub` CLI runs fully headless (`init`, `pack`, `qr` verified). No standalone
  `validate` command — validation lives inside `pack` and in the SDK's runtime validators.
- The simulator **runs on this VM** under Xvfb (WebKitGTK 4.1 libs installed via apt;
  automation API + ffmpeg x11grab recording verified 2026-11-19 — full record in
  `toolchain/simulator-vm.md`). pk's computer is not needed for simulator or video work.

### SDK API surface we build on (from `dist/index.d.ts` of SDK 0.0.16, exact names)
- Entry: `const bridge = await waitForEvenAppBridge()` → singleton `EvenAppBridge`.
- First UI call must be `bridge.createStartUpPageContainer(new CreateStartUpPageContainer({...}))`;
  later screens via `bridge.rebuildPageContainer(new RebuildPageContainer({...}))`;
  cheap text updates via `bridge.textContainerUpgrade(new TextContainerUpgrade({...}))`;
  images via `bridge.updateImageRawData(new ImageRawDataUpdate({...}))`;
  exit via `bridge.shutDownPageContainer(exitMode)`.
- Containers (per page: **total 1–12; text ≤ 8, image ≤ 4**): `TextContainerProperty`
  (content, textColor brightness **0–4**), `ListContainerProperty` +
  `ListItemContainerProperty` (`itemName: string[]`, firmware list, design for ≤ 20 items
  × 64 chars), `ImageContainerProperty` (width 20–288, height 20–144), and a contextual
  `MenuContainerProperty`/`MenuItemProperty` (≤ 10 items, labels ≤ 32 UTF-8 bytes) attached
  as `menuObject` — this is our action surface (Reply / Voice / Brief). Exactly one
  container sets `isEventCapture: 1` to receive input.
- Events: one subscription, `bridge.onEvenHubEvent(cb)`, discriminated by which field is
  set: `listEvent` (`List_ItemEvent`: currentSelectItemIndex/Name), `textEvent`
  (`Text_ItemEvent`), `sysEvent` (`Sys_ItemEvent`), `audioEvent` (`AudioEvent`),
  `menuItemClickEvent` (`MenuItemClickEvent.itemID`).
- Gesture/lifecycle model: `OsEventTypeList` — `CLICK_EVENT`, `DOUBLE_CLICK_EVENT`,
  `SCROLL_TOP_EVENT`, `SCROLL_BOTTOM_EVENT`, `FOREGROUND_ENTER_EVENT`,
  `FOREGROUND_EXIT_EVENT`, `LONG_PRESS_EVENT`, `LONG_PRESS_RELEASE_EVENT`,
  `IMU_DATA_REPORT`, exit events. Input origin in `EventSourceType`:
  `TOUCH_EVENT_FROM_GLASSES_R` / `TOUCH_EVENT_FROM_GLASSES_L` / `TOUCH_EVENT_FROM_RING` —
  temple and ring arrive through the same event stream.
- Microphone: `bridge.audioControl(true, AudioInputSource.Glasses | AudioInputSource.Phone)`
  (glasses mic requires the startup page to exist first). PCM frames arrive as
  `event.audioEvent` → `AudioEvent { audioPcm: Uint8Array, source, direction: number|null,
  speakerRole: AudioSpeakerRole }`. Stream is 16 kHz PCM per the docs; we forward frames
  from the plugin to our backend for STT. Stop with `audioControl(false)`.
- Backend access: the SDK has **no HTTP API of its own** — the plugin is an ordinary web
  page in the WebView and uses plain `fetch()` to our backend. The backend host must be
  listed in `app.json` under the `network` permission's `whitelist`, and CORS must pass.
  All keys live on the backend only.
- Extras available if needed: `bridge.getUserInfo()`, `getDeviceInfo()`,
  `setLocalStorage/getLocalStorage` (persist pairing state on the phone),
  `onDeviceStatusChanged`, `onLaunchSource` (`appMenu` | `glassesMenu`),
  `imuControl(...)`, `validateEvenHubPageContainer(...)` (pre-flight check before every
  create/rebuild call).
- `app.json` manifest (from `evenhub init`): `package_id`, `edition`, `name` (≤ 20 chars
  for store QA — "PaperPlane" fits), `version`, `min_app_version`, `min_sdk_version`,
  `entrypoint`, `permissions[]`, `supported_languages[]`.

### Telegram side (docs only — core.telegram.org/bots/api and /bots/webapps)
- Transport: HTTPS calls to `https://api.telegram.org/bot<token>/<METHOD>`; token stays
  on our backend.
- Receiving (bridge ingestion): **webhook** for production — `setWebhook`
  (`url`, `secret_token`, `allowed_updates`, `drop_pending_updates`), verified with
  `getWebhookInfo`, removed with `deleteWebhook`. `getUpdates` long polling
  (`offset` = last `update_id` + 1) for local dev only — the two are mutually exclusive.
- Update types we consume: `message`, `channel_post`, `edited_channel_post`,
  `callback_query`, `my_chat_member` (bot added/removed), and `message.web_app_data`
  (Mini App `sendData` payloads).
- Sending/acting: `sendMessage` (`chat_id`, `text`, `reply_to_message_id`,
  `reply_markup`, `parse_mode`) — posts replies into watched groups/channels and DMs the
  user from the bot; `editMessageText` / `editMessageReplyMarkup` (live status in the bot
  chat); `answerCallbackQuery` (always answer button presses); `sendChatAction`
  (`typing` while STT/AI runs); `setMyCommands` (bot menu: /pair, /watchlist, /brief,
  /tone); `setChatMenuButton` (attach the Mini App to the bot's menu button); `getMe`
  (sanity check at backend boot).
- Group/channel realities: in groups the bot only sees commands/mentions/replies unless
  **privacy mode is disabled in BotFather** or the bot is a group admin; the bot receives
  `channel_post` updates only for channels where it is an **admin**. Rate limits
  (~30 msg/s overall, ~1 msg/s per chat) → batch digests, never spam.
- Mini App identity (pairing): the companion reads `Telegram.WebApp.initData` and posts
  the **raw string** to our backend. Validation (official algorithm): drop the `hash`
  field, sort remaining fields alphabetically as `key=value` joined by `\n`
  (data-check-string), secret key = HMAC-SHA-256 with key `"WebAppData"` over the bot
  token, then HMAC-SHA-256 of the data-check-string with that secret, hex-compare to
  `hash` (constant-time), and reject stale `auth_date`. Never trust `initDataUnsafe`.
  Result: a verified Telegram user id → the backend issues a short-lived pairing code;
  the user types the code into the glasses plugin; the plugin stores the link via
  `setLocalStorage`. This satisfies the SDK's "no Google sign-in in the WebView — use a
  pairing code" constraint.

---

## Day-by-day plan (all times Dubai; build starts Mon Nov 23, 12:00)

### Mon Nov 23 — Scaffold + pairing end-to-end
- From the official minimal template: repo scaffold, `evenhub init` → `app.json`
  (`package_id` e.g. `com.pedieth.paperplane`, network whitelist = backend host).
- "Hello lens" screen + one gesture verified in the simulator (on this VM under Xvfb,
  driven via its automation API) — the hackathon's own step 4 — before anything else.
- Backend skeleton (Node): HTTPS webhook endpoint, `setWebhook` registration, `getMe`
  boot check, health route. Bot created by pk via BotFather (see needs list).
- Pairing flow v1: Mini App stub page validates `initData` → backend issues code →
  plugin pairing screen (text container + code entry via list selection) → linked state
  persisted (`setLocalStorage` + backend record). Demo beat 1 works by end of day.

### Tue Nov 24 — Bot bridge + priority inbox (read path)
- Ingestion: webhook handlers for `message` / `channel_post` in watched chats;
  watchlist store (chat id, kind, priority); message store with sender, text, time, link.
- Plugin inbox API on the backend (per paired user: watched chats only, newest first).
- Plugin screens: inbox as a `ListContainerProperty` (≤ 20 items, "Chat — first words"),
  message card as a full-screen `TextContainerProperty` (~450 chars max, sender + time
  header), contextual menu (`menuObject`: Reply by voice / Smart replies / Mark done).
- Refresh on `FOREGROUND_ENTER_EVENT` + manual refresh item; honest empty states.

### Wed Nov 25 — Smart replies + AI draft (write path)
- Smart replies: backend generates 3 short contextual replies (LLM) per message; shown
  as a list; one selection → backend `sendMessage` with `reply_to_message_id` → card
  confirms "Sent". This is the write path working end-to-end before voice.
- AI draft: "Draft for me" menu item → backend drafts in the user's tone (from Mini App
  setting) → draft card → Approve (send) / Redraft / Discard. `sendChatAction: typing`
  in the source chat while generating.
- Safety: nothing is ever sent without an explicit on-lens approval action.

### Thu Nov 26 — Voice reply flow
- Long-press on the message card (`LONG_PRESS_EVENT` … `LONG_PRESS_RELEASE_EVENT` on the
  capture container, source glasses R/L or ring) → `audioControl(true, Glasses)` →
  stream `audioPcm` frames to the backend → STT → transcript card → Approve / Retry /
  Discard → `sendMessage`. Phone-mic fallback (`AudioInputSource.Phone`) behind a menu
  item if glasses audio misbehaves.
- STT: OpenAI Whisper API (chosen approach — strong FA + EN; see declaration). Test
  matrix: short EN reply, short FA reply, mixed FA/EN with names and handles; measure
  latency end-to-end; cap recording at ~15 s per reply.
- The transcript always appears on the lens before sending — STT errors are correctable,
  never silently sent.

### Fri Nov 27 — Channel Brief + Mini App companion
- Channel Brief: backend collects `channel_post`s from watched channels; on demand
  (menu item / bot `/brief`) an LLM summarizes the new posts into one brief (≤ ~450
  chars, grouped by channel, counts + highlights); plugin shows it as a brief card.
  Demo data: a busy listing channel becomes one card.
- Mini App companion v1 (inside Telegram): pairing screen (shows code, link status),
  watchlist manager (toggle chats/channels the bot is in), reply-tone setting
  (short / neutral / formal), quiet rules (priority-only toggle). All writes go through
  the `initData`-validated backend session.

### Sat Nov 28 — Hardening, packaging, full rehearsal
- Foreground/exit edge cases: rebuild-on-enter, stale inbox refresh, webhook retry
  safety (idempotent by `update_id`), backend downtime message on the lens.
- Readability pass on the 576×288 canvas: brightness levels for hierarchy, card text
  trimmed to limits, list labels ≤ 64 chars — checked with `validateEvenHubPageContainer`
  before every create/rebuild during development.
- `evenhub pack app.json dist -o paperplane.ehpk` (optional submission artifact);
  `evenhub qr` sideload test only if a real G2 is reachable (not required).
- Full simulator run-through of all five demo beats; fix list burned down.

### Sun Nov 29 — Video, README, submission (deadline 23:59 Dubai)
- Demo video (≤ 3 min) recorded from the simulator on this VM (ffmpeg x11grab of the
  Xvfb display), following the script below; captions burned in (the lens has no
  speaker; judges watch muted).
- README finalized (setup, architecture, safety notes, pre-existing-assets declaration).
- DoraHacks submission: public GitHub repo link, video, short description, Track 1.
- Submit by early evening Dubai time; keep the rest as buffer. No new features today.

## Demo video script (≤ 3 min, simulator)
1. **0:00–0:25 — Pairing.** Mini App in Telegram shows a pairing code (initData-verified);
   the code is entered on the glasses; lens shows "Linked as @PediETH".
2. **0:25–0:55 — Priority inbox.** A message lands in a watched group; PaperPlane opens to
   a clean inbox card — sender, one message, nothing else.
3. **0:55–1:40 — Voice reply.** Long-press, speak a reply; transcript appears on the lens;
   one tap sends it; cut to Telegram showing the reply in the group.
4. **1:40–2:10 — Smart reply / AI draft.** A second message answered with one tap from
   three AI-suggested replies (for when you can't talk).
5. **2:10–2:45 — Channel Brief.** A channel with 20+ new posts becomes one summarized
   brief card on the lens.
6. **2:45–3:00 — Close.** "Telegram, native on your glasses. No PC. No mirroring."
   + repo link.

## Needs from pk during build week
1. **BotFather bot** (Nov 23): create the bot (working username `PaperPlaneBot` —
   availability to confirm; fallback names ready), then hand the token over through the
   secure channel (never plain chat). In BotFather also: **disable privacy mode**
   (`/setprivacy` → Disable) so the bot can read watched groups, and set the bot's menu
   button to the Mini App once its URL exists.
2. **Demo chats**: add the bot as **admin** to the demo channel (needed for
   `channel_post`) and to the demo group; pick the real channels/groups used in the demo
   (e.g. one busy listing channel + one group he controls).
3. **Backend hosting decision** (before Nov 23): the webhook/API needs a public HTTPS
   host for the whole week. Options: his Cloudflare account (Worker) — preferred, already
   his stack; a small VPS; a tunnel is demo-only fragile. Decision needed so `app.json`'s
   whitelist and the webhook URL are fixed on day 1.
4. **API keys, server-side only**: an OpenAI key (Whisper STT + draft/summary LLM) or an
   alternative he prefers — pasted into the backend's secret store, never into the repo
   or the plugin package.
5. **Voice lines for the demo** — DONE 2026-11-20, pk records nothing.
   English-only lines synthesized by Muse; WAV files (16 kHz mono, for the
   virtual mic) + script in `demo-voice-lines.md` and `demo-voice/`
   (`take-1-main` is the video take; takes 2–3 are backups). Playback is
   `paplay -d virmic <file.wav>` in sync with the long-press (see
   `toolchain/simulator-vm.md`). Still to confirm Thu Nov 26: end-to-end
   `audioEvent` delivery to plugin code.
6. **Even Realities account** (only if we ship the optional `.ehpk` via the portal):
   `evenhub login` is interactive and tied to his account.
7. **GitHub**: the entry needs a public repo under his account (created during the
   window); he approves the repo creation/push prompts as they come.

## Risks and mitigations
- **Foreground-only platform.** No push, no background alerts, no access to phone
  notifications. Mitigation: design says so honestly — the bot's Telegram chat is the
  alert surface; the plugin refreshes on `FOREGROUND_ENTER_EVENT` and is the
  glance-and-act layer while open. Never promise "alerts on the lens".
- **Simulator vs real device gaps.** Simulator mic is a virtual PulseAudio source fed
  from audio files (no live mic, no 4-mic array, no `direction`/`speakerRole`
  behavior; end-to-end `audioEvent` delivery to plugin code still to be confirmed with
  the real plugin during build week), emulates gestures with mouse/keys (no real ring),
  and skips BLE latency and the ~800 ms full-screen refresh. Mitigation: stay well inside
  documented container limits, avoid rapid full-page rebuilds (prefer
  `textContainerUpgrade`), keep interactions to documented gestures only, and treat the
  simulator run as a functional — not hardware — verification.
- **STT quality (Persian / English / mixed).** Whisper is strong in both languages but
  short utterances, code-switching, and names/handles are weak spots. Mitigation:
  transcript is always shown and must be approved before sending; smart replies and AI
  draft are full fallbacks when voice fails; demo takes are scripted and clean.
- **Bot API visibility limits.** Privacy mode and admin requirements decide what the bot
  can see; a misconfigured demo chat silently yields an empty inbox. Mitigation: day-1
  checklist verifies one real message and one real channel post end-to-end.
- **Pre-1.0 SDK (0.0.16).** APIs may shift between versions. Mitigation: pin the exact
  verified versions in `package.json`; don't upgrade mid-week.
- **Scope creep.** MTProto personal-DM reading is explicitly **out of v1** (roadmap
  only). The bot-bridge scope (groups + channels + bot chat) is what ships.
- **Solo timeline.** Seven days, five demo beats. The day plan front-loads the write
  path (Wed) so the judging-heavy "read AND write" criterion is safe even if Fri slips.

## Draft README declaration — pre-existing assets (written before Nov 23)
> Declared per the hackathon rules ("state in your README what existed before Nov 23"):
> - Concept, UX design, and research for PaperPlane were prepared before the build
>   window (dated 2026-11-19) — planning documents only; **no PaperPlane application
>   code existed before Nov 23, 12:00 Dubai time**. All application code in this repo
>   was written during Nov 23–29, 2026.
> - Libraries/platforms used (not written by us): `@evenrealities/even_hub_sdk` 0.0.16,
>   `@evenrealities/evenhub-cli` 0.2.0, `@evenrealities/evenhub-simulator` 0.9.5
>   (Even Realities, MIT — versions verified on 2026-11-19); the Telegram Bot API and
>   Telegram Mini Apps platform (Telegram); OpenAI Whisper API for speech-to-text and
>   an OpenAI LLM for reply drafts and channel summaries (server-side only); Node.js.
> - The developer's earlier unrelated projects (Folio, Telegram sticker packs) share no
>   code with this entry.

## Amendment (2026-11-19, pk's instructions)
- Demo voice lines: ENGLISH ONLY, generated by Muse with TTS during build week and played into the virtual mic. pk records nothing.
- Nothing public-facing may mention Persian/Iranian origin anywhere (pk's standing rule).

## Amendment (2026-11-20, bot created early at pk's instruction)
- The PaperPlane bot already exists — created 2026-11-20 via BotFather from pk's own Telegram account by Muse, at pk's explicit request. Display name "PaperPlane", username **@PaperPlaneG2Bot** (PaperPlaneBot was taken). Privacy mode is DISABLED. The bot is already admin in the "PaperPlane Demo" group (now a supergroup) and in the @PaperPlaneDemo channel. The token sits only in pk's BotFather chat; in build week it goes into the backend secret store via the secure channel, never into the repo. Needs-list items 1 and 2 are therefore DONE; the bot is an infrastructure registration (no application code), and the README declaration should list it as created 2026-11-20, before the build window, alongside the other pre-existing assets.

## Amendment 2026-11-20 (STT route decided)
Pk pointed to HeyGen for "voice". Clarified: HeyGen covers the OUTPUT side (text to speech - the demo voice lines, already final). The voice-reply flow also needs the INPUT side (the wearer's speech to text) which HeyGen does not provide for this use. Decision: run Whisper locally on the Muse VM (whisper.cpp / faster-whisper, small model, CPU) - fully free, no key, no cost. Verify during build week, Thu Nov 26 voice day at the latest, with the final HeyGen takes played into the virtual mic. Fallback if local accuracy/latency fails: revisit then.

## Amendment 2026-11-20 (hosting: Cloudflare token route abandoned)
Pk abandoned the Cloudflare API-token flow mid-way (it blocked on him) and ordered that such steps never be put on him again. Hosting must be solved with zero pk steps: (1) first verify the connected Vercel connector and deploy the backend as serverless functions; (2) fallback: retest localtunnel from the VM (worked 2026-11-16 for Unboxly); (3) only if both fail, reassess before Day 1 - do not go back to pk for dashboard work.

## Amendment 2026-11-21 — backend host route PROVEN
- Pk created a Cloudflare user API token himself from the Edit Cloudflare Workers template (his own retry on 2026-11-21, after the 2026-11-20 dashboard block) and stored it through the secure connector flow. Connector: custom.cloudflare (see ~/workspace/custom-connectors/custom.cloudflare/CONNECTOR.md). The token value never lives in files or chat.
- Verified the same day via the connector helper: token status active; a minimal probe Worker was deployed by API, served HTTP 200 on its workers.dev URL, and was deleted immediately after. The agent-side deploy route for the PaperPlane backend is therefore PROVEN before build week.
- Public URL must stay neutral (pk privacy rule): the account workers.dev subdomain contains his account name, so the real backend goes on a Pages project domain or a custom domain during build week, never on the account workers.dev subdomain.
- STT note: with the backend on a Worker, the local-Whisper-on-VM plan needs a build-week reassessment (a Worker cannot reach the VM). First candidate to test in build week is Workers AI Whisper on the free tier; local Whisper stays the fallback if the backend ends up VM-hosted instead.
