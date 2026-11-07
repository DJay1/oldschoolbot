@echo off
setlocal
title BSC test
cd /d "%~dp0"
if not exist logs mkdir logs
:loop
echo [%date% %time%] starting test
echo [%date% %time%] starting test>> bot-test.log
where pnpm >nul 2>&1
if errorlevel 1 (
  echo pnpm was not on PATH. Install Node.js and run: corepack enable
  echo [%date% %time%] pnpm was not on PATH>> bot-test.log
  ping -n 31 127.0.0.1 >nul
  goto loop
)
if not exist dist\index.js (
  echo dist\index.js is missing. From this folder run: pnpm build:quick
  echo [%date% %time%] dist\index.js is missing>> bot-test.log
  ping -n 31 127.0.0.1 >nul
  goto loop
)
call pnpm start:test >> bot-test.log 2>&1
echo [%date% %time%] test exited with %errorlevel%. Restarting in 10 seconds.
echo [%date% %time%] test exited with %errorlevel%. Restarting in 10 seconds.>> bot-test.log
ping -n 11 127.0.0.1 >nul
goto loop
