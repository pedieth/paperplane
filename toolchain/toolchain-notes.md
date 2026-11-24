# Toolchain verification — 2026-11-19 (preparation only, no app code)

Scratch project: `~/workspace/even-realities/toolchain/` (package.json + node_modules only).

## Environment
- Node.js: **v24.22.1** (CLI docs ask for 20.17+ / 22.13+ / 23.5+ — v24 runs everything below fine)
- npm: **10.9.4**

## Installed versions (exact, from each package's package.json)
| Package | Version |
|---|---|
| `@evenrealities/even_hub_sdk` | **0.0.16** |
| `@evenrealities/evenhub-cli` | **0.2.0** |
| `@evenrealities/evenhub-simulator` | **0.9.5** |
| `@evenrealities/sim-linux-x64` (native binary dep) | installed |

## CLI (`evenhub`, alias `eh`) — runs fully headless ✅
Commands: `login`, `init`, `pack`, `qr`, `self-check`, `create`, `upload`, `update`,
`ls`, `promote`, `delist`, `testers`, `rm`, `download`, `logout`.
Global `--json` flag for machine-readable output.

- `evenhub init -d <dir>` works headless and writes a starter `app.json` (probe copy kept in
  `toolchain/init-probe/app.json`). Generated manifest fields:
  `package_id`, `edition` ("202601"), `name`, `version`, `min_app_version` ("2.2.10"),
  `min_sdk_version` ("0.0.16"), `entrypoint` ("index.html"), `permissions[]`
  (`{name, desc, whitelist[]}` — the `network` permission carries the host whitelist),
  `supported_languages[]`.
- `evenhub pack <manifest> <project> [-o out.ehpk] [--sdk-ver v] [--check]` — packaging is
  headless; `--check` verifies package-id availability. There is **no standalone
  `validate` command**: manifest/page validation happens inside `pack`, and at runtime the
  SDK ships `validateEvenHubPageContainer(...)` for pre-flight page checks.
- `evenhub qr --url <dev-server-url>` generates the sideload QR (headless; `-e` opens an
  external viewer, avoid headless).
- `create` / `upload` / `promote` need `evenhub login` (interactive Even Realities account
  sign-in) — a build-week step, not needed for the hackathon submission itself
  (`.ehpk` is optional).

## Simulator — does NOT run on this VM ❌ (needs a desktop)
- The npm package is a shim: `bin/index.js` execs a native binary from
  `@evenrealities/sim-linux-x64/bin/evenhub-simulator` (ELF x86-64).
- On this VM it fails immediately:
  `error while loading shared libraries: libwebkit2gtk-4.1.so.0: cannot open shared object file`
- It is a **Tauri/WebKitGTK desktop GUI**: it needs WebKitGTK 4.1 system libraries **and**
  an X11/Wayland display (or Xvfb + those libs). Not worth fighting on the VM.
- **Plan: run the simulator on pk's own computer** (Windows/macOS/Linux desktop — it uses
  the PC microphone there, which the demo needs anyway). Quirk: after a *local* npm install
  the `evenhub-simulator` bin is not linked into `node_modules/.bin`; the official docs
  install it globally (`npm install -g @evenrealities/evenhub-simulator`), or invoke it via
  `node node_modules/@evenrealities/evenhub-simulator/bin/index.js <url>`.
