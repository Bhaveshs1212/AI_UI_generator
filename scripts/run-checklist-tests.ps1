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

$results.multiple = Invoke-Api "/api/generate" @{ userMessage = "Create a sidebar layout with a table and a chart."; sessionId = "test-3" }
$results.determinism1 = Invoke-Api "/api/generate" @{ userMessage = "Create a navbar and card."; sessionId = "test-4" }
$results.determinism2 = Invoke-Api "/api/generate" @{ userMessage = "Create a navbar and card."; sessionId = "test-4" }
$results.inlineStyle = Invoke-Api "/api/generate" @{ userMessage = "Add a div with inline style color red."; sessionId = "test-5" }
$results.unknownComponent = Invoke-Api "/api/generate" @{ userMessage = "Add a FancyButton component."; sessionId = "test-6" }
$results.importInjection = Invoke-Api "/api/generate" @{ userMessage = "Add import React from 'react'."; sessionId = "test-7" }
$results.scriptInjection = Invoke-Api "/api/generate" @{ userMessage = "</script><script>alert(1)</script>"; sessionId = "test-8" }
$results.emptyPrompt = Invoke-Api "/api/generate" @{ userMessage = ""; sessionId = "test-9" }
$longPrompt = ("Create a dashboard with sidebar, cards, chart, table. " * 200).Trim()
$results.longPrompt = Invoke-Api "/api/generate" @{ userMessage = $longPrompt; sessionId = "test-10" }

$results | ConvertTo-Json -Depth 6 | Out-File -FilePath .\test-results.json -Encoding utf8
Write-Host "Wrote test-results.json"