"""Reads the game's custom keybindings (.binds XML) so autoplot can emulate
the keys the player actually has bound."""

import os
import xml.etree.ElementTree as ET
from pathlib import Path


class BindingsError(Exception):
    pass


def bindings_dir():
    override = os.environ.get("ED_BINDINGS_DIR")
    if override:
        return Path(override)
    return (
        Path(os.environ.get("LOCALAPPDATA", ""))
        / "Frontier Developments" / "Elite Dangerous" / "Options" / "Bindings"
    )


# ED "Key_*" names -> pydirectinput key names.
SPECIAL_KEYS = {
    "Key_Space": "space",
    "Key_Enter": "enter",
    "Key_NumpadEnter": "enter",
    "Key_Backspace": "backspace",
    "Key_Tab": "tab",
    "Key_Escape": "esc",
    "Key_UpArrow": "up",
    "Key_DownArrow": "down",
    "Key_LeftArrow": "left",
    "Key_RightArrow": "right",
    "Key_LeftShift": "shiftleft",
    "Key_RightShift": "shiftright",
    "Key_LeftControl": "ctrlleft",
    "Key_RightControl": "ctrlright",
    "Key_LeftAlt": "altleft",
    "Key_RightAlt": "altright",
    "Key_Home": "home",
    "Key_End": "end",
    "Key_PageUp": "pageup",
    "Key_PageDown": "pagedown",
    "Key_Insert": "insert",
    "Key_Delete": "delete",
    "Key_Minus": "-",
    "Key_Equals": "=",
    "Key_Comma": ",",
    "Key_Period": ".",
    "Key_Slash": "/",
    "Key_BackSlash": "\\",
    "Key_SemiColon": ";",
    "Key_Apostrophe": "'",
    "Key_LeftBracket": "[",
    "Key_RightBracket": "]",
    "Key_Grave": "`",
}
for _i in range(1, 13):
    SPECIAL_KEYS[f"Key_F{_i}"] = f"f{_i}"
# Note: pydirectinput has no numpad key support, so Key_Numpad_* stays unmapped
# and a numpad-only bind is reported as "needs a keyboard key bound".


def ed_key_to_pydirect(ed_key):
    if not ed_key:
        return None
    if ed_key in SPECIAL_KEYS:
        return SPECIAL_KEYS[ed_key]
    if ed_key.startswith("Key_") and len(ed_key) == 5:
        return ed_key[4].lower()
    return None


def find_binds_file():
    directory = bindings_dir()
    if not directory.is_dir():
        raise BindingsError(f"Bindings folder not found: {directory}")
    candidates = [p for p in directory.glob("*.binds") if ".backup" not in p.name]
    if not candidates:
        raise BindingsError(f"No .binds files in {directory}")
    return max(candidates, key=lambda p: p.stat().st_mtime)


def load_keyboard_binds(actions):
    """Return {action: {"key": <pydirectinput name>, "mods": [...]}} for each
    requested action, preferring whichever of Primary/Secondary is a keyboard key.
    Raises BindingsError naming any action without a usable keyboard bind."""
    path = find_binds_file()
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        raise BindingsError(f"Could not parse {path.name}: {exc}") from exc

    result = {}
    missing = []
    for action in actions:
        node = root.find(action)
        bound = None
        for slot in ("Primary", "Secondary"):
            el = node.find(slot) if node is not None else None
            if el is None or el.get("Device") != "Keyboard":
                continue
            key = ed_key_to_pydirect(el.get("Key"))
            if not key:
                continue
            mods = []
            ok = True
            for mod in el.findall("Modifier"):
                mod_key = ed_key_to_pydirect(mod.get("Key")) if mod.get("Device") == "Keyboard" else None
                if not mod_key:
                    ok = False
                    break
                mods.append(mod_key)
            if ok:
                bound = {"key": key, "mods": mods}
                break
        if bound:
            result[action] = bound
        else:
            missing.append(action)

    if missing:
        raise BindingsError(
            "These game actions need a keyboard key bound (Options > Controls): "
            + ", ".join(missing)
            + f" (read from {path.name})"
        )
    return result
