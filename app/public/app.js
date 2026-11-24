// PaperPlane - Day 5: pairing, priority inbox, message card, replies,
// voice replies, channel brief, reply tone.
// Written during the hackathon build window (Nov 23-29, 2026).
// The lens canvas is 576x288, monochrome green. All public text is English.
//
// Screens (one page at a time, rebuilt on transitions):
// - home:  Day 1 startup screen. Tap opens the inbox when linked, the
//          pairing screen when not. Long-press opens the channel brief.
// - pair:  enter the 6-digit code from the bot with a digit list (scroll
//          to a digit, tap to enter it). Validates against the backend
//          and persists the link with setLocalStorage.
// - inbox: one glanceable list line per watched chat (unread count and
//          latest sender). Tap a chat to open its newest message.
// - card:  one message full-screen (sender, chat, text) with a menu of
//          Reply / Voice / Brief. Tap opens the smart replies screen;
//          scroll moves between the chat's messages; long-press opens
//          the voice reply screen. The menu Brief item opens the brief.
// - brief: the Channel Brief (Day 5). One glanceable stack: a header
//          line with the new-post count, then the key posts from each
//          watched channel since the last brief. Tap a post to open
//          its channel card. Double-tap marks the brief read (the
//          backend watermark moves) and goes home.
// - replies: three locally generated smart replies for the open message,
//          written in the reply tone set in the Mini App (Day 5).
//          Tap one to send it, threaded to the original message through
//          the backend outbox and the VM bridge.
// - voice: record a spoken reply (Day 4). The mic opens through
//          bridge.audioControl, PCM frames are collected from
//          event.audioEvent, uploaded to the backend, and transcribed
//          by the local Whisper worker next to the bridge. The
//          transcript is shown on the lens and is only sent after the
//          user approves it with a tap - never automatically.

import {
  AudioInputSource,
  CreateStartUpPageContainer,
  EventSourceType,
  ListContainerProperty,
  ListItemContainerProperty,
  MenuContainerProperty,
  MenuItemProperty,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  validateEvenHubPageContainer,
  waitForEvenAppBridge,
} from "./vendor/even-hub-sdk.js";

const LOG_TAG = "[paperplane]";
const BRIDGE_WAIT_MS = 5000;
const API_BASE =
  new URLSearchParams(window.location.search).get("api") ||
  "http://127.0.0.1:8787";

const LINK_KEY = "paperplane-link";
const DEVICE_KEY = "paperplane-device-id";

// Container ids (stable across screens; upgrades target the live page).
const TITLE_ID = 1;
const MAIN_ID = 2;
const FOOT_ID = 3;
const LIST_ID = 4;

// Menu item ids, unique per screen.
const MENU_HOME_INBOX = 11;
const MENU_HOME_LINK = 12;
const MENU_HOME_REFRESH = 13;
const MENU_HOME_BRIEF = 14;
const MENU_PAIR_CLEAR = 21;
const MENU_PAIR_BACK = 22;
const MENU_INBOX_REFRESH = 31;
const MENU_INBOX_HOME = 32;
const MENU_CARD_REPLY = 41;
const MENU_CARD_VOICE = 42;
const MENU_CARD_BRIEF = 43;
const MENU_CARD_INBOX = 44;
const MENU_REPLY_BACK = 51;
const MENU_VOICE_BACK = 61;
const MENU_BRIEF_MARK = 71;
const MENU_BRIEF_HOME = 72;

const STATUS_HOME = "Telegram, on your lens.";
const STATUS_LINKED = "Linked. Tap to open your inbox.";
const STATUS_HELP = "Help: tap to start, double-tap goes back.";
const HINT_HOME = "Tap to start - long-press for the brief.";

let bridge = null;
let screen = "home";
let busy = false;

// Pairing state.
let deviceId = null;
let link = null; // { userId, linkedAt }
let enteredCode = "";

// Inbox state.
let summaryChats = [];
let lastListIndex = 0;

// Card state.
let cardChat = null;
let cardMessages = [];
let cardIndex = 0;
let cardLoadFailed = false;

// Reply state (smart replies for the open card message).
let replyOptions = [];
// The reply tone from the Mini App settings (Day 5): casual, short or
// formal. Refreshed from the backend every time the replies screen
// opens, so a change in the Mini App lands on the next reply.
let replyTone = "casual";

// Brief state (Day 5): the last digest from /api/brief and the flat
// list entries the brief screen shows (channel headers and posts).
let briefData = null;
let briefEntries = [];

// Voice state (Day 4). Phases: idle -> recording -> transcribing ->
// review -> (tap) sent. The transcript is never sent without the
// review step: approval on the lens is a hard rule of the flow.
let voicePhase = "idle";
let voiceChunks = [];
let voiceFrames = 0;
let voiceBytes = 0;
let voiceChunkSize = 0;
let voiceTranscript = "";
let voiceJobId = null;

function log(...args) {
  console.log(LOG_TAG, ...args);
}

function sourceName(source) {
  if (source === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R) return "glasses-R";
  if (source === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L) return "glasses-L";
  if (source === EventSourceType.TOUCH_EVENT_FROM_RING) return "ring";
  return "unknown";
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  return response.json();
}

function truncate(text, max) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

function formatTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ---------- small container builders ----------

