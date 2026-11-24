# PaperPlane — backend

Two halves, one rule: **the bot token never leaves this VM's secure
surrogate.** The Cloudflare Worker cannot hold or use it, so Telegram
traffic runs through the VM bridge and the Worker only serves the
plugin-facing API.

```
G2 glasses (plugin)                Telegram
      |  fetch()                        ^
      v                                | Bot API (token via surrogate)
  Worker API  <--- ingest ---  VM bridge (this VM, ppbot.py)
  (public)          (bridge secret)      |
      ^                                v
      +----------- outbox -------------+
```

## Parts

| Part | Path | What it is |
| --- | --- | --- |
| Worker API | `worker/src/index.js` | Plugin-facing API. Health, inbox, pairing validation, reply queue. Deploys to Cloudflare Workers. |
| Dev server | `dev-server.mjs` | Runs the same Worker handler on this VM (`:8787`) with no Cloudflare account. |
| VM bridge | `bridge/bridge.mjs` | Long-polls Telegram via `ppbot.py`, handles `/pair`, forwards watched-chat messages, drains the reply outbox. |

## API (Worker)

| Endpoint | Who calls it | What it does |
| --- | --- | --- |
| `GET /health` | anyone | Liveness: `{ ok: true, service, version }` |
| `GET /api/inbox/summary?userId=` | plugin | One entry per watched chat: unread count plus the latest message (inbox list screen) |
| `GET /api/inbox?userId=&chatId=` | plugin | Newest inbox items; with `chatId`, only that chat's messages (card screen) |
| `POST /api/inbox/read` | plugin | `{ userId, chatId, messageId }` - marks messages up to that id as read |
| `POST /api/pairing/validate` | plugin | `{ code, deviceId }` → `{ linked, userId }`; codes are one-time, 10-minute TTL |
| `POST /api/reply` | plugin | `{ userId, chatId, text, replyToMessageId? }` → queued for the bridge; nothing is sent from the plugin directly |
| `GET /api/brief?userId=` | plugin | Channel Brief: new posts from watched channels since the user's last mark, per channel with count and the newest posts shortened (Day 5) |
| `POST /api/brief/mark` | plugin | `{ userId }` - advances the brief watermark to now |
| `GET /api/settings?userId=` | plugin | `{ replyTone }` - the tone the smart replies are written in (Day 5) |
| `POST /api/settings` | plugin | `{ userId, replyTone }` - replyTone is casual, short or formal |
| `GET /miniapp` | anyone | The Mini App settings page (plain HTML, no build step) |
| `POST /api/session/exchange` | Mini App | `{ code }` → `{ sessionToken, userId }`; spends a one-time pairing code, session lives 24 h |
| `GET /api/miniapp/state` | Mini App session | Watchlist with summaries plus the current reply tone |
| `POST /api/miniapp/settings` | Mini App session | `{ replyTone }` - writes the same settings store the plugin reads |
| `POST /api/ingest/pairing-code` | bridge only | Store a code the bot just issued |
| `POST /api/ingest/watchlist` | bridge only | Register the watched chats (`{ chats: [{ chatId, title, kind }] }`) |
| `POST /api/ingest/message` | bridge only | Append a watched-chat message to the inbox |
| `GET /api/ingest/outbox` | bridge only | Drain queued replies (claim-on-read) |

All responses carry permissive CORS headers: the plugin page runs on a
different origin than this API (a WebView), so cross-origin reads must
be allowed explicitly.

Ingest endpoints require `Authorization: Bearer <BRIDGE_SECRET>`. The
bridge secret is a Worker secret at deploy time, an env var locally — it
is **not** the bot token.

## Pairing flow v1 (why it is a code, not initData)

The official Mini App `initData` check needs an HMAC keyed by the bot
token. The token value must never leave the secure surrogate, so no
initData HMAC can run in the Worker or on this VM. Pairing v1 therefore
uses a bot-issued code instead:

