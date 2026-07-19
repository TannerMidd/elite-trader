"""The isolated Python-test runner rejects silently dormant test functions."""

import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RUNNER = ROOT / "tools" / "run_python_test_file.py"

with tempfile.TemporaryDirectory() as temp:
    directory = Path(temp)
    called = directory / "test_called.py"
    called.write_text(
        "def test_called():\n"
        "    return 'ran'\n"
        "\n"
        "test_called()\n",
        encoding="utf-8",
    )
    forgotten = directory / "test_forgotten.py"
    forgotten.write_text(
        "def test_forgotten():\n"
        "    return 'never reached'\n",
        encoding="utf-8",
    )
    shadowed = directory / "test_shadowed.py"
    shadowed.write_text(
        "def test_duplicate():\n"
        "    return 'shadowed'\n"
        "\n"
        "def test_duplicate():\n"
        "    return 'called'\n"
        "\n"
        "test_duplicate()\n",
        encoding="utf-8",
    )
    plain = directory / "test_plain.py"
    plain.write_text("assert 2 + 2 == 4\n", encoding="utf-8")

    success = subprocess.run(
        [sys.executable, str(RUNNER), str(called)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert success.returncode == 0, success.stderr

    no_functions = subprocess.run(
        [sys.executable, str(RUNNER), str(plain)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert no_functions.returncode == 0, no_functions.stderr

    failure = subprocess.run(
        [sys.executable, str(RUNNER), str(forgotten)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert failure.returncode != 0
    assert "test_forgotten" in failure.stderr
    assert "never executed" in failure.stderr

    duplicate = subprocess.run(
        [sys.executable, str(RUNNER), str(shadowed)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert duplicate.returncode != 0
    assert "test_duplicate (line 1)" in duplicate.stderr

print("Python test runner OK: dormant test_* definitions fail the isolated process")
