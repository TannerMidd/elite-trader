from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from elite.qrcode import svg


def main() -> None:
    pairing_url = "http://192.168.1.50:8765/?pair=temporary-secret"
    output = svg(pairing_url)
    assert output.startswith('<?xml version="1.0"')
    assert '<svg xmlns="http://www.w3.org/2000/svg"' in output
    assert 'shape-rendering="crispEdges"' in output
    assert pairing_url not in output
    assert output.count("<path") == 2
    assert svg(pairing_url) == output

    for invalid in ("", None, 42):
        try:
            svg(invalid)  # type: ignore[arg-type]
        except ValueError:
            pass
        else:
            raise AssertionError(f"accepted invalid QR payload: {invalid!r}")
    print("pairing QR OK: bundled, deterministic, metadata-safe SVG")


if __name__ == "__main__":
    main()
