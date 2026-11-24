# PaperPlane — Day 6 notes (Sat Nov 28 build day, executed Nov 24 ~05:56-06:09 UTC)

Status: **all five items done.** Pages deployment retried once and
failed the same way (recorded, not forced); the repo is prepped and
committed locally; the hardening gaps found in the plugin are fixed
and two of the new states were proven live on the lens; the full
five-beat rehearsal ran end to end in the simulator with real
Telegram traffic, and the package is restamped at v0.6.0. Nothing is
blocked; what remains is the Sun Nov 29 list at the bottom.

## 1. Pages deploy retry — same failure, stopped

One genuine retry of the Day 5 direct-upload flow
(/tmp/cf-pages-deploy.py, the connector helper's machinery):
upload-token issued, check-missing returned all 3 plugin files
missing, then `POST /pages/assets/upload` returned **HTTP 500,
"error code: 1101"** again — identical to Day 5. Per instructions
this was not forced further. The project **paperplane** and its real
subdomain **paperplane-4kt.pages.dev** exist and the name is held;
the manifest already whitelists that host. Verdict: the upload
endpoint is failing on Cloudflare's side for this account right now;
the local dev host (127.0.0.1:8787) stays the demo path, and the root
README says so plainly.

## 2. Public repo prep — done locally (no GitHub step taken)

`~/workspace/even-realities` is now a git repo (branch main) with a
clean first commit (84 files):

- Root `README.md` written for the submission: one-line pitch, the
  five features, the architecture (plugin + Worker API + VM bridge +
  local Whisper) with the why-the-bridge-exists section (token lives
  in a secure surrogate only this VM can use, so no Telegram call and
  no initData HMAC can run in a public Worker — the one-time code
  exchange is the answer), setup steps, the simulator demo path, the
  hosting note above, and the full pre-existing-assets declaration
  (SDK 0.0.16 / CLI 0.2.0 / simulator 0.9.5, @PaperPlaneG2Bot created
  2026-11-20, HeyGen demo voice takes recorded 2026-11-20, Whisper
  small via faster-whisper; all application code written Nov 23-29).
- Layout: `app/`, `backend/`, `demo-voice/`, `concept.md`,
  `toolchain/` at root; process documents (build plan, research,
  day notes) moved under `docs/`.
- Hygiene: a secret-pattern scan over the tree found nothing. The
  bridge secret is env-supplied with a labelled dev placeholder
  default, identical in bridge and dev server, so the local demo
  works out of the box and no real credential exists in the tree.
  `.gitignore` excludes `node_modules/`, the STT `venv/`,
  `__pycache__`, logs, `.env`, and the bridge runtime state
  (`state.json` — just an update offset — and `watched-chats.json`);
  a `watched-chats.example.json` carrying only the public demo
  channel documents the shape. Verified after staging: none of the
  excluded paths are in the commit.

## 3. Hardening pass — two gaps found and fixed, all states checked

Audit of `app/public/app.js` against the five required states:

- **Backend unreachable** — already friendly everywhere (pairing
  footer, inbox header + list line, brief page, reply-send footer,
  voice-upload line). The brief line gained "Try again in a moment."
- **Empty inbox** — "No watched chats yet", per-chat "no messages
  yet", card-level "No messages in this chat yet." — all present.
- **Empty brief** — "All caught up." page, present since Day 5.
- **STT timeout** — "Transcription timed out - nothing was sent.",
  present since Day 4.
- **Expired pairing code — was a gap.** The backend distinguishes
  `expired-code` (410) from `unknown-code` (404), but the plugin
  showed one generic rejection for both. Fixed: the footer now reads
  "That code has expired. Send /pair to the bot for a fresh one."
  for expired codes, and "That code did not work. Check the digits,
  or send /pair for a new one." for unknown ones.
- **Card load failure — was a second gap.** A failed message fetch
  fell through to "No messages in this chat yet.", which is wrong
  when the backend is down. Fixed with a load-failed flag: the card
  now shows "Messages could not load. The backend may be down - try
  again in a moment."

Plugin restamped: `app.json` version 0.6.0, `paperplane.ehpk`
repacked (64,739 bytes).

## 4. Full rehearsal — five beats plus two hardening states

Environment repairs first (the VM had been rebuilt again): the
PulseAudio daemon package was missing entirely (only the utils
survived), which the voice beat needs for the virtual mic. apt could
not install it (stale lists), so the Day 5 resolver route was
extended to the noble universe indexes and the 13-package closure
was downloaded with SHA256 matching and installed with dpkg.
PulseAudio now runs with the virmic null sink as default source;
the simulator was relaunched with the matching runtime dir.
Simulator libs re-checked: `ldd` reports 0 missing.

The run (evidence in `app/sim-evidence/day-06-*.png`):

1. **Pair** — planted code entered by scroll+tap; "linked as user
   1001" (`day-06-pair.png`, `day-06-home.png`).
2. **Inbox** — one fresh bot post planted in each demo chat and
   ingested with its real Telegram id (group message 11, channel
   post 9, the established pattern — the Bot API never echoes the
   bot's own sends); inbox showed "2 unread in 2 watched chats"
   (`day-06-inbox.png`).
3. **Card + smart reply** — the real group message opened full-text
   ("1 of 2", marked read), replies screen in casual tone, first
   suggestion tapped; bridge log confirms the send as group message
   12 threaded to 11 (`day-06-card.png`, `day-06-replies.png`,
   `day-06-reply-sent.png`).
4. **Voice reply** — long-press to the voice screen, HeyGen take 1
   played into the virtual mic: 43 PCM frames, 137,600 bytes, 4.3 s
   (identical shape to Day 4). Local Whisper returned "Yes, sending
   it before six. The summary is ready." — word-perfect — shown on
   the review screen; approval tap sent it as group message 13
   threaded to 11 (`day-06-voice-ready.png`,
   `day-06-voice-transcript.png`, `day-06-voice-sent.png`).
5. **Brief** — long-press on home: "1 new in 1 channel" with the
   fresh rehearsal post (`day-06-brief.png`).
6. **Expired code (hardening proof)** — a code planted at 05:57 UTC
   was entered after its 10-minute TTL: the API returned
   `expired-code` and the lens footer showed the new line
   (`day-06-expired-code.png`).
7. **Backend down (hardening proof)** — re-paired, then the dev API
   was stopped and the inbox opened: "Inbox unavailable / Backend
   unreachable - try Refresh", no raw error (`day-06-backend-down.png`).

Menu clicks remain undrivable in this simulator build (Day 2 quirk),
so menu entries were again exercised through the drivable gesture
paths that call the same functions — same honest split as Days 2-5.
After the rehearsal the dev API and bridge were restarted clean
(watchlist re-registered, 2 chats); the STT worker ran throughout.
As after every API restart, the in-memory inbox starts empty; the
bridge refills it from the next real message.

## 5. Repo readiness checklist — what remains for Sun Nov 29

Deadline: **Sun Nov 29, 23:29 Tehran** (23:59 Dubai).

- [x] Code complete: all five features working and rehearsed.
- [x] Root README with declaration, architecture, setup.
- [x] Local git repo with a clean first commit (plus this notes
      commit).
- [ ] **GitHub repo creation and push** — handled separately
      (pk-side approval); the local repo is ready to push as-is.
- [ ] **Demo video** (≤ 3 min, the five beats; HeyGen narration
      takes already recorded; record from the simulator with
      x11grab, captions burned in).
- [ ] **DoraHacks submission form** — Track 1, short description,
      repo link, video link. Submit with hours of buffer.

Risks to the deadline, honestly:

- The GitHub push depends on an approval outside this build; if it
  slips, everything else (video, form text) can still be finished
  so only the link is missing. Lowest-risk order for Sunday: push
  first, then video, then the form.
- The Pages upload failure (1101) is out of our hands; it does not
  block the submission — the demo video is recorded against the
  local host, which the README documents.
- The VM has been rebuilt under us three times this week; the
  recovery routes are now all written down (WebKit libs and
  PulseAudio via the /tmp/simlibs resolver, services via the day
  notes). A Sunday rebuild costs roughly half an hour, not the day.
- The simulator-only caveats stand: no real G2 was available, menu
  clicks are undrivable in the simulator build, and pairing storage
  does not survive a simulator restart. All three are documented in
  the README's scope section rather than hidden.
