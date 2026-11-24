#!/bin/bash
# Send one input action to the simulator automation API.
# Usage: sim-input.sh <action> [sleep-seconds]
# Actions: up, down, click, double_click, long_press, long_press_release,
# context_menu (context_menu arrives as FOREGROUND_ENTER in this build).
curl -s -X POST http://127.0.0.1:9898/api/input \
  -H 'content-type: application/json' \
  -d "{\"action\":\"$1\"}" > /dev/null
sleep "${2:-1}"
