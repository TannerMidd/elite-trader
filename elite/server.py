"""Flask server: serves the UI and the JSON API (bound to the LAN)."""

import logging
import threading
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.serving import make_server

from . import links, spansh

UI_DIR = Path(__file__).resolve().parent.parent / "ui"


def create_app(state):
    app = Flask(__name__, static_folder=str(UI_DIR), static_url_path="")

    @app.get("/")
    def index():
        return send_from_directory(str(UI_DIR), "index.html")

    @app.get("/api/state")
    def api_state():
        snap = state.snapshot()
        snap["links"] = links.build_links(snap.get("system"), snap.get("station"))
        resp = jsonify(snap)
        resp.headers["Cache-Control"] = "no-store"
        return resp

    @app.post("/api/trade-route")
    def api_trade_route():
        snap = state.snapshot()
        body = request.get_json(silent=True) or {}

        def num(key, default, cast=float):
            try:
                return cast(body.get(key, default))
            except (TypeError, ValueError):
                return default

        try:
            hops = spansh.plan_route(
                system=body.get("system") or snap.get("system"),
                station=body.get("station") or (snap.get("station") if snap.get("docked") else None),
                capital=num("capital", snap.get("credits") or 100000, int),
                max_cargo=num("max_cargo", snap.get("cargo_capacity") or 8, int),
                max_hop_distance=num("max_hop_distance", snap.get("max_jump_range") or 25.0),
                max_hops=num("max_hops", 4, int),
                max_system_distance=num("max_system_distance", 1000, int),
                max_price_age_days=num("max_price_age_days", 30, int),
                requires_large_pad=bool(body.get("requires_large_pad", False)),
                allow_planetary=bool(body.get("allow_planetary", True)),
                unique=bool(body.get("unique", False)),
            )
        except spansh.SpanshError as exc:
            return jsonify({"error": str(exc)}), 502
        return jsonify({"hops": hops})

    return app


class ServerThread:
    def __init__(self, state, host="0.0.0.0", port=8666):
        logging.getLogger("werkzeug").setLevel(logging.WARNING)
        self._server = make_server(host, port, create_app(state), threaded=True)
        self._thread = threading.Thread(
            target=self._server.serve_forever, name="http-server", daemon=True
        )

    def start(self):
        self._thread.start()

    def shutdown(self):
        self._server.shutdown()
