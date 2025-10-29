@echo off
REM GetMe Package Host Startup Script for Windows
REM Starts the hosting server for LMeve GetMe packages

cd /d "%~dp0"

REM Default port - can be overridden
set PORT=%1
if "%PORT%"=="" set PORT=8080

echo 🚀 Starting GetMe Package Host...
echo 📁 Working directory: %CD%
echo 🌐 Port: %PORT%
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is required but not installed
    echo Please install Node.js to run the hosting server
    pause
    exit /b 1
)

REM Check if the host server exists
if not exist "host-server.js" (
    echo ❌ host-server.js not found in current directory
    echo Make sure you're running this from the scripts\Client directory
    pause
    exit /b 1
)

echo Starting server...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

REM Start the server
node host-server.js %PORT%