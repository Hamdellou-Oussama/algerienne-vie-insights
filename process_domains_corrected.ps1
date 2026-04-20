$baseUrl = "http://127.0.0.1:8001/api/v1"
try {
    Write-Host "Checking health..."
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    if ($health.status -ne "ok") { throw "Health check failed" }

    Write-Host "Logging in..."
    $loginBody = @{ username = "admin"; password = "azerty" } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.access_token
    $headers = @{ Authorization = "Bearer $token" }

    $domains = @{
        "ppna" = "backend/data/level 01-level2-ÉCHANTILLON DATA PPNA.xlsx"
        "sap"  = "backend/data/level 01-DATA SAP groupe.xlsx"
        "pe"   = "backend/data/level 01-ÉCHANTILLON DATA PE.xlsx"
        "pb"   = "backend/data/ÉCHANTILLON DATA PB (1).xlsx"
        "ibnr" = "backend/data/level 02-ÉCHANTILLON DATA IBNR.xlsx"
    }

    $domainResults = @{}
    foreach ($domain in $domains.Keys) {
        try {
            $filePath = $domains[$domain]
            $fileName = [System.IO.Path]::GetFileName($filePath)
            Write-Host "Processing $domain..."
            
            $boundary = [System.Guid]::NewGuid().ToString()
            $LF = "`r`n"
            $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Simplified headers for form-data
            $fileHeader = "--$boundary$LF" +
                          "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"$LF" +
                          "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet$LF$LF"
            $fileFooter = "$LF--$boundary--$LF"
            
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($fileHeader)
            $footerBytes = [System.Text.Encoding]::ASCII.GetBytes($fileFooter)
            
            $bodyBytes = New-Object byte[] ($headerBytes.Length + $fileBytes.Length + $footerBytes.Length)
            [System.Buffer]::BlockCopy($headerBytes, 0, $bodyBytes, 0, $headerBytes.Length)
            [System.Buffer]::BlockCopy($fileBytes, 0, $bodyBytes, $headerBytes.Length, $fileBytes.Length)
            [System.Buffer]::BlockCopy($footerBytes, 0, $bodyBytes, ($headerBytes.Length + $fileBytes.Length), $footerBytes.Length)
            
            $uploadUrl = "$baseUrl/$domain/documents?filename=$fileName"
            # Using try-catch around Invoke-RestMethod to capture the actual error body
            try {
                $doc = Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $headers -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyBytes
            } catch {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $errBody = $reader.ReadToEnd()
                throw $errBody
            }
            
            # The "id" field is what should be used for document_id
            $docId = $doc.id

            $runPayload = @{ document_id = $docId; parameters = @{} } | ConvertTo-Json
            $run = Invoke-RestMethod -Uri "$baseUrl/$domain/runs" -Method Post -Headers $headers -ContentType "application/json" -Body $runPayload
            $runId = $run.id

            $runStatus = "pending"
            for ($i=0; $i -lt 30; $i++) {
                Start-Sleep -Seconds 1
                $runInfo = Invoke-RestMethod -Uri "$baseUrl/$domain/runs/$runId" -Method Get -Headers $headers
                $runStatus = $runInfo.status
                if ($runStatus -ne "pending") { break }
            }

            $rows = Invoke-RestMethod -Uri "$baseUrl/$domain/runs/$runId/rows" -Method Get -Headers $headers
            $domainResults[$domain] = @{ status = $runStatus; rowCount = $rows.Count; runId = $runId }
        } catch {
            Write-Host "Error processing $domain : $_"
            $domainResults[$domain] = @{ status = "failed"; error = $_.ToString() }
        }
    }

    $summary = Invoke-RestMethod -Uri "$baseUrl/dashboard/summary" -Method Get -Headers $headers
    $completion = Invoke-RestMethod -Uri "$baseUrl/dashboard/completion" -Method Get -Headers $headers

    $finalOutput = @{
        domainResults = $domainResults
        dashboardSummary = $summary
        dashboardCompletion = $completion
    }
    $finalOutput | ConvertTo-Json -Depth 10
} catch {
    Write-Error $_
    exit 1
}
