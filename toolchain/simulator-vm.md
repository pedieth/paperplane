# Simulator on the Muse VM — SOLVED ✅ (2026-11-19)

The Even Hub simulator **runs on this VM** under a virtual display, renders, is
drivable over HTTP, and can be screen-recorded. pk's computer is **not** needed
for the simulator or the demo video. This supersedes the "does NOT run on this
VM" section of `toolchain-notes.md`.

## What was missing

`ldd` on `node_modules/@evenrealities/sim-linux-x64/bin/evenhub-simulator`
(74 linked libraries) showed exactly **3 missing**:

| Library | Provided by |
|---|---|
| `libwebkit2gtk-4.1.so.0` | `libwebkit2gtk-4.1-0` |
| `libjavascriptcoregtk-4.1.so.0` | `libjavascriptcoregtk-4.1-0` |
| `libsoup-3.0.so.0` | `libsoup-3.0-0` |

## What was installed (apt, as root — apt works on this VM)

```bash
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  libwebkit2gtk-4.1-0 x11-utils xdotool imagemagick
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  pulseaudio libasound2-plugins
```

Resulting versions (Ubuntu 24.04 noble): `libwebkit2gtk-4.1-0` and
`libjavascriptcoregtk-4.1-0` **2.52.6-0ubuntu0.24.04.2**, `libsoup-3.0-0`
**3.4.4-5ubuntu0.11** (plus their dependency trees). After install, `ldd`
reports **0 not found**. `Xvfb`, `xvfb-run` and `ffmpeg` were already present.

Note: these are system packages — if the VM is rebuilt/replaced, re-run the two
install commands above before build-week simulator work.

## Exact launch sequence (verified end-to-end)

```bash
# 1. Virtual display (1600x1000)
Xvfb :99 -screen 0 1600x1000x24 &

# 2. Virtual microphone (PulseAudio null sink; its monitor is the mic)
pulseaudio --start --exit-idle-time=-1
pactl load-module module-null-sink sink_name=virmic \
  sink_properties=device.description=VirtualMic
pactl set-default-source virmic.monitor

# 3. Serve the plugin (dev server) — example with any static dir
cd <plugin-dir> && python3 -m http.server 8901 --bind 127.0.0.1 &

# 4. Simulator (targetUrl is a REQUIRED argument; automation API on 9898)
DISPLAY=:99 WEBKIT_DISABLE_DMABUF_RENDERER=1 \
  ~/workspace/even-realities/toolchain/node_modules/@evenrealities/sim-linux-x64/bin/evenhub-simulator \
  http://127.0.0.1:8901/index.html --automation-port 9898
```

`WEBKIT_DISABLE_DMABUF_RENDERER=1` forces software rendering (the VM has no
GPU; without it WebKit may still work, but this is the verified-good config).
The only stderr output is a benign `libEGL warning: DRI3 error` line.

## Verified behavior

- **Process/windows:** simulator stays alive; creates a `Browser` window
  (600×800 at +204+100 — the phone WebView pane) and a `Glasses Display`
  window (576×328 at +820+100), plus on-screen gesture buttons
  (Up / Down / Click / Double Click / Long Press / Menu / screenshot).
- **Page loading:** the WebView loads the `targetUrl` page — verified with a
  trivial static probe page (green-on-black "SIM PROBE OK"), screenshotted in
  `sim-evidence/simulator-desktop.png`. A plain page renders in the Browser
  pane; the glasses canvas stays at its idle frame until the page drives it
  through the SDK bridge (`createStartUpPageContainer`), as expected.
  **How a plugin is loaded: pass its dev-server URL as the positional
  `targetUrl` argument** (or relaunch to change it). No `.ehpk` needed for
  simulator work.
- **Automation API** (`--automation-port 9898`, all verified live):
  `GET /api/ping` → `pong`; `GET /api/console` → JSON console buffer;
  `GET /api/screenshot/glasses` → 576×288 PNG of the real glasses framebuffer
  (idle frame saved as `sim-evidence/glasses-framebuffer-idle.png`);
  `GET /api/screenshot/webview` → 600×800 PNG; `POST /api/input`
  `{"action":"click"}` → `{"ok":true}` (actions: up, down, click,
  double_click, long_press, long_press_release, context_menu). An agent can
  therefore drive the whole demo programmatically and pull framebuffer
  screenshots without touching the X display.
- **Screen recording:** `DISPLAY=:99 ffmpeg -f x11grab -video_size 1600x1000
  -framerate 25 -i :99 -t 5 -c:v libx264 -pix_fmt yuv420p out.mp4` produced a
  valid 5.0 s / 124-frame H.264 clip whose extracted frames show the
  simulator UI and the loaded page (clip saved as
  `sim-evidence/x11grab-test-5s.mp4`). For the demo, crop to the glasses
  window region (offset 820,100, size 576×328) or record full-screen and crop
  in edit.
- **Virtual mic pipeline (OS level):** the VM has no audio hardware
  (`/dev/snd` absent). With PulseAudio running, the simulator's
  `--list-audio-input-devices` shows `alsa:default` / `alsa:pulse`
  ("Playback/recording through the PulseAudio sound server"), whose default
  source is `virmic.monitor`. Verified: a 1 kHz test tone played into the
  sink (`paplay -d virmic tone.wav`) was captured from `virmic.monitor` with
  `parec` at healthy levels (mean −28.5 dB, max −18.1 dB). So for the demo,
  "speaking into the glasses" = `paplay -d virmic <voice-line.wav>` in sync
  with a long-press. Voice lines can be pre-recorded files (e.g. recorded by
  pk on his phone and sent over, or synthesized) — no live mic exists here.

## Remaining caveats (precise, none block launching or recording)

1. **End-to-end audio not yet proven:** that `audioEvent` PCM frames (16 kHz,
   100 ms chunks per the simulator README) actually reach plugin code from
   the PulseAudio default source can only be confirmed with a real plugin
   calling `audioControl(true, …)` — i.e. during build week (Thu Nov 26
   voice-reply day at the latest). The OS-level capture path and the
   simulator's device visibility are verified; the last hop is not.
2. **No live microphone:** voice takes must be audio files played into the
   virtual mic. Timing (long-press start/stop around playback) will be
   choreographed via the automation API.
3. **Root PulseAudio:** the daemon runs as root with a "not intended to be
   run as root" warning; it works, but if it ever refuses, restart it — the
   commands above are the known-good sequence.
4. Simulator-vs-device gaps from `build-plan.md` (no real ring, no BLE
   latency, faster image processing, list-scroll differences) still apply —
   the simulator remains a functional, not hardware, verification.
