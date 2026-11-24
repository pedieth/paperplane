// PaperPlane Mini App settings page - served by the backend at /miniapp.
// Written during the hackathon build window (Nov 23-29, 2026).
//
// Plain HTML, CSS and JS in one file, no build step. The page talks to
// the same API the glasses use. Sign-in is the one-time 6-digit pairing
// code from the bot (see the note at the top of worker/src/index.js for
// why Telegram initData cannot be checked here): the code is exchanged
// once for a session token, and the token authorizes the state and
// settings calls below. No underscores are used in any name or text on
// this page, matching the project style rule.

export const MINIAPP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PaperPlane settings</title>
<style>
  :root {
    --ink: #17211b;
    --muted: #5c6a61;
    --line: #dde5df;
    --accent: #0e7a3d;
    --accent-dark: #0a5c2e;
    --card: #ffffff;
    --page: #f3f6f4;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: var(--page);
    color: var(--ink);
    line-height: 1.45;
  }
  .wrap { max-width: 560px; margin: 0 auto; padding: 20px 16px 40px; }
  header { padding: 12px 4px 4px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 0 0 8px; }
  .sub { color: var(--muted); margin: 0 0 16px; }
  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 14px;
  }
  .card p { margin: 0 0 10px; }
  .card p:last-child { margin-bottom: 0; }
  .muted { color: var(--muted); }
  .small { font-size: 13px; }
  label { display: block; font-weight: 600; margin-bottom: 6px; }
  input[type="text"] {
    width: 100%;
    font-size: 20px;
    letter-spacing: 6px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    margin-bottom: 10px;
  }
  button {
    appearance: none;
    border: 0;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    padding: 10px 18px;
    cursor: pointer;
  }
  button:hover { background: var(--accent-dark); }
  button.secondary { background: #e7ede9; color: var(--ink); }
  .status { min-height: 20px; margin-top: 10px; font-size: 14px; }
  .status.error { color: #b3261e; }
  .status.ok { color: var(--accent-dark); }
  .chat { padding: 10px 0; border-top: 1px solid var(--line); }
  .chat:first-of-type { border-top: 0; padding-top: 2px; }
  .chat-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .chat-title { font-weight: 700; }
  .chip {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    background: #e7ede9;
    border-radius: 999px;
    padding: 2px 8px;
    color: var(--muted);
  }
  .unread { color: var(--accent-dark); font-weight: 700; font-size: 13px; }
  .latest { color: var(--muted); font-size: 14px; margin-top: 2px; }
  .tone-option {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 8px;
    cursor: pointer;
  }
  .tone-option input { margin-top: 3px; }
  .tone-name { font-weight: 700; display: block; }
  .tone-desc { color: var(--muted); font-size: 13px; display: block; }
  .hidden { display: none; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>PaperPlane settings</h1>
    <p class="sub">Your Telegram, on your lens. This page tunes how PaperPlane behaves on your glasses.</p>
  </header>

  <section class="card" id="connect-card">
    <h2>Connect this page</h2>
    <p>Open the PaperPlane bot in Telegram, send <strong>/pair</strong>, and type the 6-digit code it gives you here. The code works once and expires in 10 minutes.</p>
    <label for="code-input">Pairing code</label>
    <input type="text" id="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456">
    <button id="connect-btn" type="button">Connect</button>
    <p class="status" id="connect-status"></p>
    <p class="muted small">Why a code, and not the usual Telegram sign-in inside a Mini App? The bot token stays inside a secure store and never reaches this server, so the standard Mini App signature check cannot run here. A one-time code from the bot is the sign-in instead - same idea, and the token stays put.</p>
  </section>

  <section class="card hidden" id="watchlist-card">
    <h2>Watched chats</h2>
    <p class="muted small">Only these chats can reach your lens. Everything else stays on your phone.</p>
    <div id="watchlist"></div>
  </section>

  <section class="card hidden" id="tone-card">
    <h2>Reply tone</h2>
    <p class="muted small">Smart replies on the glasses are written in this tone. Pick one and save - the glasses pick it up the next time you open a reply.</p>
    <div id="tone-options"></div>
    <button id="tone-save" type="button">Save tone</button>
    <p class="status" id="tone-status"></p>
  </section>

  <section class="card hidden" id="signout-card">
    <button class="secondary" id="signout-btn" type="button">Disconnect this page</button>
    <p class="muted small" style="margin-top:10px;">Disconnecting forgets the session on this device only. Your glasses stay linked.</p>
  </section>
</div>

<script>
"use strict";
var SESSION_KEY = "paperplane-session";
var TONES = [
  { id: "casual", name: "Casual", desc: "Friendly, natural replies - the everyday set." },
  { id: "short", name: "Short", desc: "Terse one-liners for quick answers." },
  { id: "formal", name: "Formal", desc: "Polite, complete sentences." }
];
var sessionToken = sessionStorage.getItem(SESSION_KEY) || "";
var currentTone = "casual";

function el(id) { return document.getElementById(id); }

function setStatus(id, text, kind) {
  var node = el(id);
  node.textContent = text;
  node.className = "status" + (kind ? " " + kind : "");
}

function api(path, options) {
  var headers = { "content-type": "application/json" };
  if (sessionToken) headers["authorization"] = "Bearer " + sessionToken;
  var init = { method: "GET", headers: headers };
  if (options) {
    if (options.method) init.method = options.method;
    if (options.body) init.body = JSON.stringify(options.body);
  }
  return fetch(path, init).then(function (res) {
    return res.json().then(function (data) { return { status: res.status, data: data }; });
  });
}

function renderWatchlist(chats) {
  var box = el("watchlist");
  box.textContent = "";
  if (!chats.length) {
    var empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No watched chats yet. The bot adds the demo chats automatically.";
    box.appendChild(empty);
    return;
  }
  chats.forEach(function (chat) {
    var row = document.createElement("div");
    row.className = "chat";
    var head = document.createElement("div");
    head.className = "chat-head";
    var title = document.createElement("span");
    title.className = "chat-title";
    title.textContent = chat.title || "Untitled chat";
    head.appendChild(title);
    var chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = chat.kind || "chat";
    head.appendChild(chip);
    if (chat.unread) {
      var unread = document.createElement("span");
      unread.className = "unread";
      unread.textContent = chat.unread + " unread";
      head.appendChild(unread);
    }
    row.appendChild(head);
    var latest = document.createElement("p");
    latest.className = "latest";
    if (chat.latest) {
      latest.textContent = (chat.latest.senderName || chat.title) + ": " + chat.latest.text;
    } else {
      latest.textContent = "No messages yet.";
    }
    row.appendChild(latest);
    box.appendChild(row);
  });
}

function renderTones() {
  var box = el("tone-options");
  box.textContent = "";
  TONES.forEach(function (tone) {
    var label = document.createElement("label");
    label.className = "tone-option";
    var radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "tone";
    radio.value = tone.id;
    radio.checked = tone.id === currentTone;
    label.appendChild(radio);
    var texts = document.createElement("span");
    var name = document.createElement("span");
    name.className = "tone-name";
    name.textContent = tone.name;
    texts.appendChild(name);
    var desc = document.createElement("span");
    desc.className = "tone-desc";
    desc.textContent = tone.desc;
    texts.appendChild(desc);
    label.appendChild(texts);
    box.appendChild(label);
  });
}

function showSignedIn() {
  el("connect-card").classList.add("hidden");
  el("watchlist-card").classList.remove("hidden");
  el("tone-card").classList.remove("hidden");
  el("signout-card").classList.remove("hidden");
}

function showSignedOut() {
  el("connect-card").classList.remove("hidden");
  el("watchlist-card").classList.add("hidden");
  el("tone-card").classList.add("hidden");
  el("signout-card").classList.add("hidden");
}

function loadState() {
  return api("/api/miniapp/state").then(function (res) {
    if (res.status === 401) {
      sessionToken = "";
      sessionStorage.removeItem(SESSION_KEY);
      showSignedOut();
      setStatus("connect-status", "That session has ended. Connect again with a fresh code.", "error");
      return;
    }
    var data = res.data || {};
    currentTone = data.replyTone || "casual";
    renderWatchlist(data.watchlist || []);
    renderTones();
    showSignedIn();
  });
}

el("connect-btn").addEventListener("click", function () {
  var code = el("code-input").value.trim();
  if (code.length !== 6) {
    setStatus("connect-status", "The code is 6 digits - check the bot chat and try again.", "error");
    return;
  }
  setStatus("connect-status", "Checking the code...", "");
  api("/api/session/exchange", { method: "POST", body: { code: code } }).then(function (res) {
    var data = res.data || {};
    if (res.status === 200 && data.sessionToken) {
      sessionToken = data.sessionToken;
      sessionStorage.setItem(SESSION_KEY, sessionToken);
      setStatus("connect-status", "", "");
      loadState();
      return;
    }
    var message = "That code did not work.";
    if (data.error === "expired-code") message = "That code has expired. Send /pair to the bot for a fresh one.";
    if (data.error === "unknown-code") message = "That code is not on file. Check it in the bot chat, or send /pair for a fresh one.";
    setStatus("connect-status", message, "error");
  }).catch(function () {
    setStatus("connect-status", "The server did not answer. Try again in a moment.", "error");
  });
});

el("tone-save").addEventListener("click", function () {
  var picked = document.querySelector("input[name='tone']:checked");
  if (!picked) return;
  setStatus("tone-status", "Saving...", "");
  api("/api/miniapp/settings", { method: "POST", body: { replyTone: picked.value } }).then(function (res) {
    if (res.status === 200 && res.data && res.data.ok) {
      currentTone = res.data.replyTone;
      setStatus("tone-status", "Saved. The glasses will use the " + currentTone + " tone for smart replies.", "ok");
      return;
    }
    setStatus("tone-status", "That did not save. Try again.", "error");
  }).catch(function () {
    setStatus("tone-status", "The server did not answer. Try again in a moment.", "error");
  });
});

el("signout-btn").addEventListener("click", function () {
  sessionToken = "";
  sessionStorage.removeItem(SESSION_KEY);
  showSignedOut();
  setStatus("connect-status", "Disconnected. Connect again any time with a fresh code.", "ok");
});

if (sessionToken) {
  loadState().catch(function () { showSignedOut(); });
}
</script>
</body>
</html>
`;
