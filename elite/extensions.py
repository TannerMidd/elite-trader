"""Permissioned, local-first extension host for Frameshift.

Extensions live below ``data/extensions/<id>/manifest.json``.  The default
extension format is deliberately declarative: it can inspect journal events
and emit alerts or objective suggestions, but it cannot execute code.  This
keeps an extension pack portable, reviewable and safe to enable by simply
copying a directory.

An optional process adapter is available for advanced integrations.  It is
disabled unless the extension directory also contains an ``APPROVED`` marker;
the child receives a minimal JSON document on stdin and cannot call Frameshift
APIs directly.  This is a capability boundary, not an operating-system
sandbox, so the approval marker is intentionally explicit.
"""

from __future__ import annotations

import json
import re
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from . import marketdb

API_VERSION = 1
EXTENSIONS_DIR = marketdb.DATA_DIR / "extensions"
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,63}$")
_ALLOWED_PERMISSIONS = {
    "read:journal",
    "read:state",
    "emit:alert",
    "emit:objective",
}
_ALLOWED_ACTIONS = {"alert", "objective"}
_MAX_MANIFEST_BYTES = 256 * 1024
_MAX_ACTIONS_PER_EVENT = 16


@dataclass(frozen=True)
class Extension:
    extension_id: str
    name: str
    version: str
    path: Path
    permissions: frozenset[str]
    rules: tuple[dict[str, Any], ...] = ()
    command: tuple[str, ...] = ()
    approved: bool = False


@dataclass
class ExtensionStatus:
    loaded: list[dict[str, Any]] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)


class ExtensionError(ValueError):
    pass


