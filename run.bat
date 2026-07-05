@echo off
cd /d "%~dp0"
if not exist .venv (
    echo First run: creating virtual environment and installing dependencies...
    py -3 -m venv .venv
    .venv\Scripts\python -m pip install --upgrade pip
    .venv\Scripts\python -m pip install -r requirements.txt
)
.venv\Scripts\python app.py %*
if errorlevel 1 pause
