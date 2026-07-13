"""Local-first authentication for the LAN web interface.

Frameshift deliberately needs no account or password.  Requests arriving on
the loopback interface are trusted, preserving the zero-friction desktop
experience.  A second device is admitted by opening a short-lived capability
link shown by the desktop app; the capability is exchanged once for a random,
revocable HttpOnly session cookie.

Only token digests are persisted.  The pairing capability itself lives in
memory and expires quickly, so copying an old URL or a security.json backup
cannot enroll another device.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import logging
import os
import secrets
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from .errors import ValidationError


COOKIE_NAME = "frameshift_session"
ALL_SCOPES = ("read", "control", "admin")
_SCOPE_LEVEL = {name: i for i, name in enumerate(ALL_SCOPES)}
_MAX_DEVICE_NAME = 80


class SecurityStoreError(RuntimeError):
    """The device registry could not be safely persisted."""


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def is_loopback(address):
    """Return True only for a literal loopback peer address.

    Proxy headers are intentionally ignored: Frameshift is its own edge
    server, and trusting X-Forwarded-For would let a LAN client claim to be the
    desktop process.
    """
    try:
        peer = ipaddress.ip_address((address or "").split("%", 1)[0])
        if isinstance(peer, ipaddress.IPv6Address) and peer.ipv4_mapped:
            peer = peer.ipv4_mapped
        return peer.is_loopback
    except ValueError:
        return False


def normalize_scopes(scopes):
    """Validate and expand a permission set according to its hierarchy."""
    if isinstance(scopes, str):
        scopes = [scopes]
    try:
        requested = {str(s).lower() for s in (scopes or ())}
    except TypeError as exc:
        raise ValidationError("Permissions must include read, control, or admin.") from exc
    if not requested or not requested.issubset(_SCOPE_LEVEL):
        raise ValidationError("Permissions must include read, control, or admin.")
    highest = max(_SCOPE_LEVEL[s] for s in requested)
    return list(ALL_SCOPES[: highest + 1])


def _clean_device_name(name):
    name = " ".join(str(name or "LAN device").split())
    name = "".join(c for c in name if c.isprintable())[:_MAX_DEVICE_NAME]
    return name or "LAN device"


def _digest(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class SecurityManager:
    """Persistent device registry plus an in-memory one-time pairing grant."""

    def __init__(self, data_dir, now=None):
        self.path = Path(data_dir) / "security.json"
        self._now = now or time.time
        self._lock = threading.RLock()
        self._devices = []
        self._pairing = None
        self._load()

    def _load(self):
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            devices = raw.get("devices", [])
            if not isinstance(devices, list):
                raise ValueError("devices is not a list")
            clean = []
            for item in devices:
                if not isinstance(item, dict):
                    continue
                token_hash = item.get("token_hash")
                if not isinstance(token_hash, str) or len(token_hash) != 64:
                    continue
                try:
                    scopes = normalize_scopes(item.get("scopes"))
                except (TypeError, ValueError):
                    continue
                clean.append({
                    "id": str(item.get("id") or uuid.uuid4().hex),
                    "name": _clean_device_name(item.get("name")),
                    "token_hash": token_hash,
                    "scopes": scopes,
                    "created_at": str(item.get("created_at") or utc_now()),
                    "last_seen": item.get("last_seen"),
                    "last_ip": str(item.get("last_ip") or "")[:64],
                })
            self._devices = clean
        except FileNotFoundError:
            self._devices = []
        except (OSError, ValueError, TypeError) as exc:
            # Fail closed for LAN clients: no digest from a damaged file is
            # accepted.  Localhost remains available to repair/re-pair.
            logging.getLogger(__name__).error("could not load device registry: %s", exc)
            self._devices = []

    def _save_locked(self):
        temp = self.path.with_name(self.path.name + ".tmp")
        # Never leak transient bookkeeping fields into the on-disk format.
        fields = ("id", "name", "token_hash", "scopes", "created_at",
                  "last_seen", "last_ip")
        payload = {"version": 1, "devices": [
            {key: device.get(key) for key in fields} for device in self._devices
        ]}
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with open(temp, "w", encoding="utf-8", newline="\n") as handle:
                json.dump(payload, handle, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            try:
                os.chmod(temp, 0o600)
            except OSError:
                pass
            os.replace(temp, self.path)
        except OSError as exc:
            try:
                temp.unlink(missing_ok=True)
            except OSError:
                pass
            raise SecurityStoreError("Could not save the paired-device registry.") from exc

    @staticmethod
    def public_device(device):
        public = {k: device.get(k) for k in
                  ("id", "name", "scopes", "created_at", "last_seen", "last_ip")}
        public["scopes"] = list(public.get("scopes") or ())
        return public

    def issue_pairing(self, scopes=ALL_SCOPES, ttl_seconds=900):
        """Create (or return) a short-lived capability grant.

        Repeated status polling does not invalidate a link already on screen.
        A caller can explicitly request a different grant to rotate it.
        """
        scopes = normalize_scopes(scopes)
        ttl = max(60, min(3600, int(ttl_seconds)))
        now = self._now()
        with self._lock:
            current = self._pairing
            if (current and current["expires_at"] > now
                    and current["scopes"] == scopes):
                return {"code": current["code"], "expires_at": current["expires_at"],
                        "scopes": list(current["scopes"])}
            self._pairing = {
                "code": secrets.token_urlsafe(24),
                "expires_at": now + ttl,
                "scopes": scopes,
            }
            return {"code": self._pairing["code"],
                    "expires_at": self._pairing["expires_at"],
                    "scopes": list(self._pairing["scopes"])}

    def current_pairing(self):
        """Return the live grant without rotating or changing its permissions."""
        now = self._now()
        with self._lock:
            grant = self._pairing
            if not grant or grant["expires_at"] <= now:
                self._pairing = None
                return None
            return {
                "code": grant["code"],
                "expires_at": grant["expires_at"],
                "scopes": list(grant["scopes"]),
            }

    def rotate_pairing(self, scopes=ALL_SCOPES, ttl_seconds=900):
        with self._lock:
            self._pairing = None
        return self.issue_pairing(scopes, ttl_seconds)

    def pair(self, code, name, remote_ip=""):
        """Consume a one-time capability and return (token, public device)."""
        now = self._now()
        with self._lock:
            grant = self._pairing
            if (not grant or grant["expires_at"] <= now or not isinstance(code, str)
                    or not hmac.compare_digest(code, grant["code"])):
                return None
            # Consume before touching disk: a concurrent second request cannot
            # race the same capability into two device credentials.
            self._pairing = None
            token = secrets.token_urlsafe(32)
            device = {
                "id": uuid.uuid4().hex,
                "name": _clean_device_name(name),
                "token_hash": _digest(token),
                "scopes": list(grant["scopes"]),
                "created_at": utc_now(),
                "last_seen": utc_now(),
                "last_ip": str(remote_ip or "")[:64],
            }
            self._devices.append(device)
            try:
                self._save_locked()
            except SecurityStoreError:
                self._devices.remove(device)
                raise
            return token, self.public_device(device)

    def authenticate(self, token, remote_ip=""):
        if not token or not isinstance(token, str) or len(token) > 256:
            return None
        digest = _digest(token)
        now = self._now()
        with self._lock:
            found = next((d for d in self._devices
                          if hmac.compare_digest(d["token_hash"], digest)), None)
            if not found:
                return None
            # Record useful audit metadata, but avoid a disk write on every
            # one-second state poll.
            last_write = float(found.get("_seen_epoch") or 0)
            if now - last_write >= 300:
                found["last_seen"] = utc_now()
                found["last_ip"] = str(remote_ip or "")[:64]
                found["_seen_epoch"] = now
                try:
                    self._save_locked()
                except SecurityStoreError:
                    logging.getLogger(__name__).warning("could not update device last-seen")
            return self.public_device(found)

    def list_devices(self):
        with self._lock:
            return [self.public_device(d) for d in self._devices]

    def update_device(self, device_id, *, name=None, scopes=None):
        with self._lock:
            device = next((d for d in self._devices if d["id"] == device_id), None)
            if not device:
                return None
            old = dict(device)
            if name is not None:
                device["name"] = _clean_device_name(name)
            if scopes is not None:
                device["scopes"] = normalize_scopes(scopes)
            try:
                self._save_locked()
            except SecurityStoreError:
                device.clear()
                device.update(old)
                raise
            return self.public_device(device)

    def revoke(self, device_id):
        with self._lock:
            old = list(self._devices)
            self._devices = [d for d in old if d["id"] != device_id]
            if len(old) == len(self._devices):
                return False
            try:
                self._save_locked()
            except SecurityStoreError:
                self._devices = old
                raise
            return True


class RateLimiter:
    """Small thread-safe fixed-window limiter for the local HTTP service."""

    def __init__(self, now=None):
        self._now = now or time.monotonic
        self._events = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key, limit, window_seconds):
        now = self._now()
        with self._lock:
            events = self._events[key]
            cutoff = now - window_seconds
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                return False, max(1, int(window_seconds - (now - events[0])))
            events.append(now)
            # Opportunistic cleanup keeps a scanner from growing this map
            # forever while retaining the implementation dependency-free.
            if len(self._events) > 2048:
                cleanup_cutoff = now - 3600  # longer than every configured window
                for stale_key in list(self._events)[:512]:
                    queue = self._events[stale_key]
                    while queue and queue[0] <= cleanup_cutoff:
                        queue.popleft()
                    if not queue:
                        self._events.pop(stale_key, None)
            return True, 0
