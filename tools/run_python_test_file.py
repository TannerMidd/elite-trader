"""Run one script-style Python test and audit every ``test_*`` definition.

Frameshift deliberately runs each Python test file in its own process because
many modules establish isolated data directories at import time.  A plain
``python test_file.py`` invocation, however, can silently ignore a newly added
pytest-style function.  This wrapper preserves process isolation and fails the
file when any locally defined test function was never called.
"""

import ast
import runpy
import sys
import threading
from pathlib import Path


def discover_test_functions(path):
    """Return every conventional test definition by its stable source location."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    return {
        (node.name, node.lineno)
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name.startswith("test_")
    }


def run_test_file(path):
    path = path.resolve()
    expected = discover_test_functions(path)
    called = set()
    previous_profile = sys.getprofile()
    previous_thread_profile = threading.getprofile()
    previous_argv = sys.argv
    previous_path = list(sys.path)

    def audit_call(frame, event, _argument):
        if event != "call":
            return
        code = frame.f_code
        identity = (code.co_name, code.co_firstlineno)
        if identity not in expected:
            return
        try:
            source = Path(code.co_filename).resolve()
        except (OSError, RuntimeError):
            return
        if source == path:
            called.add(identity)

    sys.setprofile(audit_call)
    threading.setprofile(audit_call)
    sys.argv = [str(path)]
    sys.path.insert(0, str(path.parent))
    try:
        try:
            runpy.run_path(str(path), run_name="__main__")
        except SystemExit as exc:
            if exc.code not in (None, 0):
                raise
    finally:
        sys.setprofile(previous_profile)
        threading.setprofile(previous_thread_profile)
        sys.argv = previous_argv
        sys.path[:] = previous_path

    missing = sorted(expected - called)
    if missing:
        joined = ", ".join(f"{name} (line {line})" for name, line in missing)
        raise RuntimeError(
            f"{path.name} defined test functions that were never executed: {joined}. "
            "Call them from the script entry point or move the check to top-level code."
        )


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if len(argv) != 1:
        raise SystemExit("usage: python tools/run_python_test_file.py PATH")
    path = Path(argv[0])
    if not path.is_file():
        raise SystemExit(f"test file does not exist: {path}")
    run_test_file(path)


if __name__ == "__main__":
    main()
