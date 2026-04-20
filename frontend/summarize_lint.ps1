$json = Get-Content lint-results.json | ConvertFrom-Json
$totalErrors = ($json | Measure-Object -Property errorCount -Sum).Sum
$totalWarnings = ($json | Measure-Object -Property warningCount -Sum).Sum
Write-Host "Total Errors: $totalErrors"
Write-Host "Total Warnings: $totalWarnings"
$ruleCounts = @{}
$fileCounts = @{}
foreach ($file in $json) {
    if ($file.messages.Count -gt 0) {
        $fileCounts[$file.filePath] = $file.messages.Count
        foreach ($msg in $file.messages) {
            $ruleId = $msg.ruleId
            if (-not $ruleId) { $ruleId = "Parser/Internal Error" }
            $ruleCounts[$ruleId]++
        }
    }
}
Write-Host "`nTop 10 Rules:"
$ruleCounts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 10 | ForEach-Object { Write-Host "$($_.Key): $($_.Value)" }
Write-Host "`nTop 10 Files:"
$fileCounts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 10 | ForEach-Object { Write-Host "$($_.Key): $($_.Value)" }
