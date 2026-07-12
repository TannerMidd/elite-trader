"""Export the current ship's Loadout journal event to ship-builder tools.

Two formats cover the whole ecosystem:
- EDSY import URL — the same encoding EDMC uses (gzip + urlsafe base64 of the
  compact-JSON Loadout event, appended to https://edsy.org/#/I=), opened
  directly in the browser.
- SLEF (Ship Loadout Event Format) — the community-standard JSON wrapper
  around the Loadout event; Coriolis, Inara and EDSY all accept it pasted
  into their import dialogs.
"""

import base64
import gzip
import io
import json

from ._version import VERSION

EDSY_IMPORT_PREFIX = "https://edsy.org/#/I="


def edsy_url(loadout_event):
    """EDSY import link for a Loadout journal event (EDMC-compatible encoding:
    compact sorted JSON -> gzip -> urlsafe base64, '=' padding percent-escaped
    so the fragment survives URL handling)."""
    compact = json.dumps(
        loadout_event, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="w") as f:
        f.write(compact)
    encoded = base64.urlsafe_b64encode(buf.getvalue()).decode().replace("=", "%3D")
    return EDSY_IMPORT_PREFIX + encoded


def slef(loadout_event):
    """The Loadout event as SLEF JSON (paste into Coriolis / Inara / EDSY)."""
    return json.dumps(
        [{"header": {"appName": "Frameshift", "appVersion": VERSION},
          "data": loadout_event}],
        ensure_ascii=False,
    )
