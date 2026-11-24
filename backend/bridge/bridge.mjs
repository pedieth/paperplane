// PaperPlane VM bridge - the only process that talks to Telegram.
// Written during the hackathon build window (Nov 23-29, 2026).
//
// Why a bridge exists: the bot token only works through this VM's secure
// surrogate (see ../custom-connectors/custom.paperplane-telegram-bot, helper
// ppbot.py). The Cloudflare Worker cannot hold or use the token, so the
// bridge does all Telegram traffic here and syncs data with the Worker
// through its ingest endpoints, authenticated by a shared bridge secret.
//
// The token value is never printed, logged or stored by this file. Every
// Telegram call goes through ppbot.py as a subprocess; the bridge only ever
// sees the surrogate path inside that helper.
//
// What it does:
// - Long-polls getUpdates via ppbot.py (offset persisted in state.json).
// - /pair in a bot DM: generates a 6-digit code, registers it with the
//   Worker, and sends it to the user. The glasses validate the code
//   against POST /api/pairing/validate.
// - Watchlist (Day 2): the chats in watched-chats.json are registered
//   with the Worker on boot, and their messages and channel posts are
//   forwarded to the Worker inbox. Configured ids without a title are
//   resolved through getChat on boot. A group or channel whose title
//   matches learnTitles is learned on first sight (its numeric id is
//   persisted into watched-chats.json) - the Bot API has no way to look
//   up a private supergroup by its invite link, so first activity is how
//   the demo group registers itself.
// - /start and /help: short help text.
// - Outbox drain: queued replies from the plugin are sent through the
//   Bot API. Items carrying a replyToMessageId go out threaded to that
//   message (ppbot.py reply, Day 3); plain items send unthreaded.
//
// Config (environment):
//   PPBOT_PATH       path to ppbot.py (default below)
//   API_BASE         Worker/dev-server base URL (default http://127.0.0.1:8787)
//   BRIDGE_SECRET    shared secret for Worker ingest endpoints
//   POLL_MS          poll interval in ms (default 2000)
//   WATCHED_CHATS    comma-separated chat ids, added to the config file list
//   WATCHED_FILE     watched-chats.json path (default next to this file)
//   STATE_FILE       update offset persistence path

import { execFile } from "node:child_process";
import { randomInt } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const PPBOT_PATH =
  process.env.PPBOT_PATH ||
  "/home/hatch/workspace/custom-connectors/custom.paperplane-telegram-bot/bin/ppbot.py";
const API_BASE = process.env.API_BASE || "http://127.0.0.1:8787";
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "dev-bridge-secret-change-me";
const POLL_MS = Number(process.env.POLL_MS || 2000);
const WATCHED_FILE = process.env.WATCHED_FILE || `${HERE}/watched-chats.json`;
const STATE_FILE = process.env.STATE_FILE || `${HERE}/state.json`;

const HELP_TEXT =
  "PaperPlane - your Telegram, on your glasses.\n\n" +
  "/pair - get a link code for your glasses\n" +
  "/help - show this help\n\n" +
  "Add me to a group or channel as admin and I will watch it for you.";

function log(...args) {
  console.log(new Date().toISOString(), "[paperplane-bridge]", ...args);
}

function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    }
  } catch (err) {
    log("state file unreadable, starting fresh:", err.message);
  }
  return { offset: null };
}

function saveState(state) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    log("state file write failed:", err.message);
  }
}

function loadWatched() {
  const config = { chats: [], learnTitles: [] };
  try {
    if (existsSync(WATCHED_FILE)) {
      const parsed = JSON.parse(readFileSync(WATCHED_FILE, "utf-8"));
      if (Array.isArray(parsed.chats)) config.chats = parsed.chats;
      if (Array.isArray(parsed.learnTitles)) config.learnTitles = parsed.learnTitles;
    }
  } catch (err) {
    log("watched file unreadable, starting empty:", err.message);
  }
  for (const id of (process.env.WATCHED_CHATS || "").split(",")) {
    const chatId = id.trim();
    if (chatId && !config.chats.some((chat) => chat.chatId === chatId)) {
      config.chats.push({ chatId, title: "", kind: "" });
    }
  }
  return config;
}

function saveWatched(config) {
  try {
    writeFileSync(WATCHED_FILE, JSON.stringify(config, null, 2) + "\n");
  } catch (err) {
    log("watched file write failed:", err.message);
  }
}

async function callPpbot(args) {
  const { stdout } = await execFileAsync("python3", [PPBOT_PATH, ...args], {
    timeout: 40000,
  });
  return JSON.parse(stdout);
}

