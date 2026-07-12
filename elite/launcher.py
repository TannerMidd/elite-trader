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


def _windows_process_names():
    """Return executable names from Windows' native process snapshot.

    ``tasklist`` is retained as a fallback below, but it can print ``Access
    denied`` even when the current user can enumerate processes normally.
    Toolhelp only reads the public process table; it does not open another
    process or require elevation, so it is both faster and more reliable for
    this exact presence check.

    ``None`` means the snapshot itself failed.  An empty tuple is a successful
    (albeit unusual) snapshot and must remain distinct from failure.
    """
    try:
        import ctypes
        from ctypes import wintypes

        class PROCESSENTRY32W(ctypes.Structure):
            _fields_ = [
                ("dwSize", wintypes.DWORD),
                ("cntUsage", wintypes.DWORD),
                ("th32ProcessID", wintypes.DWORD),
                ("th32DefaultHeapID", ctypes.c_size_t),
                ("th32ModuleID", wintypes.DWORD),
                ("cntThreads", wintypes.DWORD),
                ("th32ParentProcessID", wintypes.DWORD),
                ("pcPriClassBase", wintypes.LONG),
                ("dwFlags", wintypes.DWORD),
                ("szExeFile", wintypes.WCHAR * 260),
            ]

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
        kernel32.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
        kernel32.Process32FirstW.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESSENTRY32W)]
        kernel32.Process32FirstW.restype = wintypes.BOOL
        kernel32.Process32NextW.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESSENTRY32W)]
        kernel32.Process32NextW.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel32.CloseHandle.restype = wintypes.BOOL

        # TH32CS_SNAPPROCESS: enumerate processes, without requesting handles
        # to (or information from) the game process itself.
        snapshot = kernel32.CreateToolhelp32Snapshot(0x00000002, 0)
        if snapshot == wintypes.HANDLE(-1).value:
            return None
        try:
            entry = PROCESSENTRY32W()
            entry.dwSize = ctypes.sizeof(entry)
            if not kernel32.Process32FirstW(snapshot, ctypes.byref(entry)):
                # ERROR_NO_MORE_FILES means a valid but empty snapshot. Other
                # errors leave the caller free to use its fallback probe.
                return () if ctypes.get_last_error() == 18 else None
            names = []
            while True:
                names.append(entry.szExeFile)
                if not kernel32.Process32NextW(snapshot, ctypes.byref(entry)):
                    break
            return tuple(names)
        finally:
            kernel32.CloseHandle(snapshot)
    except (AttributeError, OSError, TypeError, ValueError):
        return None


def is_running(process=GAME_PROCESS):
    """True/False if the game client process is alive, None if the probe
    itself failed (callers should keep their previous answer on None)."""
    try:
        if sys.platform == "win32":
            names = _windows_process_names()
            if names is not None:
                target = process.casefold()
                return any(name.casefold() == target for name in names)

            # Compatibility fallback for unusual Windows environments where
            # the native snapshot API is unavailable. Do not interpret a
            # non-zero result (including "Access denied") as game-offline.
            result = subprocess.run(
                ["tasklist", "/FI", f"IMAGENAME eq {process}", "/NH"],
                capture_output=True, text=True, timeout=10,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            if result.returncode != 0:
                return None
            out = result.stdout or ""
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
