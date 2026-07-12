"""Static contract for market confidence, recovery, and galaxy-mode warnings."""

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
APP = (ROOT / "ui" / "app.js").read_text(encoding="utf-8")
HTML = (ROOT / "ui" / "index.html").read_text(encoding="utf-8")
CSS = (ROOT / "ui" / "style.css").read_text(encoding="utf-8")

for token in (
    "confidenceHtml",
    "profit_range",
    "payout_range",
    "first_trip_profit_per_hour",
    "positioning_minutes",
    'fetch("/api/cargo-recovery"',
    "failed_market_id",
    "renderCargoBuyers",
    "renderGalaxyModeNotice",
    "state.galaxy_mode",
):
    assert token in APP, token

assert 'id="galaxy-mode-banner"' in HTML
assert "confidence and conservative range included" in HTML
assert ".confidence-low" in CSS
assert ".alert-recover" in CSS

print("route risk UI OK: confidence, ranges, diversion recovery, Legacy boundary")
