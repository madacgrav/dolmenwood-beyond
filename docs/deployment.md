# Deployment Guide — Dolmenwood Beyond

## Overview

The application is deployed to **Azure App Service** as a Docker container. Infrastructure is managed with **Bicep** IaC. Deployments are automated via **GitHub Actions** using OIDC authentication (no stored Azure credentials).

---

## Azure Resources

| Resource | Name (prod) | Purpose |
|----------|-------------|---------|
| Resource Group | `dolmenwood-beyond-rg` | Container for all resources |
| Container Registry | `dolmenwooodprodacr` | Stores Docker images |
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

### 3. Add application secrets to GitHub

In your GitHub repo → Settings → Secrets → Actions:

```
SUPABASE_URL                 # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_URL     # Same as above (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY    # Supabase service role key (keep secret)
```

### 4. Deploy infrastructure for the first time

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
1. OIDC login to Azure
2. Build Docker image
   └── BUILD_STANDALONE=true
   └── NEXT_PUBLIC_* vars passed as --build-arg
3. Push image to ACR with SHA tag + 'latest'
4. Deploy Bicep (idempotent — only changes what's different)
5. Update App Service to use new image tag
6. Health check: GET https://<app-url>/api/health
```

### Manual trigger

```bash
# Trigger deployment manually via GitHub CLI
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
  --name dolmenwooodprodacr \
  --repository dolmenwood/web

# Update App Service to a previous tag
az webapp config container set \
  --resource-group dolmenwood-beyond-rg \
  --name dolmenwood-prod-web \
  --docker-custom-image-name dolmenwooodprodacr.azurecr.io/dolmenwood/web:<previous-sha>
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

## Staging Environment

To deploy a staging environment:

```bash
az deployment group create \
  --resource-group dolmenwood-beyond-rg \
  --template-file infra/azure/main.bicep \
  --parameters environment=staging \
  --parameters supabaseUrl=https://your-staging-project.supabase.co
```

This creates separate resources prefixed `dolmenwood-staging-*`.
