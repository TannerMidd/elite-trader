#!/usr/bin/env bash
# Linux launcher. Recommended: ./run.sh --headless  (then open the printed URL)
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
    echo "First run: creating virtual environment..."
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
fi
.venv/bin/pip install --quiet -r requirements.txt
exec .venv/bin/python app.py "$@"