def _safe_read_manifest(path: Path) -> dict[str, Any]:
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise ExtensionError(f"cannot read manifest: {exc}") from exc
    if size > _MAX_MANIFEST_BYTES:
        raise ExtensionError("manifest is too large")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ExtensionError(f"invalid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise ExtensionError("manifest must be a JSON object")
    return value


def _normalise_extension(directory: Path, raw: dict[str, Any]) -> Extension:
    extension_id = str(raw.get("id") or "").strip().lower()
    if not _ID_RE.fullmatch(extension_id):
        raise ExtensionError("id must be 2-64 lowercase letters, digits, dots, dashes or underscores")
    if directory.name.lower() != extension_id:
        raise ExtensionError("directory name must match manifest id")
    try:
        api_version = int(raw.get("api_version", 0))
    except (TypeError, ValueError) as exc:
        raise ExtensionError("api_version must be an integer") from exc
    if api_version != API_VERSION:
        raise ExtensionError(f"unsupported api_version {api_version}; expected {API_VERSION}")

    permissions = frozenset(str(p) for p in (raw.get("permissions") or []))
    unknown = permissions - _ALLOWED_PERMISSIONS
    if unknown:
        raise ExtensionError("unknown permissions: " + ", ".join(sorted(unknown)))

    rules_value = raw.get("rules") or []
    if not isinstance(rules_value, list):
        raise ExtensionError("rules must be a list")
    rules: list[dict[str, Any]] = []
    for index, rule in enumerate(rules_value):
        if not isinstance(rule, dict):
            raise ExtensionError(f"rule {index + 1} must be an object")
        event = rule.get("event")
        action = rule.get("action")
        if not isinstance(event, str) or not event:
            raise ExtensionError(f"rule {index + 1} needs an event")
        if not isinstance(action, dict) or action.get("type") not in _ALLOWED_ACTIONS:
            raise ExtensionError(f"rule {index + 1} has an unsupported action")
        rules.append(rule)

    command_value = raw.get("command") or []
    if isinstance(command_value, str):
        command_value = [command_value]
    if not isinstance(command_value, list) or not all(isinstance(v, str) and v for v in command_value):
        raise ExtensionError("command must be a list of non-empty strings")
    command = tuple(command_value)
    if command:
        executable = (directory / command[0]).resolve()
        try:
            executable.relative_to(directory.resolve())
        except ValueError as exc:
            raise ExtensionError("command executable must stay inside the extension directory") from exc

    return Extension(
        extension_id=extension_id,
        name=str(raw.get("name") or extension_id).strip()[:100],
        version=str(raw.get("version") or "0").strip()[:40],
        path=directory,
        permissions=permissions,
        rules=tuple(rules),
        command=command,
        approved=(directory / "APPROVED").is_file(),
    )


def _field(data: dict[str, Any], dotted: str) -> Any:
    value: Any = data
    for key in dotted.split("."):
        if not isinstance(value, dict) or key not in value:
            return None
        value = value[key]
    return value


def _matches(rule: dict[str, Any], event: dict[str, Any]) -> bool:
    wanted = rule.get("event")
    if wanted != "*" and event.get("event") != wanted:
        return False
    conditions = rule.get("when") or {}
    if not isinstance(conditions, dict):
        return False
    for path, expected in conditions.items():
        actual = _field(event, str(path))
        if isinstance(expected, dict):
            if "exists" in expected and bool(actual is not None) != bool(expected["exists"]):
                return False
            if "eq" in expected and actual != expected["eq"]:
                return False
            if "in" in expected and actual not in expected["in"]:
                return False
            if "min" in expected and (not isinstance(actual, (int, float)) or actual < expected["min"]):
                return False
            if "max" in expected and (not isinstance(actual, (int, float)) or actual > expected["max"]):
                return False
        elif actual != expected:
            return False
    return True


def _render(value: Any, event: dict[str, Any]) -> Any:
    """Render ``{EventField}`` placeholders without evaluating expressions."""
    if not isinstance(value, str):
        return value

    def replace(match: re.Match[str]) -> str:
        found = _field(event, match.group(1))
        return "" if found is None else str(found)

    return re.sub(r"\{([A-Za-z0-9_.-]+)\}", replace, value)[:1000]


def _action_for(extension: Extension, action: dict[str, Any], event: dict[str, Any]) -> dict[str, Any] | None:
    action_type = action.get("type")
    required = "emit:alert" if action_type == "alert" else "emit:objective"
    if required not in extension.permissions:
        return None
    clean = {
        key: _render(value, event)
        for key, value in action.items()
        if key in {"type", "level", "code", "title", "text", "say", "category", "system", "station"}
    }
    clean["type"] = action_type
    clean["extension_id"] = extension.extension_id
    if action_type == "alert" and not clean.get("text"):
        return None
    if action_type == "objective" and not clean.get("title"):
        return None
    return clean


class ExtensionManager:
    def __init__(self, root: Path | None = None):
        self.root = Path(root or EXTENSIONS_DIR)
        self._lock = threading.Lock()
        self._extensions: tuple[Extension, ...] = ()
        self._status = ExtensionStatus()
        self._listeners: list[Callable[[dict[str, Any]], None]] = []
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="extension")
        self._closed = False

    def reload(self) -> dict[str, Any]:
        loaded: list[Extension] = []
        errors: list[dict[str, str]] = []
        try:
            directories = sorted(p for p in self.root.iterdir() if p.is_dir())
        except OSError:
            directories = []
        for directory in directories:
            manifest = directory / "manifest.json"
            if not manifest.is_file():
                continue
            try:
                loaded.append(_normalise_extension(directory, _safe_read_manifest(manifest)))
            except ExtensionError as exc:
                errors.append({"id": directory.name, "error": str(exc)})
        status = ExtensionStatus(
            loaded=[{
                "id": ext.extension_id,
                "name": ext.name,
                "version": ext.version,
                "permissions": sorted(ext.permissions),
                "mode": "process" if ext.command else "declarative",
                "approved": ext.approved if ext.command else True,
            } for ext in loaded],
            errors=errors,
        )
        with self._lock:
            self._extensions = tuple(loaded)
            self._status = status
        return self.snapshot()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "api_version": API_VERSION,
                "directory": str(self.root),
                "loaded": list(self._status.loaded),
                "errors": list(self._status.errors),
            }

    def subscribe(self, listener: Callable[[dict[str, Any]], None]) -> Callable[[], None]:
        with self._lock:
            self._listeners.append(listener)

        def unsubscribe() -> None:
            with self._lock:
                if listener in self._listeners:
                    self._listeners.remove(listener)

        return unsubscribe

    def publish(self, event: dict[str, Any], state: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        if not isinstance(event, dict):
            return []
        with self._lock:
            extensions = self._extensions
            listeners = tuple(self._listeners)
        actions: list[dict[str, Any]] = []
        for extension in extensions:
            if "read:journal" not in extension.permissions:
                continue
            for rule in extension.rules:
                if _matches(rule, event):
                    action = _action_for(extension, rule["action"], event)
                    if action:
                        actions.append(action)
                        if len(actions) >= _MAX_ACTIONS_PER_EVENT:
                            break
            if extension.command and extension.approved:
                payload = {"api_version": API_VERSION, "event": event}
                if "read:state" in extension.permissions:
                    payload["state"] = state or {}
                with self._lock:
                    executor = None if self._closed else self._executor
                if executor is not None:
                    try:
                        executor.submit(self._run_process, extension, payload)
                    except RuntimeError:
                        # shutdown() may win the race after the lock is released.
                        pass
            if len(actions) >= _MAX_ACTIONS_PER_EVENT:
                break
        for action in actions:
            for listener in listeners:
                try:
                    listener(dict(action))
                except Exception:
                    continue
        return actions

    def shutdown(self, wait=True) -> None:
        """Stop accepting process-adapter work and join its worker threads."""
        with self._lock:
            if self._closed:
                return
            self._closed = True
            executor = self._executor
        executor.shutdown(wait=wait, cancel_futures=True)

    def _run_process(self, extension: Extension, payload: dict[str, Any]) -> None:
        command = [str((extension.path / extension.command[0]).resolve()), *extension.command[1:]]
        try:
            result = subprocess.run(
                command,
                input=json.dumps(payload),
                text=True,
                capture_output=True,
                cwd=extension.path,
                timeout=3,
                check=False,
            )
            if result.returncode != 0 or not result.stdout.strip():
                return
            values = json.loads(result.stdout)
            if isinstance(values, dict):
                values = [values]
            if not isinstance(values, list):
                return
            for raw in values[:_MAX_ACTIONS_PER_EVENT]:
                if not isinstance(raw, dict):
                    continue
                action = _action_for(extension, raw, payload["event"])
                if not action:
                    continue
                with self._lock:
                    listeners = tuple(self._listeners)
                for listener in listeners:
                    try:
                        listener(dict(action))
                    except Exception:
                        continue
        except (OSError, ValueError, subprocess.SubprocessError):
            return


EXTENSIONS = ExtensionManager()
