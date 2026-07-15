$uri = "https://kavach-60078268134.development.catalystserverless.in/server/api/api/ask"

function Ask($question) {
    Write-Host "`n=== Q: $question ===" -ForegroundColor Cyan
    $body = @{ question = $question; history = @(); language = "en" } | ConvertTo-Json -Compress
    try {
        $resp = Invoke-WebRequest -Method Post -Uri $uri -ContentType "application/json" -Body $body -UseBasicParsing
        $data = $resp.Content | ConvertFrom-Json
        Write-Host "Status: $($resp.StatusCode)" -ForegroundColor Green
        Write-Host "SQL: $($data.sql)"
        Write-Host "Answer: $($data.answer)"
        if ($data.trace.selfCorrected) { Write-Host "[SELF-CORRECTED]" -ForegroundColor Yellow }
        Write-Host "Rows: $($data.rowCount)"
    } catch {
        $status = $_.Exception.Response.StatusCode
        Write-Host "Status: $status" -ForegroundColor Red
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        $reader.Close()
        $data = $body | ConvertFrom-Json
        Write-Host "Error: $($data.error)" -ForegroundColor Red
        if ($data.detail) { Write-Host "Detail: $($data.detail)" -ForegroundColor DarkRed }
        if ($data.trace.sql) { Write-Host "Trace SQL: $($data.trace.sql)" -ForegroundColor DarkYellow }
    }
}

# Test 1: District comparison (should use GROUP BY DistrictName)
Ask "Which district has the most cases?"

# Test 2: Molestation by district (filter + group)
Ask "Show me molestation cases by district"

# Test 3: Nonsense question (should politely decline via 422)
Ask "What's the weather like today?"

Write-Host "`nAll tests complete." -ForegroundColor Green
