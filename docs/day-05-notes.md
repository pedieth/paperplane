# PaperPlane — Day 5 notes (Fri Nov 27 build day, executed Nov 24 ~05:38-06:05 UTC)

Status: **all three jobs done.** The Channel Brief renders on the lens
with real @PaperPlaneDemo posts (including one posted minutes before),
the Mini App settings page is live on the backend with code-exchange
sign-in and a reply tone that visibly rewrites the smart replies, and
the neutral Pages host is provisioned as a project (deployment is the
one partial — see the Cloudflare section). Package restamped at
v0.5.0. No blockers for Day 6.

## Job 1 — Channel Brief

Backend (`backend/worker/src/index.js`, API version 0.5.0):
- `GET /api/brief?userId=` aggregates inbox items from watched
  channels (kind "channel") newer than the user's brief watermark:
  per channel a count plus the newest 3 posts, whitespace-collapsed
  and shortened to 110 chars. Reading the brief does NOT move the
  watermark; `POST /api/brief/mark { userId }` does. First brief
  (no watermark) covers everything stored.
- The existing `/api/pairing/validate` was refactored onto a shared
  `spendPairingCode` helper — the glasses and the Mini App now draw
  from one one-time code pool (Job 2 depends on this).

Plugin (`app/public/app.js`):
- New "brief" screen on the replies-screen layout budget (header at
  y=58, list at y=94 with its own container id 7, footer at 228):
  header line with the totals, then per channel a header row and the
  key posts. Empty state is a text-only "All caught up" page.
- Entry points: **long-press on home** (the home hint now says so)
  and the card menu's Brief item, which previously was an honest
  stub and now calls the same `showBrief()`. Tap a row to open that
  channel's card screen (shared `openChatObject` with the inbox).
  Double-tap exits and marks the brief read.

Live proof (evidence in `app/sim-evidence/`):
- The inbox store was empty after the Day 4 API restart (in-memory
  store), and the Bot API never echoes a bot's own posts back through
  getUpdates (bridge offset never moved — checked), so the channel
  was seeded with the established Day 2-4 pattern: real posts sent to
  @PaperPlaneDemo through the bot (channel message ids 5, 6, 7), then
  ingested through the bridge endpoint with their real ids. A fourth
  post was published the same way minutes before the brief was opened
  (message id 8, the "reply tones are live" post).
- `day-05-brief.png` — brief screen: "4 new in 1 channel", header row
  "PaperPlane Demo - 4 new", the fresh post first, then the schedule
  post (the third key post is one scroll down; 3 rows fit the list).
- `day-05-brief-card.png` — tapping the fresh post's row opens its
  channel card with the full text ("1 of 4"); the console shows the
  read mark for message 8 landing.
- Mark flow verified end to end: reopen the brief, double-tap out,
  `GET /api/brief` returns totalNew 0 with the watermark set;
  `day-05-brief-empty.png` shows the "All caught up" state.

## Job 2 — Mini App settings surface

- `backend/worker/src/miniapp-page.js` holds the page as one exported
  string; the backend serves it at `GET /miniapp` (same origin as the
  API, so no CORS dance). Plain HTML/CSS/JS, no build step. Sections:
  pairing help (what /pair does and why), the connect card, the
  watchlist (title, kind chip, unread count, latest line — read live
  from the API), the reply-tone picker (casual / short / formal with
  one-line descriptions), and a disconnect button.
- Auth pattern, as specified: the page takes the same 6-digit code
  the glasses use and exchanges it at `POST /api/session/exchange`
  for a 24-hour session token (stored in sessionStorage). The token
  authorizes `GET /api/miniapp/state` and `POST /api/miniapp/settings`.
  initData HMAC remains impossible — the bot token never leaves the
  secure surrogate — and the page itself explains this to the user in
  one short paragraph. Codes are one-time across both surfaces: a
  code spent in the Mini App cannot also link the glasses.
- Settings store: `GET /api/settings?userId=` for the plugin,
  `POST /api/settings` and the session-guarded Mini App pair write
  the same per-user record. Single-user scope kept (test identity
  1001); no multi-user tenancy was built.
- The plugin now fetches the tone every time the replies screen opens
  and generates its local suggestions from a per-shape, per-tone table
  (`REPLY_SETS` in app.js). The replies footer names the active tone.

Verified:
- API flow by curl: page 200 (11,248 bytes); planted code exchanged
  for a session; state returned both watched chats with summaries and
  the tone; tone set to "short" through the Mini App endpoint and
  read back through the plugin endpoint; code reuse rejected
  (unknown-code); bad session 401; invalid tone 400.
- `day-05-miniapp.png` — the page rendered in a real WebKit window
  (MiniBrowser on the VM's X display): connect card, code field and
  the auth explanation all as designed.
- Tone on the lens, same group question message both times:
  `day-05-replies-short.png` — "Yes, works for me. / Let me check. /
  Will confirm soon.", footer "Tone: short". After switching the
  setting: `day-05-replies-formal.png` — "Thank you - I will check
  and reply. / Yes, that arrangement works for me. / I will confirm
  shortly, thank you.", footer "Tone: formal". The plugin console
  logs "replies: tone is short/formal" on each open. Tone was left
  at casual afterwards.

## Job 3 — neutral public host (Cloudflare Pages)

Using the connector helper's own request machinery (the helper has no
Pages command, so a throwaway probe script drove the same API):
- Token verify: active. Pages project LIST works, and project CREATE
  works — the token's Workers-template scope evidently covers Pages
  project management. Project **paperplane** created (id
  b15a1e91-3091-47b6-aba6-71d381964f7e).
