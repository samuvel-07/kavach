$body = @{
    question = "How many robbery cases were registered in 2025?"
} | ConvertTo-Json -Compress

$uri = "https://kavach-60078268134.development.catalystserverless.in/server/api/api/ask"

try {
    $response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
    $reader.ReadToEnd()
    $reader.Close()
}
