# Azure Infrastructure

## Architecture

```
GitHub Actions (OIDC)
    │
    ├── Build Docker image → Azure Container Registry (ACR)
    │
    └── Bicep deploy →
            ├── App Service Plan (Linux, B2)
            ├── App Service (Web App for Containers)
            │     └── Pulls image from ACR via Managed Identity
            ├── Key Vault (secrets via Managed Identity)
            │     ├── supabase-anon-key
            │     ├── supabase-service-role-key
            │     ├── wordpress-api-url
            │     ├── wordpress-app-password
            │     ├── wordpress-username
            │     ├── resend-api-key
            │     ├── resend-from
            │     └── notifications-drain-secret
            ├── Log Analytics Workspace
            └── Application Insights
```

## First-Time Setup

### 1. Create Azure resources (one-time)
```bash
# Login and set subscription
az login
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Create resource group
az group create --name dolmenwood-prod-rg --location eastus

# Configure OIDC for GitHub Actions (no stored secrets)
bash infra/azure/scripts/setup-oidc.sh
```

### 2. Add GitHub Secrets

After running setup-oidc.sh, add to GitHub repo → Settings → Secrets:

| Secret | Value |
|---|---|
| `AZURE_CLIENT_ID` | App registration client ID (from script output) |
| `AZURE_TENANT_ID` | Azure tenant ID (from script output) |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### 3. Add GitHub Variables (non-secret)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |

### 4. Add secrets to Key Vault (after first Bicep deploy)
```bash
KV_NAME="dolmenwood-prod-kv"
az keyvault secret set --vault-name $KV_NAME --name "supabase-anon-key" --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name "supabase-service-role-key" --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name "wordpress-api-url" --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name "wordpress-app-password" --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name "wordpress-username" --value "YOUR_VALUE"
# Outbound notifications (email via Resend; drain route shared secret)
az keyvault secret set --vault-name $KV_NAME --name "resend-api-key" --value "YOUR_VALUE"
az keyvault secret set --vault-name $KV_NAME --name "resend-from" --value "notifications@your-verified-domain.com"
az keyvault secret set --vault-name $KV_NAME --name "notifications-drain-secret" --value "$(openssl rand -hex 32)"
```

For the scheduled notification drain (`notifications-drain.yml`), also add:
- GitHub secret `NOTIFICATIONS_DRAIN_SECRET` — same value as the Key Vault secret
- GitHub variable `APP_URL` — deployed base URL, e.g. `https://dolmenwood-prod-web.azurewebsites.net`

### 5. Deploy

Push to `main` — the `deploy-azure.yml` workflow handles everything automatically.

## Workflow Behavior

| Trigger | Behavior |
|---|---|
| Pull Request | Bicep `--what-if` preview only (no changes) |
| Push to `main` | Build image → Deploy infra → Update App Service |
| `workflow_dispatch` | Manual deploy with environment selection |

## Cost Estimate (prod, eastus)

| Resource | SKU | ~Monthly Cost |
|---|---|---|
| App Service Plan | B2 Linux | ~$75/mo |
| Container Registry | Standard | ~$20/mo |
| Key Vault | Standard | ~$5/mo |
| Log Analytics | Pay-per-GB | ~$5/mo |
| Application Insights | Pay-per-GB | ~$5/mo |
| **Total** | | **~$110/mo** |
