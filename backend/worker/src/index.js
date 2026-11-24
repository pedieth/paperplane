// PaperPlane backend - plugin-facing API (Cloudflare Worker).
// Written during the hackathon build window (Nov 23-29, 2026).
//
// Architecture note (the token constraint): the PaperPlane bot token only
// works through this VM's secure surrogate, which proxies requests to
// api.telegram.org. A Worker cannot hold or use the token, so the Worker
// never talks to Telegram directly. All Telegram traffic goes through the
// VM-side bridge (../bridge/bridge.mjs), which calls the Worker ingest
// endpoints below with a shared bridge secret. The plugin talks only to
// this Worker.
//
// Pairing v1 follows from the same constraint: the official Mini App
// initData check needs an HMAC keyed by the bot token, and the token value
// must never leave the secure surrogate - so no initData HMAC runs here.
// Instead the bot issues a short-lived 6-digit code in chat (/pair) and
// the glasses validate it against this API. The Mini App initData flow is
// a later enhancement, not v1.
//
// Day 2: the read path. The bridge registers a watchlist (the chats the
// bot watches for the user) and forwards their messages here. The plugin
// reads a per-chat summary (unread count + latest message) for its inbox
// list screen, the messages of one chat for its card screen, and marks
// messages read as the user opens them.
//
// Day 5: the Channel Brief and the Mini App settings surface. The brief
// aggregates new posts from watched channels since the user's last
// brief (a per-user watermark, advanced only when the user marks the
// brief read). The Mini App is a plain settings page served at /miniapp;
// it signs in with the same one-time 6-digit pairing code the glasses
// use, exchanged once for a session token. The initData HMAC stays
// impossible for the reason above - the token never leaves the
// surrogate - so the code exchange is the Mini App auth pattern too.
//
// Stores below are in-memory for the build-week dev path (the dev server
// and the Worker isolate both keep them per process). Production binds
// Cloudflare KV (pairing codes, outbox) and D1 (inbox, watchlists) - the
// store shape is already the one the Worker code uses.

import { MINIAPP_HTML } from "./miniapp-page.js";

const CODE_TTL_MS = 10 * 60 * 1000; // pairing codes live 10 minutes
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // Mini App sessions live a day
const INBOX_LIMIT = 20;
const REPLY_TONES = ["casual", "short", "formal"];
const BRIEF_POSTS_PER_CHANNEL = 3;
const BRIEF_TEXT_LIMIT = 110;