function titleBox(content) {
  return new TextContainerProperty({
    xPosition: 24, yPosition: 16, width: 528, height: 40,
    containerID: TITLE_ID, containerName: "title", zOrderIndex: 1,
    content, textColor: 4,
  });
}

function mainBox(content, capture = false) {
  return new TextContainerProperty({
    xPosition: 24, yPosition: 64, width: 528, height: 152,
    containerID: MAIN_ID, containerName: "main", zOrderIndex: 2,
    content, textColor: 3, isEventCapture: capture ? 1 : 0,
  });
}

function footBox(content) {
  return new TextContainerProperty({
    xPosition: 24, yPosition: 228, width: 528, height: 44,
    containerID: FOOT_ID, containerName: "foot", zOrderIndex: 3,
    content, textColor: 2,
  });
}

function listBox(items, yPosition = 64, height = 152, containerID = LIST_ID) {
  return new ListContainerProperty({
    xPosition: 24, yPosition, width: 528, height,
    containerID, containerName: "list", zOrderIndex: 4,
    isEventCapture: 1,
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length,
      itemWidth: 500,
      isItemSelectBorderEn: 1,
      itemName: items,
    }),
  });
}

function menuOf(entries) {
  return new MenuContainerProperty({
    menuItems: entries.map(
      ([itemID, itemName]) => new MenuItemProperty({ itemName, itemID })
    ),
  });
}

async function rebuild(page, label) {
  const check = validateEvenHubPageContainer(page);
  log("rebuild", label, "validation:", JSON.stringify(check));
  const result = await bridge.rebuildPageContainer(page);
  log("rebuild", label, "result:", result);
  return result;
}

async function upgrade(containerID, containerName, content) {
  if (!bridge) return;
  try {
    const ok = await bridge.textContainerUpgrade({ containerID, containerName, content });
    log("upgrade", containerName, "ok:", ok, JSON.stringify(content).slice(0, 80));
  } catch (err) {
    log("upgrade failed:", err);
  }
}

function setFoot(text) {
  return upgrade(FOOT_ID, "foot", text);
}

// ---------- home ----------

function homeStatus() {
  return link ? STATUS_LINKED : STATUS_HOME;
}

function buildHomePage() {
  const title = new TextContainerProperty({
    xPosition: 24, yPosition: 20, width: 528, height: 60,
    containerID: TITLE_ID, containerName: "title", zOrderIndex: 1,
    content: "PaperPlane", textColor: 4,
  });
  const status = new TextContainerProperty({
    xPosition: 24, yPosition: 96, width: 528, height: 64,
    containerID: MAIN_ID, containerName: "main", zOrderIndex: 2,
    content: homeStatus(), textColor: 3, isEventCapture: 1,
  });
  const hint = new TextContainerProperty({
    xPosition: 24, yPosition: 176, width: 528, height: 48,
    containerID: FOOT_ID, containerName: "foot", zOrderIndex: 3,
    content: HINT_HOME, textColor: 2,
  });
  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: [title, status, hint],
    menuObject: menuOf([
      [MENU_HOME_INBOX, "Open inbox"],
      [MENU_HOME_LINK, "Link with code"],
      [MENU_HOME_BRIEF, "Channel brief"],
      [MENU_HOME_REFRESH, "Refresh inbox"],
    ]),
  });
}

// Home is the startup page; returning to it rebuilds the same layout.
async function showHome() {
  screen = "home";
  const page = new RebuildPageContainer({
    containerTotalNum: 3,
    textObject: [
      new TextContainerProperty({
        xPosition: 24, yPosition: 20, width: 528, height: 60,
        containerID: TITLE_ID, containerName: "title", zOrderIndex: 1,
        content: "PaperPlane", textColor: 4,
      }),
      new TextContainerProperty({
        xPosition: 24, yPosition: 96, width: 528, height: 64,
        containerID: MAIN_ID, containerName: "main", zOrderIndex: 2,
        content: homeStatus(), textColor: 3, isEventCapture: 1,
      }),
      new TextContainerProperty({
        xPosition: 24, yPosition: 176, width: 528, height: 48,
        containerID: FOOT_ID, containerName: "foot", zOrderIndex: 3,
        content: HINT_HOME, textColor: 2,
      }),
    ],
    menuObject: menuOf([
      [MENU_HOME_INBOX, "Open inbox"],
      [MENU_HOME_LINK, "Link with code"],
      [MENU_HOME_BRIEF, "Channel brief"],
      [MENU_HOME_REFRESH, "Refresh inbox"],
    ]),
  });
  await rebuild(page, "home");
}

// ---------- pairing ----------

function codeProgress() {
  const padded = (enteredCode + "------").slice(0, 6);
  return `Code: ${padded.split("").join(" ")}`;
}

async function showPair() {
  screen = "pair";
  enteredCode = "";
  lastListIndex = 0;
  const page = new RebuildPageContainer({
    containerTotalNum: 4,
    textObject: [
      titleBox("Link PaperPlane"),
      new TextContainerProperty({
        xPosition: 24, yPosition: 60, width: 528, height: 44,
        containerID: MAIN_ID, containerName: "main", zOrderIndex: 2,
        content: codeProgress(), textColor: 3,
      }),
      footBox("Send /pair to the bot, then scroll to each digit and tap."),
    ],
    listObject: [listBox(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], 112, 108)],
    menuObject: menuOf([
      [MENU_PAIR_CLEAR, "Clear code"],
      [MENU_PAIR_BACK, "Back"],
    ]),
  });
  await rebuild(page, "pair");
}

