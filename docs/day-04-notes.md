# PaperPlane — Day 4 notes (Thu Nov 26 build day, executed Nov 24 ~05:28-05:36 UTC)

Status: **both jobs done.** The replies-screen layout bug is fixed and
re-verified live, and voice replies work end to end: the simulator's
PCM path is PROVEN (numbers below), local Whisper transcribed a spoken
reply word-perfectly, the transcript was approved on the lens, and the
reply landed in the real demo group threaded to the original message
(Bot API proof below). No blockers.

## Job 1 — replies screen layout fix

Root cause, measured from `day-03-replies.png`: list rows are a fixed
40 px each starting at the list container's y. The Day 3 layout put the
list at y=112, so the third row's box ran 192-232 — straight into the
footer box at y=228 — and its text struck through the footer line.

Fix (`app/public/app.js`, `showReplies` + `smartRepliesFor`):
- The screen is now budgeted: title 16-56, header at y=58 with height
  30, list at y=94 with height 124 (rows 94-134, 134-174, 174-214),
  footer at 228. The third row now ends 14 px above the footer.
- The header line ("To <sender>: <text>") is truncated to 46 chars so
  it can never wrap into a second line and push into the list.
- Suggestions are capped at 44 chars (`capLine`, word-boundary cut) at
  generation time — one line per row guaranteed for any message, and
  the capped text is exactly what a tap sends. The longest built-in
  suggestion was also shortened ("Good question - let me check and
  reply.", 40 chars). The SDK has no item-height or font-size knob
  (checked the type definitions), so layout plus caps is the whole fix.

Verified live (evidence in `app/sim-evidence/`):
- `day-04-replies-fixed.png` — a planted question message ("Quick
  question - can everyone check the new build before the demo
  tomorrow?", group message 5, ingested with its real id) produces the
  longest suggestion set; all three lines sit in their rows with clear
  space above the footer. Pixel-band check: item 3 text ends at row
  204, its row box at 214, footer text starts at 234.
- **Send re-verified after the change**: tapping suggestion 1 queued
  the reply; bridge log: `sent queued reply out-2 to chat
  -1004394859390 as message 6 threaded to 5`.
  `day-04-reply-sent.png` shows the card footer confirmation.

## Job 2 — voice replies

### The PCM verdict: YES, frames reach plugin code (the Day 1-3 open question is closed)
- The HeyGen take 1 WAV (`demo-voice/heygen-take-1-main.wav`, 16 kHz
  mono, 3.84 s) was played into the PulseAudio `virmic` sink while the
  plugin recorded with `bridge.audioControl(true,
  AudioInputSource.Glasses)` (returned `true`).
- Run 1 (proof): **43 frames, 137,600 bytes, 3,200 bytes per chunk,
  ~4.3 s**. Run 2 (full flow): **53 frames, 169,600 bytes, ~5.3 s**.
- 3,200 bytes per chunk = 1,600 samples = exactly 100 ms at 16-bit,
  so the observed stream is **16 kHz, 16-bit, mono PCM**, matching the
  documented format. `audioPcm` arrives as a JSON number array; the
  plugin normalizes arrays, base64 strings and Uint8Arrays alike.
- Two honest wrinkles: a few trailing frames keep arriving for a
  moment after `audioControl(false)` (host-side close is async; they
  are logged and dropped), and the recording window includes the
  lead-in before playback starts, so captured seconds exceed the
  take's 3.84 s — Whisper handles the silence fine.

### STT: local Whisper next to the bridge
- New VM-side worker `backend/stt/stt-worker.py` (venv in the same
  folder, faster-whisper 1.2.1): claims transcription jobs through
  new bridge-only endpoints, transcribes with the **small** model on
  CPU (int8), posts the text back. No external keys, no paid APIs.
- Backend additions (`backend/worker/src/index.js`, API version
  0.4.0): `POST /api/voice/transcribe` (base64 PCM, ~1 MB cap),
  `GET /api/voice/result`, `GET /api/ingest/voice-jobs`
  (claim-on-read), `POST /api/ingest/voice-result`.
- **Bug found and fixed on the way**: faster-whisper's file decoding
  dies on this VM with `av.open() got an unexpected keyword argument
  'metadata_errors'` (a faster-whisper/PyAV version mismatch). The
  worker now feeds Whisper float32 samples converted from the raw PCM
  with numpy, so PyAV is never touched. First symptom was job voice-1
  stuck at "claimed"; the plugin's poll timed out and the lens showed
  "Transcription timed out - nothing was sent" — the failure path
  behaved as designed, nothing was sent on a guess.
- Speed: 5.3 s of audio transcribed in **6.6 s** on this shared CPU;
  the offline check on the clean take took 6.4 s.

### The voice flow on the lens
- Entry: **long-press on the message card** (menu Voice item calls the
  same `showVoice()`; menu clicks remain undrivable in the simulator,
  Day 2 quirk 4). New screen "voice" (app version 0.4.0):
  - idle: shows the message being answered, "Tap to record".
  - tap: the "Recording - speak now." state is shown BEFORE the mic
    opens, so no frame can land while a screen upgrade is in flight
    (the event handler drops events during screen changes).
  - tap again: mic closes, PCM uploads, "Transcribing...".
  - review: "You said: <transcript>" — **tap sends** through the same
    threaded `/api/reply` path as smart replies; long-press
    re-records; double-tap drops it. Nothing is ever sent without the
    review tap.
  - double-tap while recording cancels (mic closed, nothing queued).

### Live proof in the demo group (all today)
1. Incoming message planted as a real group post: "Can you send the
   channel brief before six?" — group **message 7** (sent by the bot
   via ppbot, ingested with its real id, the Day 2 seeding pattern).
2. On the lens: card -> long-press -> voice screen
   (`day-04-voice-recording.png`) -> record while the HeyGen take
   plays into virmic -> transcript screen
   (`day-04-voice-transcript.png`): **"You said: Yes, sending it
   before six. The summary is ready."** — word-perfect against the
   scripted line.
3. Tap to approve -> bridge log: `sent queued reply out-1 to chat
   -1004394859390 as message 8 threaded to 7`.
   `day-04-voice-sent.png` shows the card confirmation.
4. **Independent Bot API check**: `ppbot.py reply` aimed at message 8
   succeeded as message 9, and Telegram's own response reports
   message 8's text as "Yes, sending it before six. The summary is
   ready." — the voice reply exists in the group, threaded, verbatim.

## Click-verified vs code-verified (honest split)
- **Click-verified in the simulator**: replies layout + send (Job 1);
  card long-press -> voice screen; tap to record / stop; PCM frame
  counts in the plugin console; transcript review screen; tap to
  approve; on-lens send confirmation; the cancel and timeout states
  were both seen on the lens during the work.
- **Bot API-verified**: both sends (bridge log is Telegram's
  sendMessage response; the message 8 -> 9 chain check is independent).
- **Code-verified, not simulator-clicked**: the card menu's Voice item
  (same `showVoice()` the long-press drives; menu clicks undrivable,
  Day 2 quirk 4); long-press re-record from the review state; the
  Phone audio source (only Glasses was exercised — in the simulator
  both read the same PulseAudio default source).

## Environment and state notes
- The VM had no PulseAudio running this morning: daemon started and
  the `virmic` null sink recreated per `toolchain/simulator-vm.md`;
  default source is `virmic.monitor` again.
- Services were restarted once to pick up Day 4 code: dev API
  (v0.4.0), bridge (watchlist re-registered), plus the new STT worker.
  All three are LEFT RUNNING (STT log /tmp/pp-stt.log, model loaded).
  Simulator and plugin server were stopped after verification;
  restart commands are in day-01-notes.md.
- `paperplane.ehpk` restamped at version 0.4.0 (62,602 bytes).

## What Day 5 needs (Fri Nov 27)
- **Channel Brief**: the card menu's Brief item is still an honest
  stub. Shape from the build plan: a digest card summarizing new posts
  from watched channels since the last brief — the inbox store already
  carries channel posts with kind + timestamps, so the brief is a
  backend aggregation (`GET /api/brief`) plus one plugin screen; keep
  it glanceable (channel name, post count, top lines) and hang entry
  off a gesture as well as the menu, since menu clicks stay
  undrivable in the simulator.
- **Mini App settings surface**: pairing already works by bot code, so
  the Mini App's v1 job is settings only — watchlist management and
  reply tone — served as a static page talking to the same API. It
  needs a neutral public host for the plugin whitelist and the Mini
  App URL (the Pages host in app.json is still unprovisioned), and
  per-user watchlist scoping is still demo-simple (single user 1001)
  until it lands.
- Day 6 (Sat): hardening + full simulator rehearsal of all five
  beats; Day 7 (Sun): demo video and DoraHacks submission before
  23:29 Tehran.
