"""Contracts for the restrained, Panel-only HUD control language."""

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP = (ROOT / "ui" / "app.js").read_text(encoding="utf-8")
HTML = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "ui" / "style.css").read_text(encoding="utf-8")

hud = CSS.split("Panel HUD controls", 1)[1]

# The redesign stays narrow: ordinary Panel actions share a quiet primitive,
# while Desktop and the bespoke Status controls remain outside its scope.
for selector in (
    "body.panel-mode main button.primary",
    "body.panel-mode main button.copy",
    "body.panel-mode main button.plotbtn",
    "body.panel-mode main button.exo-chip",
    "body.panel-mode main .theme-chip",
    "body.panel-mode .update-banner .ub-btn",
):
    assert selector in hud
assert "body.panel-mode main button.fp-btn" not in hud
assert "body.panel-mode main button.fp-jump" not in hud

# Controls are compact, flat and screen-native rather than faux hardware.
assert "min-height: 44px;" in hud
assert "min-height: 46px;" in hud
assert "min-width: 44px;" in hud
assert "border-radius: 2px;" in hud
assert "font-size: 12.5px;" in hud
assert "letter-spacing: .08em;" in hud
for rejected_motif in (
    "clip-path:",
    "repeating-linear-gradient",
    "--fp-key-cut",
    "--fp-key-face",
    "::before",
    "::after",
):
    assert rejected_motif not in hud

# Accent fill is momentary; resting, selected and semantic states use thin
# lines and restrained washes.
assert "background: var(--orange);" in hud
assert ":active:not(:disabled)" in hud
assert "box-shadow: inset 0 -2px var(--orange);" in hud
assert "body.panel-mode > .fp-arrange.on" in hud
assert "button:is(.primary, .copy, .plotbtn, .exo-chip):is(.danger, .ep-remove)" in hud
assert "body.panel-mode .update-banner.setup-banner .ub-btn" in hud
assert "body.panel-mode .alert-strip button.alert-recover" in hud

# Touch, keyboard and Windows High Contrast remain first-class.
assert ".fp-nav-pages button { min-height: 44px; }" in CSS
assert "@media (hover: hover)" in hud
assert ":focus-visible" in hud
assert "body.panel-mode #tab-specialists .sp-switcher button:focus-visible" in hud
assert "@media (forced-colors: active)" in hud
assert "background: Highlight;" in hud
assert "color: HighlightText;" in hud

# Destructive and selected states are exposed semantically as well as visually.
assert 'id="ep-traders" class="copy"' in HTML
assert 'id="galhistory-clear"' in HTML and 'class="copy small danger"' in HTML
assert 'data-page="status" class="active" aria-current="page"' in HTML
assert 'revoke.className = "copy danger";' in APP
assert 'remove.className = "copy danger";' in APP
assert 'remove.className = "copy danger ep-remove";' in APP
assert 'stop.className = "copy danger rp-stop";' in APP
assert 'b.setAttribute("aria-current", "page");' in APP
assert 'b.setAttribute("aria-pressed", String(on));' in APP
assert "function initBusyButtonStates()" in APP
assert 'button.setAttribute("aria-busy", "true");' in APP
assert 'target.removeAttribute("aria-busy");' in APP
assert "const completed = new WeakSet();" in APP
assert "oldValue !== null || !target.disabled" in APP
assert "attributeOldValue: true" in APP
assert 'button.primary[aria-busy="true"]:disabled' in hud

# No temporary visual-QA hook may ship.
assert "_capture_panel.js" not in HTML
assert not (ROOT / "ui" / "_capture_panel.js").exists()
assert "_final_panel_audit.js" not in HTML
assert not (ROOT / "ui" / "_final_panel_audit.js").exists()
assert "_busy_state_audit.js" not in HTML
assert not (ROOT / "ui" / "_busy_state_audit.js").exists()

result = subprocess.run(
    ["node", "--check", str(ROOT / "ui" / "app.js")],
    cwd=ROOT,
    capture_output=True,
    text=True,
    check=False,
)
assert result.returncode == 0, result.stdout + result.stderr

print("panel controls OK: restrained HUD styling, semantics and isolation stay intact")
