@echo off
REM One-click local launcher for Windows - double-click to start the Live2D app.
REM No manual setup: finds (or downloads a portable) Node.js, installs deps the
REM first time, prepares a local file-based database + storage, then opens the
REM app in your browser. Close this window to stop the app.
setlocal enabledelayedexpansion

REM --- Locate the app directory ------------------------------------------------
REM APP_DIR is baked when copied to Downloads; else resolves to this script's
REM project location (apps\web\launch\..).
if "%APP_DIR%"=="" (
  pushd "%~dp0\.." && set "APP_DIR=!CD!" && popd
)
cd /d "%APP_DIR%"
echo ================================================
echo   Live2D Local Launcher
echo   Dir: %APP_DIR%
echo ================================================

REM --- 1. Node.js: system install, or a portable copy --------------------------
where node >nul 2>nul
if %errorlevel%==0 (
  set "NPM=npm"
  echo Node.js detected.
) else (
  set "NODE_DIR=%APP_DIR%\.local-node"
  if not exist "!NODE_DIR!\node.exe" (
    echo Node.js not found. Downloading portable Node.js ^(no install, no admin^)...
    set "NODE_VER=v20.18.1"
    powershell -NoProfile -Command ^
      "$u='https://nodejs.org/dist/%NODE_VER%/node-%NODE_VER%-win-x64.zip';" ^
      "$z=\"$env:TEMP\node.zip\"; Invoke-WebRequest $u -OutFile $z;" ^
      "Expand-Archive $z -DestinationPath \"$env:TEMP\node-x\" -Force;" ^
      "$src=Get-ChildItem \"$env:TEMP\node-x\" -Directory | Select-Object -First 1;" ^
      "New-Item -ItemType Directory -Force -Path '!NODE_DIR!' ^| Out-Null;" ^
      "Copy-Item \"$($src.FullName)\*\" -Destination '!NODE_DIR!' -Recurse -Force"
  )
  set "PATH=!NODE_DIR!;%PATH%"
  set "NPM=!NODE_DIR!\npm.cmd"
)

REM --- 2. Local environment file ----------------------------------------------
if not exist .env type nul > .env
findstr /b /c:"PGLITE_DATA_DIR=" .env >nul || echo PGLITE_DATA_DIR="./.pglite">> .env
findstr /b /c:"STORAGE_DRIVER=" .env >nul || echo STORAGE_DRIVER="local">> .env
findstr /b /c:"AUTH_URL=" .env >nul || echo AUTH_URL="http://localhost:3000">> .env
findstr /b /c:"AUTH_SECRET=" .env >nul || (
  for /f %%i in ('powershell -NoProfile -Command "[Convert]::ToBase64String((1..32 ^| %%{Get-Random -Max 256}))"') do echo AUTH_SECRET="%%i">> .env
)

REM --- 3. First-run setup -----------------------------------------------------
if not exist node_modules ( echo First run: installing dependencies... & call "%NPM%" install )
if not exist ".pglite\.initialized" (
  echo First run: initializing local database and demo characters...
  call "%NPM%" run db:push
  call "%NPM%" run db:seed
  call "%NPM%" run setup:creator-models
  if not exist .pglite mkdir .pglite
  type nul > ".pglite\.initialized"
)

REM --- 4. Start server + open browser -----------------------------------------
echo.
echo Starting... your browser will open automatically.
echo Login: creator / ChangeMe123!  (creator)   admin / ChangeMe123!  (admin)
echo Keep this window open = running; close it = stop.
echo.
start "" powershell -NoProfile -Command "for($i=0;$i -lt 90;$i++){try{Invoke-WebRequest http://localhost:3000 -UseBasicParsing -TimeoutSec 2 ^| Out-Null; Start-Process 'http://localhost:3000'; break}catch{Start-Sleep 1}}"
call "%NPM%" run dev