1. User sends `/pair` to @PaperPlaneG2Bot in a private chat.
2. The bridge generates a 6-digit code, registers it with the Worker
   (`POST /api/ingest/pairing-code`), and sends it to the user in chat.
3. The user types the code on the glasses; the plugin calls
   `POST /api/pairing/validate`. A valid code links the device (one-time
   use, 10-minute expiry) and the plugin stores the link with
   `setLocalStorage`.

Day 5: the Mini App signs in with the same code pool. The settings page
served at `/miniapp` takes a fresh `/pair` code and exchanges it at
`POST /api/session/exchange` for a 24-hour session token; the token
authorizes `GET /api/miniapp/state` and `POST /api/miniapp/settings`.
A code spent on one surface cannot be spent on the other. The initData
flow remains impossible here for the reason above - the code exchange
is the Mini App auth pattern, not a placeholder for it.

## Run it locally

```bash
# 1. API on :8787 (from backend/)
node dev-server.mjs

# 2. Bridge (another shell; talks to the dev server by default)
cd bridge && node bridge.mjs
```

Test the pairing shape end to end:

```bash
# Health
curl http://127.0.0.1:8787/health

# Send /pair to the bot in Telegram, then validate the code it replies with
curl -X POST http://127.0.0.1:8787/api/pairing/validate \
  -H 'content-type: application/json' \
  -d '{"code":"123456","deviceId":"sim-day-1"}'

# Inbox (empty until the bridge forwards a watched-chat message)
curl 'http://127.0.0.1:8787/api/inbox?userId=1'
```

Bridge config (env): `PPBOT_PATH`, `API_BASE` (default
`http://127.0.0.1:8787`), `BRIDGE_SECRET`, `POLL_MS` (default 2000),
`STATE_FILE` (update offset persistence), `WATCHED_FILE` (default
`bridge/watched-chats.json`), `WATCHED_CHATS` (comma-separated chat ids
added to the file's list).

The watchlist lives in `bridge/watched-chats.json`: an explicit `chats`
list plus `learnTitles`. The Bot API cannot resolve a private
supergroup's numeric id from its invite link, so a group whose title
matches `learnTitles` is learned from its first forwarded activity and
persisted into the file. Configured ids without a title are resolved
through `getChat` on boot.

`ppbot.py` helper commands (added as needed): `me`, `webhook-info`,
`updates`, `send`, `chat` (getChat), `member` (getChatMember). API
errors print Telegram's own error body; the request URL (which carries
the credential surrogate) is never printed.

## Deploy (later in the week)

- Worker: via the `custom.cloudflare` connector (API token flow, already
  verified). Set `BRIDGE_SECRET` as a Worker secret at deploy time.
- Public URL rule: neutral Pages project domain or custom domain — never
  the account `workers.dev` subdomain (it contains the account name).
  The plugin manifest already whitelists `https://paperplane.pages.dev`
  as the intended host.
- STT note: with the backend on a Worker, local Whisper on this VM is not
  reachable from the Worker. First candidate to test (Thu Nov 26): Workers
  AI Whisper on the free tier. Local Whisper stays the fallback if the
  backend ends up VM-hosted instead.

## Known limits

- Stores are in-memory in the Worker handler; production binds KV
  (pairing codes, outbox) and D1 (inbox, watchlists) before the demo.
- Reply threading (`reply_to_message_id`) needs a `ppbot.py` extension —
  Day 3. The outbox already carries `replyToMessageId` for when it lands.
- The bridge polls with one-shot `getUpdates` (no long-poll timeout) —
  fine for build week; a webhook replaces polling for production.
- Demo channel rights (checked 2026-11-24): the bot is an administrator
  in @PaperPlaneDemo but with `can_post_messages: false`, so it can
  receive channel posts but cannot post until the channel owner enables
  post rights for the bot. The demo supergroup's numeric id is not
  resolvable from the Bot API (private invite link only); the bridge
  learns it from the group's first message via `learnTitles`.
