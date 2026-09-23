#!/usr/bin/env bash
# Run one Unreal process at a time (shared by all agents): memory is tight (16 GB, iGPU) and two processes
# saving the same packages corrupt each other. Waits for the lock, runs the command, always releases.
#
#   Scripts/ue_run.sh <owner> cmd  <script.py> [extra UE args...]   headless commandlet (python)
#   Scripts/ue_run.sh <owner> shot <tag>                              editor render on the C++-free copy -> Saved/QA/<tag>
#                                                                     (env MB_CHAR_VARIANT=Current|V2 picks the character set)
#   Scripts/ue_run.sh <owner> edpy <script.py> [extra UE args...]   python in a Slate editor session (no rendering), then quit
#   Scripts/ue_run.sh <owner> raw  <any command...>                   e.g. a UBT build
#   Scripts/ue_run.sh <owner> build                                   UBT: editor target (needs the lock like any UE run)
#   Scripts/ue_run.sh <owner> test [filter] [window]                  automation tests (default MapleBean) -> Saved/Automation/<filter>
#                                                                     "window" renders (PIE screenshots) instead of -nullrhi
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$ROOT/Saved/ue.lock"
OWNER="$1"; MODE="$2"; shift 2
UE="/c/Program Files/Epic Games/UE_5.6/Engine/Binaries/Win64"
SHOT="${MB_SHOT_COPY:-C:/Users/Aymen/AppData/Local/Temp/claude/C--Users-Aymen-Documents-ChatGPT-coffeshop/b44166d8-2ff3-4b5d-b6a2-cacfbd81d855/scratchpad/MBShot}"
mkdir -p "$ROOT/Saved"

until mkdir "$LOCK" 2>/dev/null; do
  # Stale lock (holder crashed) after 90 min.
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +90 2>/dev/null)" ]; then rm -rf "$LOCK"; continue; fi
  echo "[ue_run] waiting for lock held by $(cat "$LOCK/owner" 2>/dev/null)"; sleep 20
done
echo "$OWNER $MODE $* ($(date +%T))" > "$LOCK/owner"
trap 'rm -rf "$LOCK"' EXIT

P="$(cygpath -w "$ROOT")"
case "$MODE" in
  cmd)
    SCRIPT="$1"; shift
    "$UE/UnrealEditor-Cmd.exe" "$P\\mb_unreal_engine.uproject" -run=pythonscript -script="$(cygpath -w "$ROOT/$SCRIPT")" \
      -unattended -nosplash "$@" >/dev/null 2>&1
    LOG="$ROOT/Saved/Logs/$(ls -t "$ROOT/Saved/Logs" | grep -v backup | head -1)"
    grep -hE "\[MapleBean\]|\[Probe\]|Traceback|LogPython: Error|  File \"" "$LOG" | cut -c30-260
    ;;
  shot)
    TAG="$1"
    # Refresh the render copy (no Source/, so the editor opens without a build prompt); keep its Content/Python hook.
    rm -rf "$SHOT/Content/MapleBean" "$SHOT/Content/StarterContent"
    cp -r "$ROOT/Content/MapleBean" "$ROOT/Content/StarterContent" "$SHOT/Content/"
    cp "$ROOT"/Scripts/*.py "$SHOT/Scripts/"; cp "$ROOT"/Scripts/*.json "$SHOT/Scripts/" 2>/dev/null; cp -r "$ROOT/Config" "$SHOT/"
    MB_TAG="$TAG" MB_QA_EDITOR=1 MB_CHAR_VARIANT="${MB_CHAR_VARIANT:-Current}" MB_TIME="${MB_TIME:-day}" MB_SUPERSAMPLE="${MB_SUPERSAMPLE:-2}" "$UE/UnrealEditor.exe" "$(cygpath -w "$SHOT")\\mb_unreal_engine.uproject" -nosplash >/dev/null 2>&1
    mkdir -p "$ROOT/Saved/QA/$TAG" && cp "$SHOT/Saved/QA/$TAG/"*.png "$ROOT/Saved/QA/$TAG/" 2>/dev/null
    # Downsample the supersampled captures to 1600x900 (Lanczos) for smooth edges.
    python -c "import glob,sys
from PIL import Image
for f in glob.glob(sys.argv[1]+'/*.png'):
    im=Image.open(f)
    if im.width>1600: im.convert('RGB').resize((1600,900),Image.LANCZOS).save(f)" "$ROOT/Saved/QA/$TAG"
    grep -hE "capture pass|Traceback|failed" "$SHOT/Saved/Logs/mb_unreal_engine.log" | cut -c30-200
    ls "$ROOT/Saved/QA/$TAG"
    ;;
  edpy)
    # Python inside a real editor session (Slate up, no rendering): for editor ops that crash in commandlets,
    # e.g. IK retarget batch (it syncs the Content Browser). -ExecutePythonScript quits when the script returns.
    SCRIPT="$1"; shift
    "$UE/UnrealEditor-Cmd.exe" "$P\\mb_unreal_engine.uproject" -ExecutePythonScript="$(cygpath -w "$ROOT/$SCRIPT")" \
      -unattended -nosplash -nosound -nullrhi -log=MBEdPy.log "$@" >/dev/null 2>&1
    grep -hE "\[MapleBean\]|\[Probe\]|Traceback|LogPython: Error|  File \"|Assertion failed" "$ROOT/Saved/Logs/MBEdPy.log" | cut -c30-260
    ;;
  raw)
    "$@"
    ;;
  build)
    "/c/Program Files/Epic Games/UE_5.6/Engine/Build/BatchFiles/Build.bat" mb_unreal_engineEditor Win64 Development \
      -Project="$P\\mb_unreal_engine.uproject" -WaitMutex -NoHotReload 2>&1 | grep -E "error|warning C|Result:|Total execution|Building|up to date" | head -60
    ;;
  test)
    FILTER="${1:-MapleBean}"; RHI="-nullrhi"; EXE="UnrealEditor-Cmd.exe"
    [ "${2:-}" = "window" ] && { RHI="-windowed -ResX=1280 -ResY=720"; EXE="UnrealEditor.exe"; }
    OUT="$ROOT/Saved/Automation/$FILTER"; rm -rf "$OUT"; mkdir -p "$OUT"
    "$UE/$EXE" "$P\\mb_unreal_engine.uproject" -ExecCmds="Automation RunTests $FILTER;Quit" -unattended -nosplash -nosound \
      $RHI -testexit="Automation Test Queue Empty" -ReportExportPath="$(cygpath -w "$OUT")" -log=MBTest.log >/dev/null 2>&1
    grep -hE "\[MBTest\]|Test Completed|Result=|Error: |LogAutomationController: Error|Fatal|Assertion" "$ROOT/Saved/Logs/MBTest.log" | cut -c30-300 | head -80
    ;;
esac