async function pickDigit(index) {
  if (enteredCode.length >= 6) return;
  enteredCode += String(index);
  log("pair: digit entered, length", enteredCode.length);
  await upgrade(MAIN_ID, "main", codeProgress());
  if (enteredCode.length === 6) {
    await validateEnteredCode();
  }
}

async function validateEnteredCode() {
  await setFoot("Checking the code...");
  try {
    if (!deviceId) deviceId = await ensureDeviceId();
    const data = await api("/api/pairing/validate", {
      method: "POST",
      body: JSON.stringify({ code: enteredCode, deviceId }),
    });
    if (data && data.linked) {
      link = { userId: String(data.userId), linkedAt: new Date().toISOString() };
      await bridge.setLocalStorage(LINK_KEY, JSON.stringify(link));
      log("pair: linked as user", link.userId);
      await showHome();
      return;
    }
    log("pair: code rejected:", JSON.stringify(data));
    enteredCode = "";
    await upgrade(MAIN_ID, "main", codeProgress());
    if (data && data.error === "expired-code") {
      await setFoot("That code has expired. Send /pair to the bot for a fresh one.");
    } else {
      await setFoot("That code did not work. Check the digits, or send /pair for a new one.");
    }
  } catch (err) {
    log("pair: validate failed:", err);
    enteredCode = "";
    await upgrade(MAIN_ID, "main", codeProgress());
    await setFoot("Backend unreachable. Try again in a moment.");
  }
}

// ---------- inbox ----------

