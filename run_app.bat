@echo off
setlocal
set "APP_NAME=SPA SQL Supporter"
title %APP_NAME% - Startup

echo ======================================================
echo    Initializing %APP_NAME%...
echo ======================================================

:: 1. Check for uv
where uv >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] uv is not installed or not in PATH.
    echo Please install it first from: https://github.com/astral-sh/uv
    pause
    exit /b 1
)

:: 2. Ensure environment is synced
echo [1/2] Syncing dependencies...
uv sync --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Dependency sync failed.
    pause
    exit /b 1
)

:: 3. Run the app
echo [2/2] Starting server...
echo ------------------------------------------------------
echo Access the app at: http://127.0.0.1:5000
echo (Press Ctrl+C in this window to stop)
echo ------------------------------------------------------
uv run python app.py

pause
