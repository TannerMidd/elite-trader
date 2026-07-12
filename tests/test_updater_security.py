"""The updater fails closed and never promotes a partial/unverified binary."""

import hashlib
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from elite.updater import MAX_DOWNLOAD_BYTES, Updater, parse_version


class Response:
    def __init__(self, body=b"", status=200, headers=None):
        self.body = body
        self.status_code = status
        self.headers = headers or {"Content-Length": str(len(body))}
        self.text = body.decode("ascii", errors="replace")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests
            raise requests.HTTPError(str(self.status_code))

    def iter_content(self, chunk_size):
        for offset in range(0, len(self.body), chunk_size):
            yield self.body[offset:offset + chunk_size]


assert parse_version("v2.3.0-beta1") == (2, 3, 0)

with tempfile.TemporaryDirectory() as td:
    root = Path(td)
    binary = b"MZ" + b"verified executable payload"
    digest = hashlib.sha256(binary).hexdigest()
    checksum_asset = {
        "name": "Frameshift.exe.sha256",
        "browser_download_url": "https://github.com/example/project/releases/download/v3/checksum",
    }
    info = {"size": len(binary), "_asset_name": "Frameshift.exe", "_assets": [checksum_asset]}
    path = root / "Frameshift.exe"
    path.write_bytes(binary)

    updater = Updater()
    with patch("elite.updater.requests.get", return_value=Response(digest.encode("ascii"))):
        updater._verify(path, info)

    for broken_info, response in (
        ({**info, "_assets": []}, None),
        (info, Response(b"not-a-digest")),
        (info, Response(("0" * 64).encode("ascii"))),
    ):
        try:
            with patch("elite.updater.requests.get", return_value=response):
                updater._verify(path, broken_info)
        except RuntimeError:
            pass
        else:
            raise AssertionError("unverified release was accepted")

    destination = root / "download.exe"
    with patch("elite.updater.requests.get", return_value=Response(binary)):
        updater._download("https://github.com/example/release.exe", destination)
    assert destination.read_bytes() == binary
    assert not destination.with_suffix(".exe.part").exists()

    truncated = Response(binary, headers={"Content-Length": str(len(binary) + 1)})
    try:
        with patch("elite.updater.requests.get", return_value=truncated):
            updater._download("https://github.com/example/release.exe", destination)
    except RuntimeError:
        pass
    else:
        raise AssertionError("truncated download was accepted")
    assert destination.read_bytes() == binary
    assert not destination.with_suffix(".exe.part").exists()

    oversized = Response(b"", headers={"Content-Length": str(MAX_DOWNLOAD_BYTES + 1)})
    try:
        with patch("elite.updater.requests.get", return_value=oversized):
            updater._download("https://github.com/example/release.exe", destination)
    except RuntimeError:
        pass
    else:
        raise AssertionError("oversized download was accepted")

print("updater OK: mandatory SHA-256, trusted URLs, atomic bounded downloads")