function inboxLine(chat) {
  // Plain slice, no ellipsis: list items have a tight byte budget on the
  // lens, and a multi-byte ellipsis can push a 64-char line over it.
  if (!chat.latest) return `${chat.title} - no messages yet`.slice(0, 60);
  const sender = chat.latest.senderName || chat.title;
  return `${chat.title} (${chat.unread}) ${sender}: ${chat.latest.text}`
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

async function fetchSummary() {
  const data = await api(`/api/inbox/summary?userId=${encodeURIComponent(link.userId)}`);
  summaryChats = (data && data.chats) || [];
  return summaryChats;
}

async function showInbox() {
  if (!link) {
    await showPair();
    return;
  }
  screen = "inbox";
  lastListIndex = 0;
  let items;
  let header;
  try {
    const chats = await fetchSummary();
    items = chats.length ? chats.map(inboxLine) : ["No watched chats yet"];
    const unreadTotal = chats.reduce((sum, chat) => sum + chat.unread, 0);
    header = `${unreadTotal} unread in ${chats.length} watched ${chats.length === 1 ? "chat" : "chats"}`;
  } catch (err) {
    log("inbox: summary fetch failed:", err);
    items = ["Backend unreachable - try Refresh"];
    header = "Inbox unavailable";
    summaryChats = [];
  }
  const page = new RebuildPageContainer({
    containerTotalNum: 4,
    textObject: [
      titleBox("Inbox"),
      new TextContainerProperty({
        xPosition: 24, yPosition: 60, width: 528, height: 44,
        containerID: MAIN_ID, containerName: "main", zOrderIndex: 2,
        content: header, textColor: 3,
      }),
      footBox("Tap a chat to read it - double-tap for home."),
    ],
    listObject: [listBox(items, 112, 108, 5)],
    menuObject: menuOf([
      [MENU_INBOX_REFRESH, "Refresh inbox"],
      [MENU_INBOX_HOME, "Home"],
    ]),
  });
  await rebuild(page, "inbox");
}

async function openChat(index) {
  const chat = summaryChats[index];
  if (!chat) {
    log("inbox: no chat at index", index);
    return;
  }
  await openChatObject(chat);
}

async function openChatObject(chat) {
  cardChat = chat;
  cardLoadFailed = false;
  try {
    const data = await api(
      `/api/inbox?userId=${encodeURIComponent(link.userId)}&chatId=${encodeURIComponent(chat.chatId)}`
    );
    cardMessages = (data && data.items) || [];
  } catch (err) {
    log("inbox: message fetch failed:", err);
    cardMessages = [];
    cardLoadFailed = true;
  }
  cardIndex = 0;
  await showCard();
}

// ---------- message card ----------

function cardText(message) {
  const sender = message.senderName || message.chatTitle || "Unknown";
  const time = formatTime(message.sentAt);
  const head = time ? `${sender} - ${time}` : sender;
  return truncate(`${head}\n${message.text}`, 440);
}

async function showCard() {
  screen = "card";
  const message = cardMessages[cardIndex];
  const body = message
    ? cardText(message)
    : cardLoadFailed
      ? "Messages could not load.\nThe backend may be down - try again in a moment."
      : "No messages in this chat yet.";
  const foot = message
    ? `${cardIndex + 1} of ${cardMessages.length} - tap to reply, long-press for voice, scroll for more.`
    : "Double-tap to go back.";
  const page = new RebuildPageContainer({
    containerTotalNum: 3,
    textObject: [
      titleBox(truncate(cardChat ? cardChat.title : "Message", 40)),
      mainBox(body, true),
      footBox(foot),
    ],
    menuObject: menuOf([
      [MENU_CARD_REPLY, "Reply"],
      [MENU_CARD_VOICE, "Voice"],
      [MENU_CARD_BRIEF, "Brief"],
      [MENU_CARD_INBOX, "Back to inbox"],
    ]),
  });
  await rebuild(page, "card");
  if (message && typeof message.messageId === "number") {
    try {
      await api("/api/inbox/read", {
        method: "POST",
        body: JSON.stringify({
          userId: link.userId,
          chatId: cardChat.chatId,
          messageId: message.messageId,
        }),
      });
      log("card: marked read", message.messageId);
    } catch (err) {
      log("card: read mark failed:", err);
    }
  }
}

async function cycleCard(delta) {
  const next = cardIndex + delta;
  if (next < 0 || next >= cardMessages.length) {
    log("card: no message at", next);
    return;
  }
  cardIndex = next;
  await showCard();
}

// ---------- channel brief (Day 5) ----------

// One glanceable stack for everything new in the watched channels:
// a header line with the totals, then per channel a header row and the
// key posts (newest first, already shortened by the backend). Plain
// slices again - list rows have the same tight byte budget as the
// inbox, so no multi-byte ellipsis goes into a row.
function briefLine(text) {
  return String(text || "").replace(/\s+/g, " ").slice(0, 58);
}

async function showBrief() {
  if (!link) {
    await showPair();
    return;
  }
  screen = "brief";
  lastListIndex = 0;
  briefData = null;
  briefEntries = [];
  try {
    briefData = await api(`/api/brief?userId=${encodeURIComponent(link.userId)}`);
  } catch (err) {
    log("brief: fetch failed:", err);
  }
  if (!briefData || !briefData.ok) {
    const page = new RebuildPageContainer({
      containerTotalNum: 3,
      textObject: [
        titleBox("Channel brief"),
        mainBox("The brief is unavailable right now. Try again in a moment.", true),
        footBox("Double-tap for home."),
      ],
      menuObject: menuOf([[MENU_BRIEF_HOME, "Home"]]),
    });
    await rebuild(page, "brief-error");
    return;
  }
  const totalNew = briefData.totalNew || 0;
  const channels = briefData.channels || [];
  log("brief:", totalNew, "new posts in", channels.length, "channels since", briefData.since || "the start");
  if (!totalNew) {
    const page = new RebuildPageContainer({
      containerTotalNum: 3,
      textObject: [
        titleBox("Channel brief"),
        mainBox("All caught up.\nNo new posts in your watched channels since the last brief.", true),
        footBox("Double-tap for home."),
      ],
      menuObject: menuOf([[MENU_BRIEF_HOME, "Home"]]),
    });
    await rebuild(page, "brief-empty");
    return;
  }
  for (const channel of channels) {
    briefEntries.push({
      chatId: channel.chatId,
      title: channel.title,
      label: briefLine(`${channel.title} - ${channel.count} new`),
    });
    for (const post of channel.posts) {
      briefEntries.push({
        chatId: channel.chatId,
        title: channel.title,
        label: briefLine(post.text),
      });
    }
  }
  const items = briefEntries.map((entry) => entry.label);
  const header = `${totalNew} new in ${channels.length} ${channels.length === 1 ? "channel" : "channels"}`;
  const page = new RebuildPageContainer({
    containerTotalNum: 4,
    textObject: [
      titleBox("Channel brief"),
      new TextContainerProperty({
        // Same screen budget as the replies screen: header one line
        // at y=58, three list rows at 94-214, footer at 228.
        xPosition: 24, yPosition: 58, width: 528, height: 30,
        containerID: MAIN_ID, containerName: "main", zOrderIndex: 2,
        content: truncate(header, 46), textColor: 3,
      }),
      footBox("Tap a post to open it - double-tap marks the brief read."),
    ],
    // The brief list gets its own container id (7), like every other
    // screen's list (ids cannot repeat across rebuilds, Day 2 quirk).
    listObject: [listBox(items, 94, 124, 7)],
    menuObject: menuOf([
      [MENU_BRIEF_MARK, "Mark brief read"],
      [MENU_BRIEF_HOME, "Home"],
    ]),
  });
  await rebuild(page, "brief");
}

async function markBriefRead() {
  if (!link) return;
  try {
    const data = await api("/api/brief/mark", {
      method: "POST",
      body: JSON.stringify({ userId: link.userId }),
    });
    log("brief: marked read:", JSON.stringify(data));
  } catch (err) {
    log("brief: mark failed:", err);
  }
}

async function openBriefEntry(index) {
  const entry = briefEntries[index];
  if (!entry) {
    log("brief: no entry at index", index);
    return;
  }
  const known = summaryChats.find((chat) => chat.chatId === entry.chatId);
  const chat = known || { chatId: entry.chatId, title: entry.title, kind: "channel" };
  await openChatObject(chat);
}

// ---------- smart replies ----------

// Three short contextual suggestions, generated locally on the glasses
// from the message text alone - no external AI service is involved.
// Keyed to the shape of the message: a question gets answer-shaped
// replies, thanks gets gracious ones, an announcement gets reactions,
// a greeting gets greetings, and anything else gets safe acknowledgements.
// Each shape has three tones (Day 5): casual is the everyday set, short
// is terse one-liners, formal is polite complete sentences. The tone
// comes from the Mini App settings through the backend.
const REPLY_SETS = {
  question: {
    casual: [
      "Good question - let me check and reply.",
      "Yes, that works for me.",
      "Not sure yet - I will confirm soon.",
    ],
    short: ["Yes, works for me.", "Let me check.", "Will confirm soon."],
    formal: [
      "Thank you - I will check and reply.",
      "Yes, that arrangement works for me.",
      "I will confirm shortly, thank you.",
    ],
  },
  thanks: {
    casual: ["You are welcome!", "Anytime - happy to help.", "Glad it helped."],
    short: ["Anytime.", "Welcome!", "Glad it helped."],
    formal: ["You are most welcome.", "It is my pleasure - anytime.", "Glad I could be of help."],
  },
  greeting: {
    casual: ["Hey! Good to see you here.", "Hi there - thanks for the ping.", "Hello! What is new?"],
    short: ["Hey!", "Hi there.", "Hello!"],
    formal: ["Hello, good to hear from you.", "Good day - thank you for writing.", "Hello! I hope you are well."],
  },
  announcement: {
    casual: ["Great news - congrats to the team!", "Exciting - checking it out now.", "Thanks for the update."],
    short: ["Congrats!", "Checking it out.", "Thanks!"],
    formal: ["Congratulations to the whole team.", "Thank you - I will take a look now.", "Wonderful news, thank you for sharing."],
  },
  check: {
    casual: ["Got it - the feed is coming through.", "Seen - looks good from here.", "Received, loud and clear."],
    short: ["Got it.", "Seen - looks good.", "Received."],
    formal: ["Received - everything looks correct.", "Thank you, I have seen it now.", "Confirmed - it came through clearly."],
  },
  fallback: {
    casual: ["Got it - thanks!", "Sounds good.", "On it."],
    short: ["Got it.", "Sounds good.", "On it."],
    formal: ["Understood - thank you.", "That sounds good to me.", "Thank you, I am on it."],
  },
};

function smartRepliesFor(message, tone) {
  const text = String((message && message.text) || "");
  const padded = ` ${text.toLowerCase()} `;
  const has = (...words) => words.some((word) => padded.includes(word));
  let shape;
  if (text.includes("?")) {
    shape = "question";
  } else if (has("thank", "thanks", "thx")) {
    shape = "thanks";
  } else if (has(" hi ", " hello ", " hey ", " gm ", "good morning", "good evening")) {
    shape = "greeting";
  } else if (has("launch", "live now", "just dropped", " update", "release", "announcing", " new ")) {
    shape = "announcement";
  } else if (has("test", "checking", "check")) {
    shape = "check";
  } else {
    shape = "fallback";
  }
  const set = REPLY_SETS[shape];
  const picks = set[tone] || set.casual;
  // One line per suggestion, guaranteed: list rows have a fixed 40 px
  // height and roughly a 44 character budget at the lens font, so every
  // suggestion is capped before it is shown - and the capped text is
  // exactly what gets sent when the user taps it.
  return [...new Set(picks)].slice(0, 3).map((line) => capLine(line, 44));
}

async function fetchReplyTone() {
  if (!link) return;
  try {
    const data = await api(`/api/settings?userId=${encodeURIComponent(link.userId)}`);
    if (data && data.replyTone) {
      replyTone = data.replyTone;
      log("replies: tone is", replyTone);
    }
  } catch (err) {
    log("replies: settings fetch failed, keeping tone", replyTone, err);
  }
}

function capLine(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 12 ? cut.slice(0, lastSpace) : cut).trim();
}

