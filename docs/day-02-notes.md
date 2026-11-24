# PaperPlane — Day 2 notes (Tue Nov 24 build day, executed Nov 24 ~05:00-05:20 UTC)

Status: **the read path is built and verified in the simulator end to
end** — pairing screen, inbox list, message card, read marking. The one
piece not proven with a live Telegram post is the Telegram → bridge leg,
blocked by two small account-side facts (bot post rights in the channel,
the demo group's numeric id). Both unblocks are one action each for pk
and are listed at the bottom. The bridge is still running and armed, so
the first real post completes the proof the moment it lands.

## What was built

### Plugin — `app/public/app.js` (rewritten as a screen state machine)
- Screens: home (Day 1 startup page, kept) → pair → inbox → card, one
  page at a time via `rebuildPageContainer`, with a single event
  subscription routing by screen. Container ids are stable across
  screens (title 1, main 2, foot 3, lists 4 and 5 — see quirks).
- **Pairing screen**: a digit list (0-9) is the code entry — scroll to a
  digit, tap to enter it; progress shows as `Code: 4 8 3 - - -`. At six
  digits the plugin calls `POST /api/pairing/validate` with a device id
  (generated once, stored), and on success persists
  `{ userId, linkedAt }` via `setLocalStorage` under `paperplane-link`
  and returns home showing "Linked. Tap to open your inbox." A rejected
  code clears the entry and says so on the lens.
- **Inbox list screen**: header line with total unread, then one
  `ListContainerProperty` line per watched chat — chat title, unread
  count, latest sender and text (60 chars max, plain slice). Data from
  `GET /api/inbox/summary`. Refreshes on foreground-enter and from the
  menu.
- **Message card screen**: chat title, then sender + time + full text
  (truncated to 440 chars), footer with position ("1 of 1 - scroll for
  older or newer."). Scroll up/down cycles the chat's messages,
  double-tap returns to the inbox. Opening a card posts
  `POST /api/inbox/read`, and the summary's unread count drops
  accordingly (verified: 1 → 0). The card menu carries **Reply / Voice /
  Brief** plus Back to inbox; the three actions answer with an honest
  stub line today — Day 3 wires them.
- API base is `http://127.0.0.1:8787` for the dev path, overridable with
  an `?api=` query param; `app.json` now whitelists both the Pages host
  and the local dev host. App version bumped to 0.2.0;
  `paperplane.ehpk` restamped (58,621 bytes).

### Backend — `backend/worker/src/index.js` (v0.2.0)
- New: watchlist store, `POST /api/ingest/watchlist`,
  `GET /api/inbox/summary` (per-chat unread + latest, chats with
  messages first), `GET /api/inbox?chatId=` filter for the card screen,
  `POST /api/inbox/read` (per-user high-water read markers), `kind`
  (group/channel) carried on ingested messages.
- **CORS**: all responses now carry permissive CORS headers and OPTIONS
  is answered — the plugin is a cross-origin WebView page, so without
  this the lens could never read the API. `dev-server.mjs` now forwards
  all response headers (it previously forwarded only content-type,
  which would have silently dropped them).

### Bridge — `backend/bridge/bridge.mjs`
- Watchlist config moved to `bridge/watched-chats.json` (`chats` +
  `learnTitles`). On boot the bridge resolves configured ids through
  `getChat`, registers the watchlist with the API, and forwards watched
  messages with their chat kind.
- **Auto-learn**: a group/channel whose title matches `learnTitles`
  ("PaperPlane Demo") is learned from its first forwarded activity —
  numeric id persisted into the config, watchlist re-registered. This
  exists because the Bot API cannot resolve a private supergroup's id
  from an invite link (see blockers).
- `ppbot.py` gained `chat` (getChat) and `member` (getChatMember)
  commands, and now prints Telegram's own error body on API errors
  (the request URL, which carries the credential surrogate, is never
  printed).

## Verified live (simulator, evidence in `app/sim-evidence/`)
- `day-02-pair.png` — pairing screen: "Link PaperPlane", code progress,
  digit list with 0 selected.
- Full code entry driven through the automation API: six digits picked
  by scroll + tap (indices 4, 8, 3, 9, 2, and an index-less event for 0),
  console trail "pair: digit entered, length 1..6" →
  "pair: linked as user 1001". The code was registered through the same
  ingest endpoint the bridge uses after a real `/pair` (that issuance
  side was verified against the live bot on Day 1); the lens-side
  entry + validation + storage is what today proves. The test identity
  is userId 1001.
- `day-02-home-linked.png` — home after linking.
- `day-02-inbox.png` — inbox list: "1 unread in 1 watched chat" and the
  line "PaperPlane Demo (1) PaperPlane: Day 2 bridge test: t...".
- `day-02-card.png` — the message card with the full test text, sender
  and time; read marking verified against the API (unread 1 → 0).
- Double-tap back navigation card → inbox verified (eventType 3).
- The backend message behind those screens was seeded through the
  bridge's own ingest payload shape (see blockers for why a real post
  could not be used today).

## Simulator quirks found today (recorded so Day 3+ does not re-debug)
1. **List events carry no eventType, and index 0 carries no index.**
   Scroll inputs emit nothing; a tap emits one `listEvent` with the
   final `currentSelectItemIndex` and no `eventType` (CLICK is enum 0,
   dropped like the Day 1 tap quirk). Selecting the first item emits a
   `listEvent` with NO `currentSelectItemIndex` at all — zero-valued
   fields are dropped from the host JSON. `app.js` therefore treats a
   typeless list event as a click, and a missing index as index 0.
2. **A list container id cannot be reused across rebuilds.** The pair
   screen's list (id 4) worked; the inbox list reusing id 4 returned
   `rebuild result: false` with no host error, even though the SDK
   validator said valid. Giving the inbox list its own id (5) fixed it.
   (The same change also shortened list lines to 60 plain chars; the id
   is the believed cause, the line length was not isolated.)
3. **`setLocalStorage` does not survive a simulator restart.**
   `getLocalStorage` after a restart returns "" for a key set and read
   back fine within the previous session (verified twice, same URL).
   Pairing persistence is therefore verified in-session only; on the
   real Even app the storage is per-app persistent. Do not chase this
   as an app bug.
4. **`context_menu` automation input arrives as FOREGROUND_ENTER**
   (eventType 4), and the first `double_click` after it arrived once as
   FOREGROUND_EXIT (5) before settling back to proper types. The
   contextual menu itself could not be opened through the automation
   API, so menu item clicks (Reply / Voice / Brief stubs) are
   code-complete but not simulator-driven today.
5. Container z-order must be unique across text AND list objects on a
   page (the validator catches this one: DUPLICATE_Z_ORDER_INDEX).

## Blockers — the Telegram leg (both are pk-side, one step each)
1. **The bot cannot post in the demo channel.** `getChatMember` shows
   @PaperPlaneG2Bot is an administrator in @PaperPlaneDemo but with
   `can_post_messages: false` (all rights off). `sendMessage` answers
   "need administrator rights in the channel chat". A bot cannot grant
   itself rights. **Unblock:** in Telegram, @PaperPlaneDemo → Manage
   Channel → Administrators → PaperPlane → enable "Post messages"
   (Day 3 also needs edit/delete for channel replies). Note the READ
   path does not need this: the bot already receives channel posts as
   an admin, so one post by pk in the channel also completes the live
   proof.
2. **The demo group's numeric id is unresolvable from the Bot API.**
   The group is a private supergroup known only by its invite link;
   no Bot API method maps that to an id, and nothing in the workspace
   recorded it. The channel id WAS resolvable (`getChat @PaperPlaneDemo`
   → -1004469568710) and is in the watchlist. **Unblock:** any single
   message sent in the "PaperPlane Demo" group while the bridge runs —
   the bridge learns the id from it automatically (title match),
   forwards the message to the inbox, and can post there afterwards.
   Reading the id from the group's Telegram Web URL works too.

## State left running
- Bridge (`node bridge/bridge.mjs`, log /tmp/pp-bridge.log) and the dev
  API on :8787 are LEFT RUNNING on purpose: the first real message in
  either demo chat will flow Telegram → bridge → backend immediately,
  and the group id will be learned. One transient Telegram egress
  disconnect was logged at 05:12 UTC and recovered on the next cycle.
- Simulator and plugin server were stopped. Restart commands are in
  day-01-notes.md; input/screenshot drivers are saved as
  `app/sim-input.sh` and `app/sim-shot.sh`.

## What Day 3 needs
- The two unblocks above (channel post rights; one group message) to
  complete the live Telegram proof and to reply into channels.
- Reply path: card Reply menu → smart replies list → `/api/reply` →
  bridge outbox drain (already working) with `reply_to_message_id`
  threading — needs the planned `ppbot.py` send extension.
- Voice stub becomes the real flow on Thu Nov 26 (STT decision due:
  Workers AI Whisper vs local Whisper).
- Menu clicks still need a first successful drive (simulator
  `context_menu` does not open the menu — try the on-screen Menu button
  coordinates via x11, or accept real-device-only verification).
- Per-user watchlist scoping stays demo-simple (single user) until the
  Mini App lands on Fri Nov 27.
