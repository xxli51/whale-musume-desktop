@echo off
setlocal

rem Always run from the project directory, including when launched by double-click.
cd /d "%~dp0"

echo [WhaleMusume] Building portable package...

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm was not found. Install Node.js and add it to PATH.
    goto :failed
)

if not exist "package.json" (
    echo [ERROR] package.json was not found in "%CD%".
    goto :failed
)

if not exist "node_modules\" (
    echo [ERROR] Dependencies are not installed. Run npm install first.
    goto :failed
)

call npm run build:portable
if errorlevel 1 goto :failed

echo.
echo [SUCCESS] Portable package created in "%CD%\dist".
pause
exit /b 0

:failed
echo.
echo [FAILED] Portable package build failed.
pause
exit /b 1