async function showReplies() {
  const message = cardMessages[cardIndex];
  if (!message) {
    await setFoot("No message to reply to.");
    return;
  }
  screen = "replies";
  lastListIndex = 0;
  await fetchReplyTone();
  replyOptions = smartRepliesFor(message, replyTone);
  const sender = message.senderName || message.chatTitle || "the chat";
  const page = new RebuildPageContainer({
    containerTotalNum: 4,
    textObject: [
      titleBox("Reply"),
      new TextContainerProperty({
        // One line only, tight under the title: the list rows below are
        // a fixed 40 px each, so the whole screen is budgeted to keep
        // three rows plus this header and the footer inside 288 px
        // with no overlap (Day 4 fix - the Day 3 layout put the third
        // row's box at 192-232, over the footer at 228).
        xPosition: 24, yPosition: 58, width: 528, height: 30,
        containerID: MAIN_ID, containerName: "main", zOrderIndex: 2,
        content: truncate(`To ${sender}: ${message.text}`, 46), textColor: 3,
      }),
      footBox(`Tone: ${replyTone} - tap a reply to send it, double-tap to go back.`),
    ],
    // The replies list gets its own container id (6): reusing an id
    // across screens breaks rebuilds (Day 2 quirk). Rows: 94-134,
    // 134-174, 174-214 - the footer starts at 228, so nothing touches.
    listObject: [listBox(replyOptions, 94, 124, 6)],
    menuObject: menuOf([[MENU_REPLY_BACK, "Back to message"]]),
  });
  await rebuild(page, "replies");
}

