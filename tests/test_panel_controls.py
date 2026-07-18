"""Static contracts for the Panel-only cockpit control language."""

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP = (ROOT / "ui" / "app.js").read_text(encoding="utf-8")
HTML = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "ui" / "style.css").read_text(encoding="utf-8")

cockpit = CSS.split("panel-mode cockpit control system", 1)[1]

# Shared Desktop panes receive one late, Panel-scoped control system. Bespoke
# Status, rail, launch and text-link controls are intentionally outside it.
assert "body.panel-mode :is(main, .update-banner, .route-progress, .alert-strip, .banner)" in cockpit
assert "button:not(.extlink)" in cockpit
assert "body.panel-mode main button.primary" in cockpit
assert "--fp-key-face:" in cockpit
assert "background: transparent;" in cockpit
assert "linear-gradient(180deg, #15181e, #090b0e)" in cockpit
assert "body.panel-mode main #ep-traders" in cockpit

# Primary, compact, selected, destructive and success keys retain hierarchy
# without depending on color alone.
for state in (
    "button.primary.small",
    '[aria-pressed="true"]',
    '[aria-selected="true"]',
    "button:is(.danger, .ep-remove)",
    "button.done",
):
    assert state in cockpit
assert "min-height: 54px;" in cockpit
assert "min-height: 44px;" in cockpit
assert "repeating-linear-gradient(-45deg" in cockpit

# Tablet behavior remains usable for touch, keyboard, reduced-motion and
# high-contrast users.
assert ".fp-nav-pages button { min-height: 44px; }" in CSS
assert "@media (hover: hover)" in cockpit
assert ":focus-visible" in cockpit
assert "@media (forced-colors: active)" in cockpit
assert 'input[type="checkbox"]:checked' in cockpit
assert "body.panel-mode .setting .switch" in cockpit
assert (
    "body.panel-mode.arranging main .tabpane section.card[data-arr] > "
    "button:is(.arr-handle, .arr-eye) {" in cockpit
)
assert "position: absolute;" in cockpit
assert "animation: busy-pulse 1.4s ease-in-out infinite;" in cockpit
assert "outline: 2px solid Highlight;" in cockpit
assert "body.panel-mode main label.theme-chip.on" in cockpit
assert "background: Highlight;" in cockpit
assert "color: HighlightText;" in cockpit

# The sole unclassed static action is now in the utility family, destructive
# actions identify themselves, and selected navigation/theme state is exposed.
assert 'id="ep-traders" class="copy"' in HTML
assert 'id="galhistory-clear"' in HTML and 'class="copy small danger"' in HTML
assert 'data-page="status" class="active" aria-current="page"' in HTML
assert 'revoke.className = "copy danger";' in APP
assert 'remove.className = "copy danger";' in APP
assert 'remove.className = "copy danger ep-remove";' in APP
assert 'b.setAttribute("aria-current", "page");' in APP
assert 'b.setAttribute("aria-pressed", String(on));' in APP

result = subprocess.run(
    ["node", "--check", str(ROOT / "ui" / "app.js")],
    cwd=ROOT,
    capture_output=True,
    text=True,
    check=False,
)
assert result.returncode == 0, result.stdout + result.stderr

print("panel controls OK: cockpit hierarchy, states and accessibility stay scoped")
