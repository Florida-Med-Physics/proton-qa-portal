@echo off
cd /d "%~dp0"
if not exist "data\portal.db" (
  echo First run: create the admin account.
  python run_portal.py create-admin || goto :end
)
python run_portal.py serve --open %*
:end
pause