async function sendReply(text) {
  const message = cardMessages[cardIndex];
  if (!message || !cardChat || !link) return;
  log("reply: sending", JSON.stringify(text), "threaded to message", message.messageId);
  try {
    const body = {
      userId: link.userId,
      chatId: cardChat.chatId,
      text,
    };
    if (typeof message.messageId === "number") body.replyToMessageId = message.messageId;
    const data = await api("/api/reply", { method: "POST", body: JSON.stringify(body) });
    if (data && data.queued) {
      // Back to the card with the confirmation on its footer.
      await showCard();
      await setFoot(`Reply sent: ${truncate(text, 44)}`);
      return;
    }
    log("reply: queue rejected:", JSON.stringify(data));
    await setFoot("The reply could not be queued. Try again.");
  } catch (err) {
    log("reply: send failed:", err);
    await setFoot("Backend unreachable. Try again in a moment.");
  }
}

// ---------- voice replies (Day 4) ----------

// The SDK delivers audioPcm as a Uint8Array after its JSON parsing, but
// the raw host payload can also be a number array or a base64 string -
// normalize every chunk to bytes before counting or storing it.
function pcmChunkToBytes(pcm) {
  if (!pcm) return new Uint8Array(0);
  if (pcm instanceof Uint8Array) return pcm;
  if (Array.isArray(pcm)) return Uint8Array.from(pcm);
  if (typeof pcm === "string") {
    try {
      const bin = atob(pcm);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch {
      return new Uint8Array(0);
    }
  }
  if (typeof pcm === "object" && typeof pcm.length === "number") {
    return Uint8Array.from(pcm);
  }
  return new Uint8Array(0);
}

function concatChunks(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function bytesToBase64(bytes) {
  let binary = "";
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + STEP));
  }
  return btoa(binary);
}

async function showVoice() {
  const message = cardMessages[cardIndex];
  if (!message) {
    await setFoot("No message to reply to.");
    return;
  }
  screen = "voice";
  voicePhase = "idle";
  voiceTranscript = "";
  const sender = message.senderName || message.chatTitle || "the chat";
  const page = new RebuildPageContainer({
    containerTotalNum: 3,
    textObject: [
      titleBox("Voice reply"),
      mainBox(truncate(`To ${sender}: ${message.text}`, 120), true),
      footBox("Tap to record - double-tap to go back."),
    ],
    menuObject: menuOf([[MENU_VOICE_BACK, "Back to message"]]),
  });
  await rebuild(page, "voice");
}

async function startRecording() {
  voiceChunks = [];
  voiceFrames = 0;
  voiceBytes = 0;
  voiceChunkSize = 0;
  voiceTranscript = "";
  // Show the recording state BEFORE opening the mic: the event handler
  // drops events while a screen change runs, so no PCM frame may land
  // while an upgrade is still in flight.
  await upgrade(MAIN_ID, "main", "Recording - speak now.");
  await setFoot("Tap to stop - double-tap to cancel.");
  let opened = false;
  try {
    opened = await bridge.audioControl(true, AudioInputSource.Glasses);
  } catch (err) {
    log("voice: audioControl open failed:", err);
  }
  log("voice: audioControl(true, Glasses) returned", opened);
  if (!opened) {
    voicePhase = "idle";
    await upgrade(MAIN_ID, "main", "The microphone did not open.");
    await setFoot("Tap to try again - double-tap to go back.");
    return;
  }
  voicePhase = "recording";
}

async function stopRecording() {
  voicePhase = "transcribing";
  try {
    await bridge.audioControl(false);
  } catch (err) {
    log("voice: audioControl close failed:", err);
  }
  const seconds = voiceBytes / 32000; // 16 kHz, 16-bit, mono
  log(
    "voice: recording stopped -", voiceFrames, "frames,", voiceBytes,
    "bytes, chunk", voiceChunkSize, "bytes, about", seconds.toFixed(1),
    "s at 16 kHz 16-bit mono"
  );
  if (!voiceBytes) {
    voicePhase = "idle";
    await upgrade(MAIN_ID, "main", "No audio was captured.");
    await setFoot("Tap to record - double-tap to go back.");
    return;
  }
  const pcm = concatChunks(voiceChunks);
  voiceChunks = [];
  await upgrade(MAIN_ID, "main", "Transcribing...");
  await setFoot("One moment - turning your words into text.");
  try {
    const data = await api("/api/voice/transcribe", {
      method: "POST",
      body: JSON.stringify({ userId: link.userId, audioBase64: bytesToBase64(pcm) }),
    });
    if (!data || !data.jobId) throw new Error("no job id in response");
    voiceJobId = data.jobId;
    log("voice: transcribe job queued:", voiceJobId);
    pollTranscript();
  } catch (err) {
    log("voice: transcribe upload failed:", err);
    voicePhase = "idle";
    await upgrade(MAIN_ID, "main", "The upload failed - nothing was sent.");
    await setFoot("Tap to record - double-tap to go back.");
  }
}

