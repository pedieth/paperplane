# PaperPlane — Demo voice-reply lines (prepared 2026-11-20)

For the demo video, beat 3 (0:55–1:40 in `build-plan.md`): long-press, speak a
reply, transcript appears on the lens, one tap sends it, cut to Telegram
showing the reply in the group.

**Rules applied (pk's instructions, 2026-11-19):** English only — no Persian
lines, and nothing public-facing mentions Persian/Iranian origin anywhere.
pk records nothing; all lines are synthesized by Muse and played into the
simulator's virtual mic (`paplay -d virmic <file.wav>`, in sync with the
long-press — see `toolchain/simulator-vm.md`).

**Format:** WAV, 16 kHz mono PCM (`pcm_s16le`) — matches the simulator's
16 kHz PCM audio path. MP3 masters kept alongside for listening. Voice:
default TTS voice (Helio). All takes are well under the ~15 s per-reply cap
and short enough to fit a lens transcript card.

## Take 1 — MAIN (use in the video)

- **Incoming message on the lens card:** "Can you send the channel brief before six?"
- **Spoken reply:** "Yes, sending it before six. The summary is ready."
- **File:** `demo-voice/take-1-main.wav` (3.55 s) / `take-1-main.mp3`
- **Why this one:** short, plain words Whisper handles reliably; the time
  word "six" echoes the incoming message, so a correct transcript is
  obvious on camera.

## Take 2 — BACKUP (name test)

- **Incoming message on the lens card:** "Did Alex see the new listing?"
- **Spoken reply:** "Yes, Alex saw it. I will forward the link now."
- **File:** `demo-voice/take-2-name.wav` (3.17 s) / `take-2-name.mp3`
- **Why:** names are a known Whisper weak spot (see `build-plan.md` risks);
  use this take on Thu Nov 26 to check name handling, or swap it in if
  take 1 mis-transcribes.

## Take 3 — BACKUP (time test)

- **Incoming message on the lens card:** "Are we still meeting at ten?"
- **Spoken reply:** "Yes, see you at ten. I will bring the update."
- **File:** `demo-voice/take-3-time.wav` (3.17 s) / `take-3-time.mp3`
- **Why:** a second clean, short take with a time word, for rehearsal or if
  either of the first two fails in the Thu Nov 26 voice-reply session.

## Verification done 2026-11-20

- All three MP3s synthesized, converted to 16 kHz mono WAV, durations
  checked with ffprobe (3.55 s / 3.17 s / 3.17 s).
- Takes 2 and 3 share a byte size by coincidence; md5 hashes confirm all
  three files are distinct audio.
- **Not yet verified (due Thu Nov 26, build week):** end-to-end delivery of
  `audioEvent` PCM frames from the virtual mic to plugin code — the last hop
  can only be confirmed with a real plugin calling `audioControl(true, …)`
  (see `toolchain/simulator-vm.md` caveat 1). Run take 1 through the real
  voice flow that day and check the transcript on the lens before sending.

## Final voice decision (2026-11-20)

The HeyGen takes (heygen-take-1-main, heygen-take-2-backup, heygen-take-3-backup) are the FINAL demo voice, replacing the earlier synthesized takes. Reason: HeyGen Voice Turbo is the top-ranked TTS model and sounds noticeably more natural, which matters because the demo video is judged partly on UX polish. pk heard take 1, said it was okay, and delegated the final choice to the assistant. The earlier synth takes stay on disk as fallback.
