"""Detect whether Elite Dangerous is running, and launch it on demand.

Detection is a process probe: the journal alone can't tell a crashed game
from a quiet moment in supercruise, and Status.json goes stale either way.

Launching goes through the store launcher — the fixed Steam URL or a known
Frontier launcher path, never a user-supplied command — so the LAN-facing
launch endpoint can start the game and nothing else.
"""
import os
import subprocess
import sys

from .errors import UserFacingError

GAME_PROCESS = "EliteDangerous64.exe"
STEAM_URL = "steam://rungameid/359320"
FRONTIER_LAUNCHER_PATHS = (
    r"C:\Program Files (x86)\Frontier\EDLaunch\EDLaunch.exe",
    r"C:\Program Files\Frontier\EDLaunch\EDLaunch.exe",
)


class LaunchError(UserFacingError):
    pass


def is_running(process=GAME_PROCESS):
    """True/False if the game client process is alive, None if the probe
    itself failed (callers should keep their previous answer on None)."""
    try:
        if sys.platform == "win32":
            out = subprocess.run(
                ["tasklist", "/FI", f"IMAGENAME eq {process}", "/NH"],
                capture_output=True, text=True, timeout=10,
                creationflags=subprocess.CREATE_NO_WINDOW,
            ).stdout or ""
            return process.lower() in out.lower()
        # Linux/Steam Deck: the Windows exe is visible in the process table
        # under Proton. pgrep exits 1 for "no match", >1 for real errors.
        res = subprocess.run(["pgrep", "-fc", process], capture_output=True, timeout=10)
        if res.returncode > 1:
            return None
        return res.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return None


def _steam_installed():
    if sys.platform != "win32":
        return True  # on Linux the steam:// handoff below fails loudly enough
    try:
        import winreg

        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam"):
            return True
    except OSError:
        return False


def launch():
    """Start the game via its store launcher. Returns the launcher used;
    raises LaunchError with a player-facing message when none is found."""
    if sys.platform == "win32":
        if _steam_installed():
            os.startfile(STEAM_URL)  # Steam owns the rest of the handoff
            return "Steam"
        for path in FRONTIER_LAUNCHER_PATHS:
            if os.path.isfile(path):
                subprocess.Popen([path], cwd=os.path.dirname(path))
                return "the Frontier launcher"
        raise LaunchError(
            "Couldn't find Steam or the Frontier launcher on this machine - start the game manually."
        )
    try:
        subprocess.Popen(
            ["xdg-open", STEAM_URL],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return "Steam"
    except OSError as exc:
        raise LaunchError("Couldn't hand off to Steam - start the game manually.") from exc