- **The catch**: the project's subdomain is
  **paperplane-4kt.pages.dev**, not paperplane.pages.dev. Pages
  subdomains are a global namespace and the bare name is taken by
  someone else, so the host the manifest whitelisted was never going
  to be ours. `app.json` now whitelists
  `https://paperplane-4kt.pages.dev` (still neutral, still no account
  name) alongside the local dev host.
- Deployment is the partial: the direct-upload flow gets an
  upload-token and check-missing succeeds (all 3 plugin files
  missing), but `POST /pages/assets/upload` returns **HTTP 500,
  "error code: 1101"** (a Cloudflare-side error) with both filename
  encodings tried. Not forced further, per instructions. The project
  exists and holds the name; the deployment step is a Day 6 item
  (retry, or deploy the backend as the project's Worker once the
  bridge can ingest against a public base). The local dev host
  (127.0.0.1:8787) remains the demo path, unchanged.

## Click-verified vs code-verified (honest split)

- **Click-verified in the simulator**: re-pairing (code 112233
  planted through the ingest endpoint, digits driven by scroll+tap,
  "pair: linked as user 1001"); home long-press → brief with real
  content; brief row tap → channel card; brief double-tap → mark
  (API totalNew 0 afterwards); empty brief state; inbox → group card
  → replies in short tone; tone switch → replies in formal tone.
- **Rendered and read**: the Mini App page in MiniBrowser (visual),
  and its full session/settings flow by curl against the real
  endpoints (the page's own buttons were not clicked through in a
  browser session — the page calls exactly the endpoints the curl
  run exercised, with the same payloads).
- **Code-verified only**: the card menu's Brief item and the home
  menu's Channel brief item (same `showBrief()` the long-press
  drives; menu clicks remain undrivable in the simulator, Day 2
  quirk 4); the Mini App disconnect button (drops the stored token
  and re-shows the connect card).
- **API-verified**: brief aggregation shape and watermark, session
  exchange one-time semantics, 401/400 guards, Pages project
  creation. The Pages asset upload failure is an observed API
  response, not a guess.

## Environment repair (worth knowing)

- The VM was rebuilt again: `libwebkit2gtk-4.1.so.0`,
  `libjavascriptcoregtk-4.1.so.0` and `libsoup-3.0.so.0` were gone
  and the simulator would not start. The os-intent replay held the
  apt lists lock with a very slow `apt-get update` (12+ minutes), so
  the Day 1 route was repeated with a twist: the noble Packages
  indexes were fetched directly from the Ubuntu mirror, the missing
  closure (47 packages) downloaded and SHA256-matched by apt's own
  index data, and `dpkg -i` installed them in a lock gap (the replay
  was in its update phase, not running dpkg). `ldd` now reports zero
  missing libs with no LD_LIBRARY_PATH tricks, and the simulator
  shows only the benign DRI3 warning, as on Nov 19. An earlier
  attempt to run from an extracted tree under /tmp failed on EGL
  (GPU process abort, BAD_PARAMETER) — the system install is the fix;
  do not retry the extraction route. The resolver script is at
  /tmp/simlibs/resolve.py if a future rebuild needs it.
- Services: dev API restarted once for the v0.5.0 code (bridge
  restarted with it so the watchlist re-registered; STT worker kept
  running throughout). All three are LEFT RUNNING. Simulator and
  plugin server were stopped after verification; Xvfb :99 is up.

## State after Day 5

- `paperplane.ehpk` restamped at version 0.5.0 (64,625 bytes),
  whitelist now paperplane-4kt.pages.dev + the local dev host.
- Inbox holds 4 real channel posts and the group question message;
  brief watermark for user 1001 sits after them (next brief starts
  empty, as designed); reply tone left at casual.
- Backend README documents the Day 5 endpoints and the code-exchange
  auth pattern.

## What remains — Day 6 (Sat Nov 28) and Day 7 (Sun Nov 29)

Deadline: **Sun Nov 29, 23:29 Tehran** (23:59 Dubai).
- Hardening: full simulator rehearsal of all five beats in order
  (pair, inbox, card replies, voice reply, brief) on the final
  package; edge passes — empty inbox, expired code, backend down —
  shown as graceful lens states, not crashes.
- Pages deployment retry (asset upload 500/1101) and, if it lands,
  point the bridge ingest at the public base and re-run the brief
  proof against it; otherwise the demo stays on the local host and
  the README says so plainly.
- Public GitHub repo: code, README with the pre-existing-assets
  declaration (SDK 0.0.16 / CLI 0.2.0 / simulator 0.9.5, the bot
  created 2026-11-20, HeyGen demo voice takes, local Whisper STT),
  the architecture note (token surrogate → VM bridge → Worker API)
  and setup instructions that do not leak any credential.
- Demo video (≤3 min, the five beats, HeyGen narration takes are
  already recorded) and the DoraHacks submission: track pick,
  description, repo link, video link — submitted with hours of
  buffer, not at the deadline.
