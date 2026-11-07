@echo off
setlocal
cd /d "%~dp0"
echo [%date% %time%] test backup starting
echo [%date% %time%] test backup starting>> backup-test.log
call pnpm backup:test >> backup-test.log 2>&1
set EXITCODE=%errorlevel%
echo [%date% %time%] test backup finished with %EXITCODE%
echo [%date% %time%] test backup finished with %EXITCODE%>> backup-test.log
exit /b %EXITCODE%
