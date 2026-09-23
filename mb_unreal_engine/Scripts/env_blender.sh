#!/usr/bin/env bash
# Run headless Blender one instance at a time: waits for Saved/blender.lock AND for any other blender.exe to exit.
#   Scripts/env_blender.sh <script.py> [args after --]
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$ROOT/Saved/blender.lock"
BL="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
mkdir -p "$ROOT/Saved"
until mkdir "$LOCK" 2>/dev/null; do
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then rm -rf "$LOCK"; continue; fi
  echo "[env_blender] waiting for lock held by $(cat "$LOCK/owner" 2>/dev/null)"; sleep 15
done
echo "environment $* ($(date +%T))" > "$LOCK/owner"
trap 'rm -rf "$LOCK"' EXIT
while tasklist 2>/dev/null | grep -qi "^blender.exe"; do echo "[env_blender] another blender.exe is running"; sleep 15; done
SCRIPT="$1"; shift
"$BL" -b --factory-startup --python "$(cygpath -w "$SCRIPT")" -- "$@" 2>&1 | grep -E "\[MB\]|Error|Traceback|  File \"" | cut -c1-240
