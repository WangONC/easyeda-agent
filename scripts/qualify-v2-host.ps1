param([Parameter(Mandatory=$true)][string]$Action,[Parameter(Mandatory=$true)][string]$TargetFile,[Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$EvidenceStem,[int]$BudgetMS=30000)
$ErrorActionPreference='Stop'
# Qualification only. Each stem is single-use; UNKNOWN must be reconciled by its
# existing operation ID. This harness never retries, guesses a target, or opens UI.
if (Test-Path -LiteralPath ($EvidenceStem+'-request.json')) { throw 'Evidence stem already used; query/reconcile original operation instead' }
$catalog=Get-Content (Join-Path $PSScriptRoot '../extension/src/v2-catalog.generated.json') -Raw | ConvertFrom-Json
$spec=$catalog.$Action
if (-not $spec) { throw 'Action has no V2 native contract' }
$target=Get-Content -LiteralPath $TargetFile -Raw | ConvertFrom-Json
$inputValue=Get-Content -LiteralPath $InputFile -Raw | ConvertFrom-Json
$request=@{protocol='execution.v2';action=$Action;action_revision=$spec.revision;schema=$spec.schema;request_id=[guid]::NewGuid().ToString();operation_id=[guid]::NewGuid().ToString();target_ref=$target;input=$inputValue;budget_ms=$BudgetMS}
$request | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath ($EvidenceStem+'-request.json') -Encoding utf8NoBOM
$result=& $env:EASYEDA_BIN v2 call ('@'+$EvidenceStem+'-request.json')
$code=$LASTEXITCODE
$result | Set-Content -LiteralPath ($EvidenceStem+'-result.json') -Encoding utf8NoBOM
$result
exit $code