async function apiCall(path, method, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${BRIDGE_SECRET}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

function makePairCode() {
  return String(randomInt(100000, 1000000));
}

async function registerWatchlist(config) {
  const result = await apiCall("/api/ingest/watchlist", "POST", { chats: config.chats });
  log("watchlist registered with the API:", JSON.stringify(result));
}

async function resolveConfiguredChats(config) {
  let changed = false;
  for (const chat of config.chats) {
    if (chat.title) continue;
    try {
      const data = await callPpbot(["chat", chat.chatId]);
      if (data && data.ok && data.result) {
        chat.title = data.result.title || data.result.first_name || "";
        chat.kind = data.result.type || "";
        changed = true;
        log("resolved chat", chat.chatId, "as", JSON.stringify(chat.title), chat.kind);
      }
    } catch (err) {
      log("getChat failed for", chat.chatId, ":", err.message);
    }
  }
  if (changed) saveWatched(config);
}

async function learnChat(config, watchedIds, chat) {
  const chatId = String(chat.id);
  const entry = {
    chatId,
    title: chat.title || "",
    kind: chat.type || "",
  };
  config.chats.push(entry);
  watchedIds.add(chatId);
  saveWatched(config);
  log("learned watched chat from first activity:", chatId, JSON.stringify(entry.title), entry.kind);
  await registerWatchlist(config);
}

async function handlePairCommand(chatId, userId) {
  const code = makePairCode();
  await apiCall("/api/ingest/pairing-code", "POST", { code, userId: String(userId) });
  await callPpbot([
    "send",
    String(chatId),
    `Your PaperPlane link code is ${code}.\nIt expires in 10 minutes. Enter it on your glasses to link.`,
  ]);
  log("pair code issued for user", userId);
}

async function handleHelpCommand(chatId) {
  await callPpbot(["send", String(chatId), HELP_TEXT]);
}

async function forwardMessage(message) {
  const chat = message.chat || {};
  const chatId = String(chat.id);
  const text = message.text || message.caption || "";
  if (!text) return;
  // Channel posts carry no personal author: Telegram puts the channel
  // itself in sender_chat (and "from" is the channel or absent), so the
  // sender shown on the lens is the channel title.
  let senderName = "";
  if (message.sender_chat && message.sender_chat.title) {
    senderName = message.sender_chat.title;
  } else if (message.from) {
    senderName = [message.from.first_name, message.from.last_name].filter(Boolean).join(" ");
  }
  if (!senderName && (chat.type === "channel" || message.sender_chat)) {
    senderName = chat.title || "";
  }
  await apiCall("/api/ingest/message", "POST", {
    chatId,
    chatTitle: chat.title || chat.first_name || "",
    kind: chat.type || "",
    senderName,
    text,
    messageId: message.message_id,
    sentAt: new Date((message.date || 0) * 1000).toISOString(),
  });
  log("forwarded message from chat", chatId);
}

async function drainOutbox() {
  const data = await apiCall("/api/ingest/outbox", "GET");
  const items = (data && data.items) || [];
  for (const item of items) {
    // Threaded when the plugin queued a reply to a specific message:
    // ppbot.py reply sends with reply_parameters so the answer lands
    // attached to the original message in the original chat.
    let result;
    if (typeof item.replyToMessageId === "number") {
      result = await callPpbot([
        "reply",
        String(item.chatId),
        item.text,
        String(item.replyToMessageId),
      ]);
    } else {
      result = await callPpbot(["send", String(item.chatId), item.text]);
    }
    if (result && result.ok && result.result) {
      const sent = result.result;
      const threadedTo =
        sent.reply_to_message && sent.reply_to_message.message_id
          ? ` threaded to ${sent.reply_to_message.message_id}`
          : "";
      log(
        "sent queued reply", item.outboxId, "to chat", item.chatId,
        "as message", sent.message_id + threadedTo
      );
    } else {
      log("send failed for", item.outboxId, ":", JSON.stringify(result).slice(0, 200));
    }
  }
}

async function handleUpdate(update, config, watchedIds) {
  const message = update.message || update.channel_post || update.edited_channel_post;
  if (!message) return;
  const chat = message.chat || {};
  const chatId = String(chat.id);
  const text = (message.text || "").trim();
  const isPrivate = chat.type === "private";
  const userId = message.from ? message.from.id : null;

  if (isPrivate && text === "/pair" && userId) {
    await handlePairCommand(chatId, userId);
    return;
  }
  if (isPrivate && (text === "/start" || text === "/help")) {
    await handleHelpCommand(chatId);
    return;
  }
  if (!isPrivate && !watchedIds.has(chatId) && chat.title && config.learnTitles.includes(chat.title)) {
    await learnChat(config, watchedIds, chat);
  }
  if (watchedIds.has(chatId)) {
    await forwardMessage(message);
    return;
  }
  // Messages from unwatched chats are ignored (quiet inbox by design).
}

async function pollOnce(state, config, watchedIds) {
  const args = ["updates"];
  if (state.offset) args.push(String(state.offset));
  const data = await callPpbot(args);
  if (!data || data.ok !== true) {
    log("getUpdates returned not-ok:", JSON.stringify(data).slice(0, 200));
    return;
  }
  for (const update of data.result || []) {
    try {
      await handleUpdate(update, config, watchedIds);
    } catch (err) {
      log("update handler failed for", update.update_id, ":", err.message);
    }
    state.offset = update.update_id + 1;
  }
  saveState(state);
}

async function main() {
  const me = await callPpbot(["me"]);
  if (!me || me.ok !== true) {
    log("bot identity check failed, exiting:", JSON.stringify(me).slice(0, 200));
    process.exit(1);
  }
  log("bridge up as", me.result.username, "(id", me.result.id + ")");

  const config = loadWatched();
  await resolveConfiguredChats(config);
  const watchedIds = new Set(config.chats.map((chat) => chat.chatId));
  log("watched chats:", watchedIds.size ? [...watchedIds].join(", ") : "(none yet)");
  log("learn titles:", config.learnTitles.join(", ") || "(none)");
  log("api base:", API_BASE);
  await registerWatchlist(config);

  const state = loadState();
  for (;;) {
    try {
      await pollOnce(state, config, watchedIds);
    } catch (err) {
      log("poll cycle failed:", err.message);
    }
    try {
      await drainOutbox();
    } catch (err) {
      log("outbox drain failed:", err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main();
