# PaperPlane — Day 3 notes (Wed Nov 25 build day, executed Nov 24 ~05:20-05:35 UTC)

Status: **the write path is built and proven live.** A smart reply
picked on the lens was sent through the plugin, the backend outbox and
the bridge, and landed in the real demo group threaded to the original
message (Bot API proof below). Voice stays a stub (Day 4), Brief stays
a stub (Day 5). No blockers.

## What was built

### Reply path — plugin → API → bridge → Telegram, threaded
- **`ppbot.py` gained a `reply` command**: `reply CHAT_ID TEXT
  REPLY_TO_ID` sends with `reply_parameters: {message_id: ...}`, so the
  answer attaches to the original message in the original chat.
- **Bridge outbox drain is now threading-aware** (`bridge/bridge.mjs`):
  an outbox item carrying `replyToMessageId` goes out via `ppbot.py
  reply`; plain items still send unthreaded. The drain logs Telegram's
  sendMessage result — sent message id plus the threaded-to id read
  back from `reply_to_message` — and logs failures instead of assuming
  success. No Worker change was needed: `/api/reply` has accepted
  `replyToMessageId` since Day 1.
- **Plugin** (`app/public/app.js`, app version 0.3.0): the card menu's
  Reply item now opens the replies screen (below), and a plain tap on
  the card opens it too — the tap is the simulator-drivable path, since
  menu clicks still cannot be driven (Day 2 quirk 4). After a send the
  plugin returns to the card and the footer confirms: "Reply sent:
  <text>".

### Smart replies — local, no external AI
- New **replies screen**: header naming the sender and the message
  being answered, a list of three suggestions, footer instructions.
  Its list gets its own container id (6) per the Day 2 id-reuse quirk.
