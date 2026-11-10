function Get-BscDistProcesses {
	Get-CimInstance Win32_Process | Where-Object {
		$_.CommandLine -and (
			$_.CommandLine -eq 'node --trace-warnings --enable-source-maps dist' -or
			($_.Name -eq 'node.exe' -and $_.CommandLine -match 'enable-source-maps dist')
		)
	}
}

$dist = @(Get-BscDistProcesses)
foreach ($proc in $dist) {
	try {
		& node -e "process.kill(Number(process.argv[1]), 'SIGINT')" $proc.ProcessId
	} catch {
		# Process may have already exited.
	}
}

$deadline = (Get-Date).AddSeconds(30)
do {
	Start-Sleep -Seconds 1
	$left = @(Get-BscDistProcesses)
} while ($left.Count -gt 0 -and (Get-Date) -lt $deadline)
