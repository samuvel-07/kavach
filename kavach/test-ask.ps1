param([string]$q = "How many robbery cases were registered in 2025?")
$body = @{ question = $q } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Post -Uri "https://kavach-60078268134.development.catalystserverless.in/server/api/api/ask" -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 6
} catch {
  $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
  Write-Host $reader.ReadToEnd()
}