- `smartRepliesFor(message)` generates the three suggestions **locally
  on the glasses** from the message text alone — heuristics keyed to
  the message shape, first match wins:
  - contains "?" → answer-shaped ("Good question - let me check and
    reply properly." / "Yes, that works for me." / "Not sure yet - I
    will confirm soon.")
  - thanks → gracious ("You are welcome!" / "Anytime - happy to
    help." / "Glad it helped.")
  - greeting → greetings back
  - announcement words (launch, live, update, release, new) →
    reactions ("Great news - congrats to the team!" / ...)
  - test/check words → feed confirmations ("Got it - the feed is
    coming through." / ...)
  - fallback → safe acknowledgements ("Got it - thanks!" / "Sounds
    good." / "On it.")
- Tapping a suggestion calls `POST /api/reply` with the chat id, the
  text and `replyToMessageId` set to the open message — the same
  threaded path as above. Generator behaviour was unit-checked
  standalone against seven sample messages (all categories sensible).

### Channel sender fix
- Root cause: channel posts carry no personal author — the old bridge
  read only `message.from`, which is absent/name-less for channel
  posts, so `senderName` arrived empty.
- **Bridge `forwardMessage`** now resolves the sender in order:
  `sender_chat.title` (the channel itself) → the `from` name → for
  channels, the chat title. New channel posts therefore carry the
  channel title as their sender.
- The plugin already fell back to the chat title when `senderName` is
  empty (card header line and inbox line), so even pre-fix stored
  posts now display the channel title on the lens.

## Verified live (evidence in `app/sim-evidence/`)
- `day-03-pair.png`, `day-03-inbox.png` — re-paired in-session (code
  registered through the bridge ingest endpoint, digits driven through
  the automation API, "linked as user 1001"), inbox showing both real
  chats; the channel line already shows the channel title as sender.
- `day-03-card.png` — the real group message on the card ("PediETH -
  05:15 lens feed test — checking the bridge"), new footer "tap to
  reply, scroll for more."
- `day-03-replies.png` — the compose screen: "To PediETH: lens feed
  test — checking the bridge" with the three generated suggestions
  ("Got it - the feed is coming through." / "Seen - looks good from
  here." / "Received, loud and clear.").
- **The live send**: tapping suggestion 1 queued the reply; the bridge
  log records `sent queued reply out-1 to chat -1004394859390 as
  message 3 threaded to 2` — Telegram's own sendMessage response,
  i.e. the reply exists in the PaperPlane Demo group attached to
  PediETH's original message 2. `day-03-reply-sent.png` shows the
  card afterwards with the footer "Reply sent: Got it - the feed is
  coming through."
- **Independent threading check**: a direct `ppbot.py reply` targeting
  message 3 succeeded as message 4 threaded to 3 — replying to a
  message id only works if that message exists in the chat, so the
  chain 2 → 3 → 4 is proven end to end through the Bot API.
- `day-03-channel-card.png` — the channel card now reads "PaperPlane
  Demo - 05:19 live check — the lens is listening" (channel title as
  sender, no blank).

## Click-verified vs code-verified (honest split)
- **Click-verified in the simulator** (automation API + x11grab
  frames): pairing, inbox, group card, card tap → replies screen,
  suggestion tap → send + on-lens confirmation, channel card sender
  display, double-tap navigation.
- **Code-verified, not simulator-clicked**: the card menu's Reply item
  calls the same `showReplies()` the tap drives, but menu item clicks
  still cannot be driven in this simulator build (Day 2 quirk 4 — the
  `context_menu` input arrives as FOREGROUND_ENTER). Voice and Brief
  menu items remain honest stubs, also code-complete only.
- **Function-verified, not live-post-verified**: the bridge sender
  resolution was executed against faithful payloads (the real
  `forwardMessage` source, extracted and run with a stubbed API):
  channel post with `sender_chat` → "PaperPlane Demo"; channel post
  with neither → chat title; group message → the person's name. A
  fully live check needs a channel post NOT sent by the bot itself —
  Telegram never echoes a bot's own sends back through getUpdates
  (observed twice today: the bot's group reply and a bot channel post
  both never re-arrived as updates), so the bot cannot manufacture
  the test post. The next channel post by pk confirms it in normal
  use; the plugin-side fallback already covers display meanwhile.

## Quirks and notes for later days
- **A bot's own sends never come back as updates.** The inbox will not
  show the user's lens-sent replies as new items (they were sent by
  the bot account). Expected, not a bug; the demo narrative should
  say replies land in the chat, not that they echo into the inbox.
- The bridge was restarted once today to pick up the Day 3 code (new
  pid, boot clean, watchlist re-registered). One transient Telegram
  egress disconnect appeared during the restart window and recovered
  on its own — same pattern as Day 2.
- `paperplane.ehpk` restamped at version 0.3.0 (59,976 bytes):
  `evenhub pack app.json public -o paperplane.ehpk`.

## State left running
- Bridge (`node bridge/bridge.mjs`, Day 3 code, log /tmp/pp-bridge.log)
  and the dev API on :8787 are LEFT RUNNING. Simulator and plugin
  server were stopped; restart commands are in day-01-notes.md.

## What Day 4 needs
- **STT decision — settle before Thu Nov 26 (voice day).** Candidates:
  (a) **Local Whisper on this VM** (faster-whisper / whisper.cpp,
  small model, CPU): fully free, no key, no network dependency; cost
  is latency on this shared VM and one more moving part next to the
  bridge — but the bridge already lives here, and the plugin's audio
  reaches the backend as PCM, so the VM is the natural place to
  transcribe. (b) **Workers AI Whisper**: keeps transcription in the
  Cloudflare layer, but the current Cloudflare token's template
  permissions for Workers AI are untested, and it adds a network hop
  plus a second platform dependency for a 3-minute demo. Working
  recommendation: **local Whisper on the VM**, Workers AI only if the
  local model's latency measures badly. Decide first thing Thu.
- Voice flow shape (from the build plan): long-press or Voice menu →
  mic via `bridge.audioControl`, PCM frames arrive as
  `event.audioEvent.audioPcm` (16 kHz) → transcript shows on the lens
  → user approves → send through today's threaded reply path.
  End-to-end PCM delivery to real plugin code is still unproven —
  it is the first thing to test on Day 4, before building the flow
  around it.
- Menu clicks remain undrivable in the simulator; Day 4's voice entry
  should also hang off a gesture (long-press already shows the voice
  stub line on the card) so the flow stays simulator-provable.
- Day 5 (Fri): Brief (channel digest) + Mini App settings surface;
  Day 6 (Sat): hardening + full rehearsal; Day 7 (Sun): demo video
  and submission before 23:29 Tehran.