function createStores() {
  return {
    // code -> { userId, expiresAt }
    pairingCodes: new Map(),
    // chatId -> { chatId, title, kind }
    watchlist: new Map(),
    // newest-first inbox items: { messageId, chatId, chatTitle, kind, senderName, text, sentAt }
    inbox: [],
    // "userId:chatId" -> highest messageId the user has opened
    readMarkers: new Map(),
    // outbox queue for the bridge: { outboxId, userId, chatId, text, replyToMessageId, createdAt }
    outbox: [],
    outboxSeq: 0,
    // voice transcription jobs (Day 4): jobId -> { jobId, userId, audioBase64, status, text, createdAt }
    // The plugin uploads recorded PCM here; the VM-side STT worker claims
    // jobs through the ingest endpoints, transcribes locally with Whisper
    // and posts the text back. The Worker itself never transcribes.
    voiceJobs: new Map(),
    voiceSeq: 0,
    // per-user settings (Day 5): userId -> { replyTone }
    settings: new Map(),
    // Mini App sessions (Day 5): token -> { userId, expiresAt }
    sessions: new Map(),
    // Channel Brief watermarks (Day 5): userId -> ISO time of last mark
    briefMarks: new Map(),
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The plugin is a web page in a WebView on a different origin than
      // this API, so cross-origin reads must be allowed explicitly.
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}

function isBridge(request, env) {
  const header = request.headers.get("authorization") || "";
  const secret = env.BRIDGE_SECRET || "dev-bridge-secret-change-me";
  return header === `Bearer ${secret}`;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function htmlResponse(body) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function shortenText(text, max) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

function newSessionToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createApp(env = {}) {
  const stores = createStores();

  function replyToneOf(userId) {
    const record = stores.settings.get(userId);
    return record && REPLY_TONES.includes(record.replyTone) ? record.replyTone : "casual";
  }

  function sessionUserId(request) {
    const header = request.headers.get("authorization") || "";
    if (!header.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    const session = stores.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      stores.sessions.delete(token);
      return null;
    }
    return session.userId;
  }

  // Spends a pairing code from the shared one-time pool. Both the
  // glasses (validate) and the Mini App (session exchange) draw from
  // the same pool: a code links exactly one surface, exactly once.
  function spendPairingCode(code) {
    const key = String(code || "").trim();
    const record = stores.pairingCodes.get(key);
    if (!record) return { error: "unknown-code", status: 404 };
    if (Date.now() > record.expiresAt) {
      stores.pairingCodes.delete(key);
      return { error: "expired-code", status: 410 };
    }
    stores.pairingCodes.delete(key);
    return { userId: record.userId };
  }

  function buildBrief(userId) {
    const since = stores.briefMarks.get(userId) || null;
    const channels = [];
    let totalNew = 0;
    for (const chat of stores.watchlist.values()) {
      if (chat.kind !== "channel") continue;
      const fresh = stores.inbox.filter(
        (item) => item.chatId === chat.chatId && (!since || item.sentAt > since)
      );
      if (!fresh.length) continue;
      totalNew += fresh.length;
      channels.push({
        chatId: chat.chatId,
        title: chat.title,
        count: fresh.length,
        // The key posts: the newest few, shortened to a glance.
        posts: fresh.slice(0, BRIEF_POSTS_PER_CHANNEL).map((item) => ({
          messageId: item.messageId,
          text: shortenText(item.text, BRIEF_TEXT_LIMIT),
          sentAt: item.sentAt,
        })),
      });
    }
    return {
      ok: true,
      userId: userId || null,
      generatedAt: new Date().toISOString(),
      since,
      totalNew,
      channels,
    };
  }

  function chatSummary(userId, chat) {
    const messages = stores.inbox.filter((item) => item.chatId === chat.chatId);
    const marker = stores.readMarkers.get(`${userId}:${chat.chatId}`) || 0;
    const unread = messages.filter(
      (item) => typeof item.messageId === "number" && item.messageId > marker
    ).length;
    const latest = messages.length ? messages[0] : null;
    return {
      chatId: chat.chatId,
      title: chat.title,
      kind: chat.kind,
      unread,
      messageCount: messages.length,
      latest: latest
        ? {
            messageId: latest.messageId,
            senderName: latest.senderName,
            text: latest.text,
            sentAt: latest.sentAt,
          }
        : null,
    };
  }

  async function handle(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return jsonResponse({ ok: true });
    }

    if (method === "GET" && path === "/health") {
      return jsonResponse({ ok: true, service: "paperplane-api", version: "0.5.0" });
    }

    if (method === "GET" && (path === "/miniapp" || path === "/miniapp/")) {
      // The Mini App settings page: plain HTML served by the backend
      // itself, so the page and the API share an origin and the page
      // can call the session endpoints below without cross-origin fuss.
      return htmlResponse(MINIAPP_HTML);
    }

    if (method === "GET" && path === "/api/inbox/summary") {
      // One glanceable line per watched chat: unread count plus the
      // latest message. Chats with messages come first, newest first;
      // quiet chats follow in watchlist order.
      const userId = url.searchParams.get("userId") || "";
      const chats = [...stores.watchlist.values()].map((chat) => chatSummary(userId, chat));
      chats.sort((a, b) => {
        if (a.latest && b.latest) return b.latest.sentAt.localeCompare(a.latest.sentAt);
        if (a.latest) return -1;
        if (b.latest) return 1;
        return 0;
      });
      return jsonResponse({ ok: true, userId: userId || null, chats });
    }

    if (method === "GET" && path === "/api/inbox") {
      // With a chatId: that chat's messages, newest first (card screen).
      // Without: the newest stored messages across watched chats.
      const chatId = url.searchParams.get("chatId");
      const all = chatId
        ? stores.inbox.filter((item) => item.chatId === chatId)
        : stores.inbox;
      const items = all.slice(0, INBOX_LIMIT);
      return jsonResponse({ ok: true, userId: url.searchParams.get("userId") || null, items });
    }

    if (method === "POST" && path === "/api/inbox/read") {
      const body = await readJson(request);
      if (!body || typeof body.userId !== "string" || typeof body.chatId !== "string" || typeof body.messageId !== "number") {
        return jsonResponse({ ok: false, error: "userId, chatId and messageId are required" }, 400);
      }
      const key = `${body.userId}:${body.chatId}`;
      const current = stores.readMarkers.get(key) || 0;
      if (body.messageId > current) stores.readMarkers.set(key, body.messageId);
      return jsonResponse({ ok: true, read: true });
    }

    if (method === "POST" && path === "/api/pairing/validate") {
      const body = await readJson(request);
      if (!body || typeof body.code !== "string" || typeof body.deviceId !== "string") {
        return jsonResponse({ ok: false, error: "code and deviceId are required" }, 400);
      }
      const spent = spendPairingCode(body.code);
      if (spent.error) {
        return jsonResponse({ ok: false, linked: false, error: spent.error }, spent.status);
      }
      return jsonResponse({ ok: true, linked: true, userId: spent.userId, deviceId: body.deviceId });
    }

    if (method === "POST" && path === "/api/session/exchange") {
      // Mini App sign-in: the same one-time code the glasses use,
      // exchanged once for a session token (24 h). The code pool is
      // shared, so a code spent here cannot also link the glasses.
      const body = await readJson(request);
      if (!body || typeof body.code !== "string") {
        return jsonResponse({ ok: false, error: "code is required" }, 400);
      }
      const spent = spendPairingCode(body.code);
      if (spent.error) {
        return jsonResponse({ ok: false, error: spent.error }, spent.status);
      }
      const token = newSessionToken();
      const expiresAt = Date.now() + SESSION_TTL_MS;
      stores.sessions.set(token, { userId: spent.userId, expiresAt });
      return jsonResponse({
        ok: true,
        sessionToken: token,
        userId: spent.userId,
        expiresAt: new Date(expiresAt).toISOString(),
      });
    }

    if (method === "GET" && path === "/api/miniapp/state") {
      const userId = sessionUserId(request);
      if (!userId) {
        return jsonResponse({ ok: false, error: "session-required" }, 401);
      }
      const watchlist = [...stores.watchlist.values()].map((chat) => chatSummary(userId, chat));
      return jsonResponse({ ok: true, userId, watchlist, replyTone: replyToneOf(userId) });
    }

    if (method === "POST" && path === "/api/miniapp/settings") {
      const userId = sessionUserId(request);
      if (!userId) {
        return jsonResponse({ ok: false, error: "session-required" }, 401);
      }
      const body = await readJson(request);
      if (!body || !REPLY_TONES.includes(body.replyTone)) {
        return jsonResponse({ ok: false, error: "replyTone must be one of: " + REPLY_TONES.join(", ") }, 400);
      }
      stores.settings.set(userId, { replyTone: body.replyTone });
      return jsonResponse({ ok: true, userId, replyTone: body.replyTone });
    }

    if (method === "GET" && path === "/api/settings") {
      // The plugin reads the tone here before building smart replies.
      const userId = url.searchParams.get("userId") || "";
      return jsonResponse({ ok: true, userId: userId || null, replyTone: replyToneOf(userId) });
    }

    if (method === "POST" && path === "/api/settings") {
      const body = await readJson(request);
      if (!body || typeof body.userId !== "string" || !REPLY_TONES.includes(body.replyTone)) {
        return jsonResponse({ ok: false, error: "userId and a valid replyTone are required" }, 400);
      }
      stores.settings.set(body.userId, { replyTone: body.replyTone });
      return jsonResponse({ ok: true, userId: body.userId, replyTone: body.replyTone });
    }

    if (method === "GET" && path === "/api/brief") {
      // The Channel Brief: new posts from watched channels since the
      // user's last mark, grouped per channel. Reading the brief does
      // not advance the watermark - only the mark call does - so the
      // user can reopen it until they choose to clear it.
      const userId = url.searchParams.get("userId") || "";
      return jsonResponse(buildBrief(userId));
    }

    if (method === "POST" && path === "/api/brief/mark") {
      const body = await readJson(request);
      if (!body || typeof body.userId !== "string") {
        return jsonResponse({ ok: false, error: "userId is required" }, 400);
      }
      const markedAt = new Date().toISOString();
      stores.briefMarks.set(body.userId, markedAt);
      return jsonResponse({ ok: true, userId: body.userId, markedAt });
    }

    if (method === "POST" && path === "/api/reply") {
      const body = await readJson(request);
      if (!body || typeof body.userId !== "string" || typeof body.chatId !== "string" || typeof body.text !== "string" || body.text.trim() === "") {
        return jsonResponse({ ok: false, error: "userId, chatId and non-empty text are required" }, 400);
      }
      if (body.text.length > 4096) {
        return jsonResponse({ ok: false, error: "text is too long" }, 400);
      }
      stores.outboxSeq += 1;
      const item = {
        outboxId: `out-${stores.outboxSeq}`,
        userId: body.userId,
        chatId: body.chatId,
        text: body.text,
        replyToMessageId: typeof body.replyToMessageId === "number" ? body.replyToMessageId : null,
        createdAt: new Date().toISOString(),
      };
      stores.outbox.push(item);
      // The bridge drains the outbox and sends through the Bot API. Nothing
      // is ever sent from the plugin directly.
      return jsonResponse({ ok: true, queued: true, outboxId: item.outboxId });
    }

    if (method === "POST" && path === "/api/voice/transcribe") {
      // The plugin uploads one recorded reply as base64 PCM (16 kHz,
      // 16-bit, mono). Cap the payload at about 1 MB of audio - roughly
      // 30 seconds of speech, well past the per-reply cap.
      const body = await readJson(request);
      if (!body || typeof body.userId !== "string" || typeof body.audioBase64 !== "string" || body.audioBase64.length === 0) {
        return jsonResponse({ ok: false, error: "userId and audioBase64 are required" }, 400);
      }
      if (body.audioBase64.length > 1400000) {
        return jsonResponse({ ok: false, error: "audio is too long" }, 400);
      }
      stores.voiceSeq += 1;
      const jobId = `voice-${stores.voiceSeq}`;
      stores.voiceJobs.set(jobId, {
        jobId,
        userId: body.userId,
        audioBase64: body.audioBase64,
        status: "pending",
        text: "",
        createdAt: new Date().toISOString(),
      });
      return jsonResponse({ ok: true, queued: true, jobId });
    }

    if (method === "GET" && path === "/api/voice/result") {
      const jobId = url.searchParams.get("jobId") || "";
      const job = stores.voiceJobs.get(jobId);
      if (!job) {
        return jsonResponse({ ok: false, error: "unknown-job" }, 404);
      }
      return jsonResponse({
        ok: true,
        jobId,
        status: job.status,
        text: job.status === "done" ? job.text : "",
      });
    }

    // ---- Bridge-only ingest endpoints (shared secret, never the bot token) ----
    if (path.startsWith("/api/ingest/") && !isBridge(request, env)) {
      return jsonResponse({ ok: false, error: "bridge-auth-required" }, 401);
    }

    if (method === "POST" && path === "/api/ingest/pairing-code") {
      const body = await readJson(request);
      if (!body || typeof body.code !== "string" || typeof body.userId !== "string") {
        return jsonResponse({ ok: false, error: "code and userId are required" }, 400);
      }
      stores.pairingCodes.set(body.code.trim(), {
        userId: body.userId,
        expiresAt: Date.now() + CODE_TTL_MS,
      });
      return jsonResponse({ ok: true, stored: true, ttlMs: CODE_TTL_MS });
    }

    if (method === "POST" && path === "/api/ingest/watchlist") {
      const body = await readJson(request);
      if (!body || !Array.isArray(body.chats)) {
        return jsonResponse({ ok: false, error: "chats array is required" }, 400);
      }
      for (const chat of body.chats) {
        if (!chat || typeof chat.chatId !== "string") continue;
        stores.watchlist.set(chat.chatId, {
          chatId: chat.chatId,
          title: typeof chat.title === "string" ? chat.title : "",
          kind: typeof chat.kind === "string" ? chat.kind : "",
        });
      }
      return jsonResponse({ ok: true, stored: true, chats: stores.watchlist.size });
    }

    if (method === "POST" && path === "/api/ingest/message") {
      const body = await readJson(request);
      if (!body || typeof body.chatId !== "string" || typeof body.text !== "string") {
        return jsonResponse({ ok: false, error: "chatId and text are required" }, 400);
      }
      stores.inbox.unshift({
        messageId: typeof body.messageId === "number" ? body.messageId : null,
        chatId: body.chatId,
        chatTitle: typeof body.chatTitle === "string" ? body.chatTitle : "",
        kind: typeof body.kind === "string" ? body.kind : "",
        senderName: typeof body.senderName === "string" ? body.senderName : "",
        text: body.text,
        sentAt: typeof body.sentAt === "string" ? body.sentAt : new Date().toISOString(),
      });
      if (stores.inbox.length > 200) stores.inbox.length = 200;
      return jsonResponse({ ok: true, stored: true });
    }

    if (method === "GET" && path === "/api/ingest/outbox") {
      const items = stores.outbox.splice(0, stores.outbox.length);
      return jsonResponse({ ok: true, items });
    }

    if (method === "GET" && path === "/api/ingest/voice-jobs") {
      // Claim-on-read, like the outbox: pending jobs are handed to the
      // STT worker once and marked claimed so a second poll cannot
      // double-transcribe.
      const jobs = [];
      for (const job of stores.voiceJobs.values()) {
        if (job.status === "pending") {
          job.status = "claimed";
          jobs.push({ jobId: job.jobId, userId: job.userId, audioBase64: job.audioBase64 });
        }
      }
      return jsonResponse({ ok: true, jobs });
    }

    if (method === "POST" && path === "/api/ingest/voice-result") {
      const body = await readJson(request);
      if (!body || typeof body.jobId !== "string" || typeof body.text !== "string") {
        return jsonResponse({ ok: false, error: "jobId and text are required" }, 400);
      }
      const job = stores.voiceJobs.get(body.jobId);
      if (!job) {
        return jsonResponse({ ok: false, error: "unknown-job" }, 404);
      }
      job.status = "done";
      job.text = body.text;
      return jsonResponse({ ok: true, stored: true });
    }

    return jsonResponse({ ok: false, error: "not-found" }, 404);
  }

  return { fetch: handle, stores };
}

// Cloudflare Workers entrypoint. One app instance per isolate: the
// in-memory stores must survive across requests in the same isolate
// (a fresh app per request would lose every pairing code and inbox item).
// With KV/D1 bindings this becomes moot, but the singleton is correct
// either way.
let appInstance = null;
export default {
  async fetch(request, env) {
    if (!appInstance) appInstance = createApp(env);
    return appInstance.fetch(request);
  },
};
