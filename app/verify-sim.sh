#!/bin/bash
# PaperPlane Day 1 simulator verification.
# Assumes: Xvfb :99 running, plugin served on :8901, simulator running
# with --automation-port 9898. Saves glasses framebuffer evidence to
# app/sim-evidence/ and prints the plugin console log.
set -e
EV="$HOME/workspace/even-realities/app/sim-evidence"
API="http://127.0.0.1:9898"

echo "== ping =="
curl -s "$API/api/ping"; echo

echo "== console (before input) =="
curl -s "$API/api/console"

echo "== glasses: startup screen =="
curl -s "$API/api/screenshot/glasses" -o "$EV/day-01-glasses-startup.png"
ls -la "$EV/day-01-glasses-startup.png"

echo "== input: click (toggles pairing hint) =="
curl -s -X POST "$API/api/input" -H 'content-type: application/json' \
  -d '{"action":"click"}'; echo
sleep 2
curl -s "$API/api/screenshot/glasses" -o "$EV/day-01-glasses-after-click.png"
ls -la "$EV/day-01-glasses-after-click.png"

echo "== input: double-click (help line) =="
curl -s -X POST "$API/api/input" -H 'content-type: application/json' \
  -d '{"action":"double_click"}'; echo
sleep 2
curl -s "$API/api/screenshot/glasses" -o "$EV/day-01-glasses-after-double-click.png"
ls -la "$EV/day-01-glasses-after-double-click.png"

echo "== console (after input) =="
curl -s "$API/api/console"
echo "== done =="
