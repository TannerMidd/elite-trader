"""Elite Trader - lightweight Elite Dangerous companion.

Desktop window (pywebview) + LAN-visible web app backed by one Flask server.
Run `python app.py --headless` for server-only mode (view from any browser).
"""

import argparse
import os
import socket
import sys
import time
import urllib.request
import webbrowser

from elite.journal import JournalWatcher
from elite.server import ServerThread
from elite.state import AppState

DEFAULT_PORT = int(os.environ.get("ET_PORT", "8666"))


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))  # no packets sent; just picks the LAN interface
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def instance_already_running(port):
    """True if an Elite Trader server is already answering on this port. Prevents
    a second launch from double-binding the port (SO_REUSEADDR would otherwise
    let two servers coexist and fight over requests — the zombie-process trap)."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/state", timeout=1.5) as r:
            return r.status == 200
    except Exception:
        return False


def start_window():
    """Show the desktop window. pywebview defaults to private mode, which
    wipes localStorage every launch — that silently reset the per-device
    interface-size sliders (and any other browser-side preference) in the
    main window. Persist the profile in data\\webview next to the rest."""
    import webview

    from elite import marketdb

    storage = marketdb.DATA_DIR / "webview"
    storage.mkdir(parents=True, exist_ok=True)
    webview.start(private_mode=False, storage_path=str(storage))


class WindowApi:
    """Bridge so links clicked inside the pywebview window open in the real browser."""

    def open_url(self, url):
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            webbrowser.open(url)

    def open_inline(self, url, title=None):
        """Open a site in a child window inside the app (Inara results 'inline').
        A real WebView2 browser, so Inara's bot protection is not an issue."""
        if not (isinstance(url, str) and url.startswith(("http://", "https://"))):
            return
        import webview

        webview.create_window(str(title or "Browser"), url, width=1150, height=850)


def main():
    parser = argparse.ArgumentParser(description="Elite Dangerous companion app")
    parser.add_argument("--headless", action="store_true", help="run the web server only (no window)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    from elite.updater import UPDATER

    UPDATER.cleanup_leftovers()  # remove any staging files from a prior update

    local_url = f"http://127.0.0.1:{args.port}"

    # Single-instance guard: if we're already running, just show the window that
    # points at the existing server instead of starting a second, conflicting one.
    if instance_already_running(args.port):
        print(f"Elite Trader is already running on {local_url} — opening a window to it.")
        if not args.headless:
            import webview

            webview.create_window("Elite Trader", local_url, js_api=WindowApi(),
                                  width=1060, height=800, min_size=(760, 560))
            start_window()
        return

    state = AppState()
    JournalWatcher(state).start()

    from elite.eddn import LISTENER

    LISTENER.start()  # keeps the local market DB fresh; no-ops until it's seeded

    server = ServerThread(state, port=args.port)
    server.start()

    print(f"Elite Trader running:")
    print(f"  this machine:  {local_url}")
    print(f"  on your LAN:   http://{lan_ip()}:{args.port}")

    # Whatever happens (window closed, error, Ctrl+C), stop the server so no
    # thread or socket is left behind holding the port.
    try:
        if args.headless:
            while True:
                time.sleep(3600)
        else:
            import webview

            webview.create_window(
                "Elite Trader",
                local_url,
                js_api=WindowApi(),
                width=1060,
                height=800,
                min_size=(760, 560),
            )
            start_window()
    except KeyboardInterrupt:
        pass
    finally:
        try:
            server.shutdown()
        except Exception:
            pass


if __name__ == "__main__":
    main()
