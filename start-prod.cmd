@echo off
setlocal
title BSC production
cd /d "%~dp0"
if not exist logs mkdir logs
:loop
echo [%date% %time%] starting production
echo [%date% %time%] starting production>> bot-prod.log
where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm was not on PATH. Install Node.js and run: corepack enable
  echo [%date% %time%] pnpm was not on PATH>> bot-prod.log
  ping -n 31 127.0.0.1 >nul
  goto loop
)
if not exist dist\index.js (
  echo dist\index.js is missing. From this folder run: pnpm build:quick
  echo [%date% %time%] dist\index.js is missing>> bot-prod.log
  ping -n 31 127.0.0.1 >nul
  goto loop
)
call pnpm start:prod >> bot-prod.log 2>&1
echo [%date% %time%] production exited with %errorlevel%. Restarting in 10 seconds.
echo [%date% %time%] production exited with %errorlevel%. Restarting in 10 seconds.>> bot-prod.log
ping -n 11 127.0.0.1 >nul
goto loop