async function pollTranscript() {
  for (let attempt = 0; attempt < 45 && voicePhase === "transcribing"; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const data = await api(`/api/voice/result?jobId=${encodeURIComponent(voiceJobId)}`);
      if (data && data.status === "done") {
        voiceTranscript = (data.text || "").trim();
        voicePhase = "review";
        log("voice: transcript ready:", JSON.stringify(voiceTranscript));
        if (voiceTranscript) {
          await upgrade(MAIN_ID, "main", truncate(`You said: ${voiceTranscript}`, 200));
          await setFoot("Tap to send - long-press to re-record, double-tap to drop it.");
        } else {
          await upgrade(MAIN_ID, "main", "Nothing was understood - the clip may be silent.");
          await setFoot("Long-press to re-record - double-tap to go back.");
        }
        return;
      }
    } catch (err) {
      log("voice: result poll failed:", err);
    }
  }
  if (voicePhase === "transcribing") {
    voicePhase = "idle";
    await upgrade(MAIN_ID, "main", "Transcription timed out - nothing was sent.");
    await setFoot("Tap to record - double-tap to go back.");
  }
}

async function cancelRecording() {
  try {
    await bridge.audioControl(false);
  } catch (err) {
    log("voice: audioControl close failed:", err);
  }
  voicePhase = "idle";
  voiceChunks = [];
  log("voice: recording cancelled, nothing sent");
  await showCard();
}

async function approveVoice() {
  const text = voiceTranscript;
  voicePhase = "idle";
  voiceTranscript = "";
  if (text) await sendReply(text);
}

// ---------- identity ----------

async function ensureDeviceId() {
  try {
    const stored = await bridge.getLocalStorage(DEVICE_KEY);
    if (stored) return stored;
  } catch (err) {
    log("device id read failed:", err);
  }
  const fresh = `g2-${Math.floor(100000 + Math.random() * 900000)}`;
  try {
    await bridge.setLocalStorage(DEVICE_KEY, fresh);
  } catch (err) {
    log("device id store failed:", err);
  }
  return fresh;
}

async function loadLink() {
  try {
    deviceId = await ensureDeviceId();
    const raw = await bridge.getLocalStorage(LINK_KEY);
    log("link storage read:", JSON.stringify(raw));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.userId) {
        link = parsed;
        log("link restored from storage for user", link.userId);
      }
    }
  } catch (err) {
    log("link load failed:", err);
  }
}

// ---------- events ----------

async function activateListSelection(index) {
  if (screen === "pair") {
    await pickDigit(index);
  } else if (screen === "inbox") {
    await openChat(index);
  } else if (screen === "brief") {
    await openBriefEntry(index);
  } else if (screen === "replies") {
    const text = replyOptions[index];
    if (text) await sendReply(text);
    else log("replies: no suggestion at index", index);
  }
}

async function handleGesture(eventType, source) {
  const from = sourceName(source);
  log("gesture:", eventType, "from", from, "on screen", screen);
  if (eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
    if (screen === "inbox") await showInbox();
    else if (screen === "card") await showCard();
    else if (screen === "brief") await showBrief();
    else if (screen === "replies") await showReplies();
    return;
  }
  if (eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT) return;

  if (screen === "home") {
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      if (link) await showInbox();
      else await showPair();
    } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      await upgrade(MAIN_ID, "main", STATUS_HELP);
    } else if (eventType === OsEventTypeList.LONG_PRESS_EVENT) {
      if (link) await showBrief();
      else await showPair();
    }
    return;
  }
  if (screen === "pair") {
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) await showHome();
    return;
  }
  if (screen === "inbox") {
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) await showHome();
    return;
  }
  if (screen === "brief") {
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      // Leaving the brief clears it: the watermark moves to now, so
      // the next brief only carries posts from after this one.
      await markBriefRead();
      await showHome();
    }
    return;
  }
  if (screen === "card") {
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      await showReplies();
    } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      await showInbox();
    } else if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      await cycleCard(1); // older
    } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      await cycleCard(-1); // newer
    } else if (eventType === OsEventTypeList.LONG_PRESS_EVENT) {
      await showVoice();
    }
    return;
  }
  if (screen === "replies") {
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      await showCard();
    }
    return;
  }
  if (screen === "voice") {
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      if (voicePhase === "idle") await startRecording();
      else if (voicePhase === "recording") await stopRecording();
      else if (voicePhase === "review" && voiceTranscript) await approveVoice();
    } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      if (voicePhase === "recording") await cancelRecording();
      else {
        voicePhase = "idle";
        await showCard();
      }
    } else if (eventType === OsEventTypeList.LONG_PRESS_EVENT) {
      if (voicePhase === "review") await startRecording();
    }
    return;
  }
}

async function handleMenuClick(itemId) {
  log("menu: item clicked", itemId, "on screen", screen);
  switch (itemId) {
    case MENU_HOME_INBOX:
      if (link) await showInbox();
      else await showPair();
      break;
    case MENU_HOME_LINK:
      await showPair();
      break;
    case MENU_HOME_REFRESH:
      if (link) await showInbox();
      else await setFoot("Link first, then the inbox can refresh.");
      break;
    case MENU_HOME_BRIEF:
      if (link) await showBrief();
      else await showPair();
      break;
    case MENU_PAIR_CLEAR:
      enteredCode = "";
      await upgrade(MAIN_ID, "main", codeProgress());
      break;
    case MENU_PAIR_BACK:
      await showHome();
      break;
    case MENU_INBOX_REFRESH:
      await showInbox();
      break;
    case MENU_INBOX_HOME:
      await showHome();
      break;
    case MENU_CARD_REPLY:
      await showReplies();
      break;
    case MENU_REPLY_BACK:
      await showCard();
      break;
    case MENU_CARD_VOICE:
      await showVoice();
      break;
    case MENU_VOICE_BACK:
      voicePhase = "idle";
      await showCard();
      break;
    case MENU_CARD_BRIEF:
      await showBrief();
      break;
    case MENU_BRIEF_MARK:
      await markBriefRead();
      await showHome();
      break;
    case MENU_BRIEF_HOME:
      await showHome();
      break;
    case MENU_CARD_INBOX:
      await showInbox();
      break;
    default:
      log("menu: unknown item id", itemId);
  }
}

