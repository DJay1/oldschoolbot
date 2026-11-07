@echo off
setlocal
cd /d "%~dp0"
echo [%date% %time%] backup starting
echo [%date% %time%] backup starting>> backup-prod.log
call pnpm backup:prod >> backup-prod.log 2>&1
set EXITCODE=%errorlevel%
echo [%date% %time%] backup finished with %EXITCODE%
echo [%date% %time%] backup finished with %EXITCODE%>> backup-prod.log
exit /b %EXITCODE%
