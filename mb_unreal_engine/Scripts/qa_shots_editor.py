"""Render QA shots from the full (windowed) editor, waiting until every material has compiled.

Headless commandlets never finish async material compiles, so surfaces show the checker placeholder.
In the editor, shaders compile between frames; this script polls until ShaderCompileWorker has been idle
for a while, then runs qa_shots.py (synchronous SceneCapture2D -> PNG) and quits.

Run: set MB_QA_EDITOR=1 and open the project; Content/Python/init_unreal.py calls this (not -ExecutePythonScript, which quits when the script returns)
(tag via MB_TAG; the project must not contain an uncompiled Source/ folder or the editor prompts first)
"""
import os
import subprocess
import time

import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
start = time.time()
state = {"next": start + 60.0, "idle_since": None, "pass": 0, "pass1_at": 0.0}
MIN_WAIT, IDLE_NEEDED, MAX_WAIT = 150.0, 45.0, 3600.0


def workers():
    out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq ShaderCompileWorker.exe"],
                         capture_output=True, text=True, creationflags=0x08000000).stdout
    return out.count("ShaderCompileWorker")


def tick(_dt):
    now = time.time()
    if now < state["next"]:
        return
    state["next"] = now + 5.0
    busy = workers()
    if busy:
        state["idle_since"] = None
        unreal.log(f"[MapleBean] waiting: {busy} shader workers busy ({now - start:.0f}s)")
        if now - start < MAX_WAIT:
            return
    elif state["idle_since"] is None:
        state["idle_since"] = now
    if now - start < MIN_WAIT or (state["idle_since"] and now - state["idle_since"] < IDLE_NEEDED and now - start < MAX_WAIT):
        return
    if state["pass"] == 1 and now - state["pass1_at"] < 120.0:  # let the newly placed characters' textures build
        return
    # Pass 1 places the characters and cameras, which starts *their* material compiles;
    # pass 2 captures once everything has compiled.
    state["pass"] += 1
    unreal.log(f"[MapleBean] shaders idle, capture pass {state['pass']}")
    try:
        with open(os.path.join(HERE, "qa_shots.py"), encoding="utf8") as f:
            exec(compile(f.read(), "qa_shots.py", "exec"), {"__name__": "__main__", "__file__": os.path.join(HERE, "qa_shots.py")})
    except Exception as e:  # noqa: BLE001 - never let a capture error skip the settling gap
        unreal.log_warning(f"[MapleBean] capture pass {state['pass']} failed: {e}")
    if state["pass"] < 2:
        state["idle_since"] = None
        state["pass1_at"] = time.time()
        state["next"] = time.time() + 30.0
        return
    unreal.unregister_slate_post_tick_callback(handle)
    unreal.SystemLibrary.quit_editor()


# L_Cafe is the EditorStartupMap, so it is already loading.
handle = unreal.register_slate_post_tick_callback(tick)