function subscribeToEvents() {
  bridge.onEvenHubEvent(async (event) => {
    if (busy) {
      log("event dropped while a screen change is running");
      return;
    }
    busy = true;
    try {
      if (event.menuItemClickEvent) {
        await handleMenuClick(event.menuItemClickEvent.itemID);
        return;
      }
      if (event.listEvent) {
        const listEvent = event.listEvent;
        const hasIndex = typeof listEvent.currentSelectItemIndex === "number";
        if (hasIndex) lastListIndex = listEvent.currentSelectItemIndex;
        const type = listEvent.eventType;
        const normalized = type === undefined || type === null ? undefined : OsEventTypeList.fromJson(type);
        log("list event: index", hasIndex ? listEvent.currentSelectItemIndex : "(absent)", "type", type);
        if (normalized === OsEventTypeList.CLICK_EVENT) {
          await activateListSelection(lastListIndex);
        } else if (normalized === OsEventTypeList.DOUBLE_CLICK_EVENT) {
          await handleGesture(OsEventTypeList.DOUBLE_CLICK_EVENT, listEvent.eventSource);
        } else if (normalized !== undefined) {
          // Typed scroll event: the index above is all we need.
        } else {
          // Typeless list event = a click. CLICK_EVENT is enum 0 and
          // this host drops zero-valued fields from the event JSON -
          // the same reason a missing currentSelectItemIndex means the
          // selection is index 0 (verified in the simulator, Day 2).
          const index = hasIndex ? listEvent.currentSelectItemIndex : 0;
          lastListIndex = index;
          await activateListSelection(index);
        }
        return;
      }
      const type =
        event.textEvent?.eventType ??
        event.sysEvent?.eventType;
      const source = event.sysEvent?.eventSource ?? event.textEvent?.eventSource;
      if (type !== undefined && type !== null) {
        const normalized = OsEventTypeList.fromJson(type);
        if (normalized !== undefined) {
          await handleGesture(normalized, source);
          return;
        }
      }
      // Simulator quirk (verified Day 1): a single tap arrives as a
      // sysEvent carrying only an eventSource and no eventType at all.
      // CLICK_EVENT is enum 0 and this build drops the field. Real
      // hardware sends eventType 0, which the branch above handles.
      if (source !== undefined && source !== null) {
        log("gesture: tap without an event type, treating as click on", screen);
        if (screen === "pair" || screen === "inbox") {
          await activateListSelection(lastListIndex);
        } else {
          await handleGesture(OsEventTypeList.CLICK_EVENT, source);
        }
        return;
      }
      if (event.audioEvent) {
        // PCM frames from the glasses mic (Day 4). While recording,
        // every frame is counted and stored; the totals are the proof
        // of the audio path, so they are logged as they arrive.
        const bytes = pcmChunkToBytes(event.audioEvent.audioPcm);
        if (voicePhase === "recording" && bytes.length) {
          voiceChunks.push(bytes);
          voiceFrames += 1;
          voiceBytes += bytes.length;
          if (voiceFrames === 1) voiceChunkSize = bytes.length;
          if (voiceFrames === 1 || voiceFrames % 10 === 0) {
            log("voice: frame", voiceFrames, "- chunk", bytes.length, "bytes, total", voiceBytes, "bytes");
          }
        } else {
          log("audio: PCM frame outside recording,", bytes.length, "bytes");
        }
        return;
      }
      log("event: unhandled shape", JSON.stringify(event).slice(0, 200));
    } catch (err) {
      log("event handler error:", err);
    } finally {
      busy = false;
    }
  });
  log("subscribed to lens events");
}

// ---------- boot ----------

async function startWithBridge() {
  await loadLink();
  const page = buildHomePage();
  const check = validateEvenHubPageContainer(page);
  log("page validation:", JSON.stringify(check));
  const result = await bridge.createStartUpPageContainer(page);
  log("startup page created, result:", result);
  if (result !== StartUpPageCreateResult.success) {
    log("startup page creation did not return success");
    return;
  }
  subscribeToEvents();
  log("PaperPlane Day 5 is live on the glasses, linked:", Boolean(link));
}

function startPreviewMode() {
  document.getElementById("preview").style.display = "block";
  log("preview mode: no glasses bridge, rendering in the phone pane");
}

async function main() {
  log("PaperPlane starting, waiting for the glasses bridge...");
  try {
    bridge = await Promise.race([
      waitForEvenAppBridge(),
      new Promise((resolve) => setTimeout(() => resolve(null), BRIDGE_WAIT_MS)),
    ]);
  } catch (err) {
    log("bridge wait failed:", err);
    bridge = null;
  }
  if (bridge) {
    log("glasses bridge ready");
    await startWithBridge();
  } else {
    startPreviewMode();
  }
}

main();
