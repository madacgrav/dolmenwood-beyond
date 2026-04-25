#!/usr/bin/env bash
# One-time setup: configure Azure federated identity for GitHub Actions OIDC
# Run this locally with: bash infra/azure/scripts/setup-oidc.sh
# Prerequisites: az CLI logged in, correct subscription set

set -euo pipefail

GITHUB_ORG="madacgrav"
GITHUB_REPO="dolmenwood-beyond"
APP_NAME="dolmenwood-beyond-github-actions"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
RESOURCE_GROUP="dolmenwood-prod-rg"

echo "Creating Azure AD app registration: $APP_NAME"
APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
echo "App ID: $APP_ID"

echo "Creating service principal"
SP_OBJECT_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
echo "SP Object ID: $SP_OBJECT_ID"

echo "Assigning Contributor role on resource group"
az role assignment create \
  --assignee "$APP_ID" \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}"

echo "Assigning User Access Administrator role (needed for role assignments in Bicep)"
az role assignment create \
  --assignee "$APP_ID" \
  --role "User Access Administrator" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}"

echo "Creating federated credential for main branch"
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"github-main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"

echo "Creating federated credential for PRs"
az ad app federated-credential create \
  --id "$APP_ID" \
  --parameters "{
    \"name\": \"github-prs\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:pull_request\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"

echo ""
echo "=========================================="
echo "Add these secrets to your GitHub repo:"
echo "AZURE_CLIENT_ID:       $APP_ID"
echo "AZURE_TENANT_ID:       $(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
echo "=========================================="
echo "Also create resource group before first deploy:"
echo "az group create --name $RESOURCE_GROUP --location eastus"
