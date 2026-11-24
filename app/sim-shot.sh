#!/bin/bash
# Capture the Glasses Display as an x11grab crop (offset 820,100, size
# 576x328 on display :99). /api/screenshot/glasses returns a static green
# frame in this simulator build - never use it as evidence.
# Usage: sim-shot.sh <output.png>
ffmpeg -loglevel error -f x11grab -video_size 576x328 \
  -i :99.0+820,100 -frames:v 1 -y "$1"
