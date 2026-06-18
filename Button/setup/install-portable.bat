@echo off
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo PowerShell wurde nicht gefunden. Dieses Setup benoetigt Windows PowerShell.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-portable.ps1"
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo Setup fehlgeschlagen. Fehlercode: %EXITCODE%
  pause
  exit /b %EXITCODE%
)

echo.
echo Fertig. Der Ordner kann jetzt offline per USB-Stick verwendet werden.
echo Starte dazu start.bat oder start-portable.bat.
pause
