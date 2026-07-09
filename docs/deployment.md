# Deployment Guide — Dolmenwood Beyond

## Overview

The application is deployed to **Azure App Service** as a Docker container. Infrastructure is managed with **Bicep** IaC. Deployments are automated via **GitHub Actions** using OIDC authentication (no stored Azure credentials).

---

## Azure Resources

| Resource | Name (prod) | Purpose |
|----------|-------------|---------|
| Resource Group | `dolmenwood-beyond-rg` | Container for all resources |
| Container Registry | `dolmenwoodprodacr` | Stores Docker images |
| App Service Plan | `dolmenwood-prod-plan` | Linux B1 compute |
| App Service | `dolmenwood-prod-web` | Hosts the container |
| Key Vault | `dolmenwood-prod-kv` | Secrets storage |
| Log Analytics | `dolmenwood-prod-logs` | Log aggregation |
| App Insights | `dolmenwood-prod-ai` | Application monitoring |

---

## First-Time Azure Setup

### 1. Create the resource group

```bash
az login
az group create \
  --name dolmenwood-beyond-rg \
  --location eastus
```

### 2. Set up OIDC for GitHub Actions

Run the setup script (requires `az` CLI and `gh` CLI):

```bash
bash infra/azure/scripts/setup-oidc.sh
```

This script:
- Creates an Azure AD app registration
- Adds federated credentials for your GitHub repo
- Assigns `Contributor` and `AcrPush` roles
- Sets the required GitHub secrets automatically

Required GitHub secrets (set by script):
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`

### 3. Configure Supabase URL settings

In the [Supabase dashboard](https://supabase.com) for the dolmenwood-beyond project, go to **Authentication → URL Configuration** and set:

| Setting | Value |
|---------|-------|
| **Site URL** | `https://dolmenwood-prod-web.azurewebsites.net` |
| **Redirect URLs** | `https://dolmenwood-prod-web.azurewebsites.net/**` |

> ⚠️ **Critical**: The Site URL is embedded in all Supabase auth emails (email verification, password reset). If it is set to `localhost`, production users will receive broken links.
>
> `supabase/config.toml` controls the **local** Supabase instance only. The cloud project's URL Configuration must be set manually in the dashboard — it is not overwritten by `supabase db push`.

### 4. Add application secrets to GitHub

In your GitHub repo → Settings → Secrets → Actions:

```
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key
SUPABASE_ACCESS_TOKEN          # Supabase CLI access token (for migrations)
SUPABASE_DB_URL                # IPv4 pooler connection string for migrations
                               # Format: postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
                               # (Use the Supavisor session-mode URL, NOT the direct IPv6 URL)
NOTIFICATIONS_DRAIN_SECRET     # Shared secret for the scheduled notification drain
                               # (same value as the notifications-drain-secret Key Vault secret)
```

In your GitHub repo → Settings → Variables → Actions:

```
NEXT_PUBLIC_SUPABASE_URL       # Your Supabase project URL (non-secret, used as a var)
APP_URL                        # Deployed base URL, e.g. https://dolmenwood-prod-web.azurewebsites.net
                               # (used by notifications-drain.yml to reach /api/notifications/drain)
```

### 4b. Outbound notification secrets (Key Vault)

