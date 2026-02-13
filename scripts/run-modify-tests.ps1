$base = "http://localhost:3000"

function Invoke-Api($path, $body) {
  $json = $body | ConvertTo-Json -Depth 12
  try {
    $r = Invoke-RestMethod -Method Post -Uri "$base$path" -ContentType "application/json" -Body $json
    return [pscustomobject]@{ status = 200; body = ($r | ConvertTo-Json -Depth 6) }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      return [pscustomobject]@{ status = $resp.StatusCode.value__; body = $reader.ReadToEnd() }
    }
    return [pscustomobject]@{ status = "error"; body = $_.Exception.Message }
  }
}

$results = @{}

$initial = Invoke-Api "/api/generate" @{ userMessage = "Create a dashboard with a navbar, a revenue card, and a chart."; sessionId = "test-mod-1" }
$results.initial = $initial

if ($initial.status -eq 200) {
  $payload = $initial.body | ConvertFrom-Json
  $current = @{
    id = $payload.version.id
    plan = $payload.plan
    code = $payload.code
  }

  $results.addModal = Invoke-Api "/api/modify" @{
    userMessage = "Add a settings modal.";
    sessionId = "test-mod-1";
    currentVersion = $current
  }

  if ($results.addModal.status -eq 200) {
    $payload = $results.addModal.body | ConvertFrom-Json
    $current = @{
      id = $payload.version.id
      plan = $payload.plan
      code = $payload.code
    }
  }

  $results.updateCard = Invoke-Api "/api/modify" @{
    userMessage = "Change the revenue card title to Income.";
    sessionId = "test-mod-1";
    currentVersion = $current
  }

  if ($results.updateCard.status -eq 200) {
    $payload = $results.updateCard.body | ConvertFrom-Json
    $current = @{
      id = $payload.version.id
      plan = $payload.plan
      code = $payload.code
    }
  }

  $results.removeChart = Invoke-Api "/api/modify" @{
    userMessage = "Remove the chart.";
    sessionId = "test-mod-1";
    currentVersion = $current
  }
}

$results | ConvertTo-Json -Depth 6 | Out-File -FilePath .\test-results-modify.json -Encoding utf8
Write-Host "Wrote test-results-modify.json"
