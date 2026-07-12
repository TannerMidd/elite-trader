"""Static contract checks for the local OPS workspace."""

import subprocess
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "ui" / "index.html"
APP = ROOT / "ui" / "app.js"
STYLE = ROOT / "ui" / "style.css"


class IdCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"])


index = INDEX.read_text(encoding="utf-8")
app = APP.read_text(encoding="utf-8")
style = STYLE.read_text(encoding="utf-8")

parser = IdCollector()
parser.feed(index)
duplicates = [value for value, count in Counter(parser.ids).items() if count > 1]
assert not duplicates, f"duplicate HTML ids: {duplicates}"

# Desktop and cockpit navigation expose the same workspace.
assert 'data-tab="ops"' in index
assert 'data-page="ops"' in index
assert 'id="tab-ops"' in index
assert '"galaxy", "ops"' in app

# Every requested surface is represented by stable DOM hooks.
required_ids = {
    "ops-plan-form", "ops-plan-selected", "ops-plan-alternatives", "ops-timing-list",
    "ops-objective-form", "ops-objective-list", "ops-objective-body", "ops-board-form", "ops-board-select",
    "ops-board-objective-form", "ops-assignment-form", "ops-reservation-form",
    "ops-contribution-form", "ops-board-export", "ops-board-import-trigger", "ops-board-import", "ops-conflicts",
}
assert required_ids <= set(parser.ids), sorted(required_ids - set(parser.ids))

# Keep the client/server interface explicit and local-only.
for endpoint in (
    "/api/objectives", "/api/objectives/plan", "/api/timings", "/api/operations",
    "/api/operations/export", "/api/operations/import",
):
    assert endpoint in app
for field in ("time_budget_minutes", "max_tasks", "estimated_seconds", "depends_on"):
    assert field in app
assert 'minutes: Number($("ops-budget").value)' in app
for kind in ("boards", "objectives", "assignments", "reservations", "contributions"):
    assert f'postOperation("{kind}"' in app
for action in ("create_board", "add_objective", "assign", "reserve", "contribute"):
    assert f'"{action}"' in app
assert 'documentValue.format !== "frameshift.operations"' in app
assert 'method: "PATCH"' in app and 'method: "DELETE"' in app

# Planner decisions and timing sources must be explainable, not just ranked cards.
assert "priority, reward per minute and duration" in app
assert "Personal median" in app
assert "Conservative built-in default" in app
assert "dependency bundle" in app
assert ".ops-provenance" in style and ".ops-conflicts" in style

result = subprocess.run(
    ["node", "--check", str(APP)], cwd=ROOT, capture_output=True, text=True, check=False,
)
assert result.returncode == 0, result.stdout + result.stderr

print("OPS UI OK: planner provenance, objective CRUD, board exchange and conflict visibility")
