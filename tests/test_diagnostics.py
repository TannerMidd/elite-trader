"""Diagnostics are bounded and support bundles redact sensitive paths."""

import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_tmp = tempfile.TemporaryDirectory()
os.environ["ET_DATA_DIR"] = _tmp.name

from elite import diagnostics, settings  # noqa: E402

settings.update({"journal_dir": r"C:\Users\Secret\Saved Games\Frontier Developments"})
path = diagnostics.configure()
assert path.parent.is_dir()

bundle = diagnostics.create_bundle()
assert bundle.is_file()
with zipfile.ZipFile(bundle) as zf:
    names = set(zf.namelist())
    assert "health.json" in names and "settings.json" in names
    saved = json.loads(zf.read("settings.json"))
    assert saved["journal_dir"] == "<custom>"
    health = json.loads(zf.read("health.json"))
    assert "version" in health and "platform" in health
    assert not any("Journal" in name for name in names)
    bundle_text = "\n".join(
        zf.read(name).decode("utf-8", errors="replace")
        for name in names if name.endswith((".json", ".log"))
    )
    assert _tmp.name.lower() not in bundle_text.lower()
    assert "C:\\Users\\Secret" not in bundle_text

print("diagnostics OK: persistent log, bounded privacy-safe support bundle")
