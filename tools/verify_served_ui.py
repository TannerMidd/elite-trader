"""Verify a running packaged server exposes one coherent native-ESM graph."""

import argparse
import re
from collections import deque
from urllib.parse import urldefrag, urljoin, urlsplit
from urllib.request import urlopen


SCRIPT_TAG = re.compile(r"<script\b[^>]*>", re.IGNORECASE)
ATTRIBUTE = re.compile(r"""([\w:-]+)\s*=\s*["']([^"']*)["']""")
STATIC_IMPORT = re.compile(
    r"""(?m)^\s*(?:import\s+(?:[^;]*?\s+from\s+)?|"""
    r"""export\s+[^;]*?\s+from\s+)["']([^"']+)["']\s*;"""
)
DYNAMIC_IMPORT = re.compile(r"""import\s*\(\s*["']([^"']+)["']\s*\)""")
VERSION_HEADER = "X-Frameshift-Version"


def fetch(url, expected_version, expected_cache):
    with urlopen(url, timeout=15) as response:
        body = response.read()
        version = response.headers.get(VERSION_HEADER)
        cache = response.headers.get("Cache-Control", "")
        if version != expected_version:
            raise RuntimeError(
                f"{url} served {VERSION_HEADER}={version!r}; expected {expected_version!r}"
            )
        if expected_cache not in cache.lower():
            raise RuntimeError(
                f"{url} served Cache-Control={cache!r}; expected {expected_cache!r}"
            )
        return body, response.headers.get_content_charset() or "utf-8"


def module_entries(html, document_url):
    entries = []
    for tag in SCRIPT_TAG.findall(html):
        attributes = {name.lower(): value for name, value in ATTRIBUTE.findall(tag)}
        if attributes.get("type", "").lower() == "module" and attributes.get("src"):
            entries.append(urljoin(document_url, attributes["src"]))
    return entries


def module_imports(source):
    return set(STATIC_IMPORT.findall(source)) | set(DYNAMIC_IMPORT.findall(source))


def verify(base_url, expected_version):
    root_url = urljoin(base_url.rstrip("/") + "/", "/")
    origin = urlsplit(root_url)[:2]
    html_bytes, encoding = fetch(root_url, expected_version, "no-cache")
    entries = module_entries(html_bytes.decode(encoding), root_url)
    if not entries:
        raise RuntimeError(f"{root_url} does not declare a module entry point")

    queue = deque(entries)
    visited = set()
    while queue:
        module_url = urldefrag(queue.popleft()).url
        if module_url in visited:
            continue
        if urlsplit(module_url)[:2] != origin:
            raise RuntimeError(f"module graph leaves the served origin: {module_url}")
        body, charset = fetch(module_url, expected_version, "no-cache")
        visited.add(module_url)
        source = body.decode(charset)
        for specifier in module_imports(source):
            if not specifier.startswith((".", "/")):
                raise RuntimeError(
                    f"{module_url} uses unsupported bare module specifier {specifier!r}"
                )
            queue.append(urljoin(module_url, specifier))

    api_url = urljoin(root_url, "api/state")
    fetch(api_url, expected_version, "no-store")
    return visited


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("base_url")
    parser.add_argument("--expected-version", required=True)
    args = parser.parse_args()
    modules = verify(args.base_url, args.expected_version)
    print(
        f"served UI OK: {len(modules)} ESM modules and /api/state use "
        f"version {args.expected_version}"
    )


if __name__ == "__main__":
    main()