Email notifications are sent via [Resend](https://resend.com). After the first Bicep deploy, set:

```bash
KV_NAME="dolmenwood-prod-kv"
az keyvault secret set --vault-name $KV_NAME --name "resend-api-key" --value "YOUR_RESEND_KEY"
az keyvault secret set --vault-name $KV_NAME --name "resend-from" --value "notifications@your-verified-domain.com"
az keyvault secret set --vault-name $KV_NAME --name "notifications-drain-secret" --value "$(openssl rand -hex 32)"
```

The `notifications-drain.yml` workflow curls `POST /api/notifications/drain` every 5 minutes; the app enqueues and sends pending notifications (see `apps/web/src/lib/notifications/dispatch.ts`). The `RESEND_FROM` address must belong to a domain verified in Resend (SPF/DKIM). This cron is the pre-Cosmos trigger mechanism — after the planned Cosmos DB migration it is replaced by an Azure Function on the Cosmos change feed.

### 5. Deploy infrastructure for the first time

```bash
az deployment group create \
  --resource-group dolmenwood-beyond-rg \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/main.bicepparam \
  --parameters supabaseUrl=https://your-project.supabase.co
```

---

## Automated Deployments

### On Pull Request

The `deploy-azure.yml` workflow runs a **Bicep what-if** to preview infrastructure changes. No resources are modified.

### On Push to `main`

Full deployment pipeline:

```
1. CI gate: lint + typecheck + tests must pass
2. In parallel:
   a. Build Docker image (BUILD_STANDALONE=true, NEXT_PUBLIC_* vars baked in)
      └── Push to ACR with SHA tag + 'latest'
   b. Run Supabase migrations (supabase db push via IPv4 pooler URL)
3. Deploy Bicep (idempotent — only changes what's different)
4. Update App Service to use new image tag
5. Health check: GET https://<app-url>/api/health
```

### Manual trigger

```bash
gh workflow run deploy-azure.yml
```

---

## Docker Build

### Stages

The `apps/web/Dockerfile` uses a 3-stage build:

| Stage | Base | Purpose |
|-------|------|---------|
| `deps` | `node:22-alpine` | Install pnpm + all dependencies |
| `builder` | `node:22-alpine` | Build the Next.js app with standalone output |
| `runner` | `node:22-alpine` | Minimal production image with dumb-init |

### Build arguments (baked into bundle at build time)

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_WORDPRESS_URL=https://your-blog.com \
  --build-arg BUILD_STANDALONE=true \
  -t dolmenwood-web:latest \
  -f apps/web/Dockerfile \
  .
```

> ⚠️ `NEXT_PUBLIC_*` variables are embedded in the JavaScript bundle. They are **not** secret. Do not pass service role keys or other secrets as `NEXT_PUBLIC_*`.

### Image size

The runner stage is minimal — only the `.next/standalone` output, public assets, and `dumb-init`. Target image size is under 300MB.

> **pnpm version**: pnpm is pinned to `10.11.0` in both the `deps` and `builder` stages of the Dockerfile. This prevents pnpm behavior changes from breaking builds.

---

## Health Check

The `/api/health` endpoint is used by:
- Docker `HEALTHCHECK` instruction
- Azure App Service health probes
- GitHub Actions post-deploy verification

```bash
curl https://your-app.azurewebsites.net/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

## Monitoring

### Application Insights

Traces are sent to Azure Application Insights automatically via the App Service instrumentation key.

Access via: Azure Portal → `dolmenwood-prod-ai` → Live Metrics / Failures / Performance

### Logs

```bash
# Stream live logs from App Service
az webapp log tail \
  --resource-group dolmenwood-beyond-rg \
  --name dolmenwood-prod-web

# Download log archive
az webapp log download \
  --resource-group dolmenwood-beyond-rg \
  --name dolmenwood-prod-web
```

---

## Scaling

The App Service Plan defaults to **B1** (1 vCPU, 1.75 GB RAM). To scale:

```bash
# Scale up (bigger VM)
az appservice plan update \
  --resource-group dolmenwood-beyond-rg \
  --name dolmenwood-prod-plan \
  --sku B2

# Scale out (more instances)
az appservice plan update \
  --resource-group dolmenwood-beyond-rg \
  --name dolmenwood-prod-plan \
  --number-of-workers 2
```

Or update `infra/azure/modules/appService.bicep` and redeploy via Bicep (preferred for IaC consistency).

---

## Rollback

To roll back to a previous image:

```bash
# List available tags in ACR
az acr repository show-tags \
  --name dolmenwoodprodacr \
  --repository dolmenwood/web

# Update App Service to a previous tag
az webapp config container set \
  --resource-group dolmenwood-beyond-rg \
  --name dolmenwood-prod-web \
  --docker-custom-image-name dolmenwoodprodacr.azurecr.io/dolmenwood/web:<previous-sha>
```

---

## Secrets Rotation

Secrets are stored in Key Vault and referenced by the App Service via `@Microsoft.KeyVault(SecretUri=...)` in app settings. To rotate a secret:

1. Add a new secret version in Key Vault
2. App Service automatically picks up the new version (no redeploy needed for KV-referenced secrets)

```bash
az keyvault secret set \
  --vault-name dolmenwood-prod-kv \
  --name supabase-anon-key \
  --value "new-secret-value"
```

---

## Known Deployment Limitations

### Key Vault `softDeleteRetentionInDays` — Immutable
Azure Key Vault's `softDeleteRetentionInDays` cannot be changed after the vault is created (currently 7 days). Changing it requires destroying and recreating the vault. Do not attempt to modify this value in `infra/azure/modules/key-vault.bicep`.

### AcrPull Role Assignment Scope — Cannot Change
The AcrPull role assignment for the App Service managed identity is scoped to the resource group (`resourceGroup()`). Azure does not allow changing the scope of an existing role assignment. Do not change the `scope` or `name` fields in `infra/azure/modules/app-service.bicep`'s `acrPullAssignment` resource — this will break deployments.
