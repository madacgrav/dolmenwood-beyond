# Pulls local-dev secrets from Azure Key Vault into apps/web/.env.local.
# Run from repo root: pwsh scripts/pull-env-from-keyvault.ps1
# Requires: az login. NOTE: points local dev at the PROD Cosmos/Blob/SignalR.

$ErrorActionPreference = 'Stop'
$kv = 'dolmenwood-prod-kv'
$envFile = 'apps/web/.env.local'

function Get-Secret($name) {
  az keyvault secret show --vault-name $kv --name $name --query value -o tsv
}

# Preserve the locally generated AUTH_SECRET if present; else pull from vault.
$authLine = (Select-String -Path $envFile -Pattern '^AUTH_SECRET=' -ErrorAction SilentlyContinue).Line
if (-not $authLine) { $authLine = "AUTH_SECRET=$(Get-Secret auth-secret)" }

@"
# Local dev env — secrets pulled from Azure Key Vault ($kv) on $(Get-Date -Format yyyy-MM-dd).
# NOTE: points at the PROD Cosmos/Blob/SignalR resources.
NEXT_PUBLIC_APP_URL=http://localhost:3000

COSMOS_ENDPOINT=https://dolmenwood-prod-cosmos.documents.azure.com:443/
COSMOS_KEY=$(Get-Secret cosmos-key)

$authLine

BLOB_CONNECTION_STRING=$(Get-Secret blob-connection-string)
SIGNALR_CONNECTION_STRING=$(Get-Secret signalr-connection-string)

RESEND_API_KEY=$(Get-Secret resend-api-key)
RESEND_FROM=$(Get-Secret resend-from)
NOTIFICATIONS_DRAIN_SECRET=$(Get-Secret notifications-drain-secret)
"@ | Set-Content -NoNewline -Path $envFile

Write-Host "Wrote $envFile (values not displayed)."
