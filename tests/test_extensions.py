"""Declarative extension manifests: validation, permissions and event actions."""

import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite.extensions import ExtensionManager  # noqa: E402


root = Path(_tmp.name) / "extensions"
pack = root / "sample.alerts"
pack.mkdir(parents=True)
(pack / "manifest.json").write_text(json.dumps({
    "id": "sample.alerts",
    "name": "Sample alerts",
    "version": "1.0.0",
    "api_version": 1,
    "permissions": ["read:journal", "emit:alert", "emit:objective"],
    "rules": [
        {
            "event": "HullDamage",
            "when": {"Health": {"max": 0.25}},
            "action": {
                "type": "alert",
                "level": "red",
                "code": "extension-hull",
                "text": "Hull at {Health}",
            },
        },
        {
            "event": "FSDJump",
            "when": {"StarSystem": {"exists": True}},
            "action": {
                "type": "objective",
                "category": "exploration",
                "title": "Survey {StarSystem}",
                "system": "{StarSystem}",
            },
        },
    ],
}), encoding="utf-8")

manager = ExtensionManager(root)
status = manager.reload()
assert status["errors"] == [], status
assert status["loaded"][0]["id"] == "sample.alerts"

seen = []
unsubscribe = manager.subscribe(seen.append)
assert manager.publish({"event": "HullDamage", "Health": 0.4}) == []
actions = manager.publish({"event": "HullDamage", "Health": 0.2})
assert actions[0]["text"] == "Hull at 0.2" and seen == actions
actions = manager.publish({"event": "FSDJump", "StarSystem": "Shinrarta Dezhra"})
assert actions[0]["title"] == "Survey Shinrarta Dezhra"
unsubscribe()

# A rule cannot emit an action it did not request permission for.
limited = root / "limited.pack"
limited.mkdir()
(limited / "manifest.json").write_text(json.dumps({
    "id": "limited.pack",
    "api_version": 1,
    "permissions": ["read:journal"],
    "rules": [{"event": "*", "action": {"type": "alert", "text": "nope"}}],
}), encoding="utf-8")
manager.reload()
assert manager.publish({"event": "Music"}) == []

# Invalid or mismatched manifests are reported without taking down valid packs.
bad = root / "bad-pack"
bad.mkdir()
(bad / "manifest.json").write_text('{"id":"different", "api_version":1}', encoding="utf-8")
status = manager.reload()
assert any(row["id"] == "bad-pack" for row in status["errors"]), status
assert any(row["id"] == "sample.alerts" for row in status["loaded"]), status

print("extensions OK: validation, permissions, rules, templating, isolation")
