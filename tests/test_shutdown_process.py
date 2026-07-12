"""A real headless process exits and releases Windows file/socket locks."""

import json
import os
import socket
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def assert_renamable(path: Path) -> None:
    if not path.exists():
        return
    check = path.with_name(path.name + ".lockcheck")
    path.rename(check)
    check.rename(path)


with tempfile.TemporaryDirectory() as temp:
    data_dir = Path(temp) / "data"
    journal_dir = Path(temp) / "empty-journals"
    data_dir.mkdir()
    journal_dir.mkdir()
    (data_dir / "settings.json").write_text(json.dumps({
        "journal_dir": str(journal_dir),
        "auto_update": False,
        "eddn_upload": False,
    }), encoding="utf-8")

    port = free_port()
    env = os.environ.copy()
    env["ET_DATA_DIR"] = str(data_dir)
    # Use the same venv launcher as run.bat. The timer raises SIGINT inside the
    # interpreter because headless CI has no real Windows console to receive a
    # GenerateConsoleCtrlEvent broadcast.
    executable = sys.executable

    # CI subprocesses often have no Windows console, so GenerateConsoleCtrlEvent
    # cannot deliver Ctrl+C. Raise SIGINT from a timer once the real HTTP server
    # starts; production signal handling and cleanup remain entirely unmodified.
    child_code = (
        "import signal,sys,threading;import app;"
        + "real_start=app.ServerThread.start;"
        + "exec(\"def signalling_start(server):\\n"
        + " result=real_start(server)\\n"
        + " timer=threading.Timer(0.5,lambda:signal.raise_signal(signal.SIGINT))\\n"
        + " timer.daemon=True;timer.start()\\n return result\");"
        + "app.ServerThread.start=signalling_start;"
        + "sys.argv=['app.py','--headless','--port',sys.argv[1]];"
        + "app.main()"
    )
    process = subprocess.Popen(
        [executable, "-u", "-c", child_code, str(port)],
        cwd=ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        output = process.communicate(timeout=15)[0]
        assert process.returncode == 0, output
        assert "Frameshift running:" in output, output
    except Exception:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        raise

    # The process is gone, the listener socket is reusable, and Windows can
    # rename every persistent file that previously remained locked.
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", port))
    assert_renamable(data_dir / "logs" / "frameshift.log")
    for database in data_dir.glob("*.db"):
        assert_renamable(database)

print("process shutdown OK: Ctrl+C path exits and releases port/log/SQLite locks")
