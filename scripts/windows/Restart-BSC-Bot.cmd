@echo off
echo Stopping Bark School Corgo (live)...
rem Ask the bot to finish in-flight trips (SIGINT). Wait up to 30 seconds, then force-kill leftovers.
powershell -NoProfile -File "%~dp0graceful-stop-bsc.ps1"
powershell -NoProfile -Command "Get-CimInstance Win32_Process | ? { ($_.CommandLine -match 'start-prod|start:prod|bsc.prod.*dist|dotenv.*production' -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'trace-warnings')) -and $_.ProcessId -ne $PID } | %% { taskkill /PID $_.ProcessId /T /F 2>$null | Out-Null }"
echo Starting Bark School Corgo (live)...
rem Prefer npm-global pnpm; Program Files pnpm is broken via corepack signature mismatch
set "PATH=C:\Users\DJ\AppData\Roaming\npm;%PATH%"
start "BSC production" /min /d C:\bsc\prod cmd /c C:\bsc\prod\start-prod.cmd
echo Done. Give it about 30 seconds to come online.
timeout /t 5
