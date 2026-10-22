@echo off
cd /d "%~dp0"
set PY=python
if exist ".venv\Scripts\python.exe" set PY=.venv\Scripts\python.exe
if not exist "data\portal.db" (
  echo First run: create the admin account.
  %PY% run_portal.py create-admin || goto :end
  echo Loading the machines and daily QA templates.
  %PY% run_portal.py seed-defaults --user admin || goto :end
)
%PY% run_portal.py serve --open %*
:end
pause
