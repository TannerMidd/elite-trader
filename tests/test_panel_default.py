"""Panel is the fresh-device default without replacing a saved UI choice."""

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP = (ROOT / "ui" / "app.js").read_text(encoding="utf-8")
HTML = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
BOOT = (ROOT / "ui" / "panel-bootstrap.js").read_text(encoding="utf-8")
CSS = (ROOT / "ui" / "style.css").read_text(encoding="utf-8")

# Keep preference resolution explicit and independently injectable.  Null is
# a new browser/device, while 0 and 1 are the two values written by the UI.
assert "function panelModeOnLaunch(storage = localStorage)" in APP
assert 'const saved = storage.getItem("panelMode");' in APP
assert 'return saved == null ? true : saved === "1";' in APP
assert 'root.classList.add("panel-mode-prepaint")' in BOOT
assert 'window.addEventListener("error", releaseGuard' in BOOT
assert "panel = false;" in BOOT
assert HTML.index('src="panel-bootstrap.js"') < HTML.index('rel="stylesheet"')
assert "html.panel-mode-prepaint body >" in CSS
assert 'document.documentElement.classList.remove("panel-mode-prepaint");' in APP
assert "Never leave an authenticated page invisible" in APP

# Launch applies the resolved view without persisting it. User actions still
# use the default persistence path through setPanelMode(true/false).
assert "function setPanelMode(on, persist = true)" in APP
assert 'if (persist) localStorage.setItem("panelMode", on ? "1" : "0");' in APP
assert "setPanelMode(panelModeOnLaunch(), false);" in APP
assert APP.index("setPanelMode(panelModeOnLaunch(), false);") < APP.index("// OPS is entirely local")
assert '$(`panel-toggle`)' not in APP  # guard against a misspelled control ID
assert '$("panel-toggle").addEventListener("click", () => setPanelMode(true));' in APP
assert '$("panel-exit").addEventListener("click", () => setPanelMode(false));' in APP

print("panel default OK: fresh devices use Panel; explicit preferences persist")
