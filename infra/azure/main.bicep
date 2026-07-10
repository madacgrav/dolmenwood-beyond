targetScope = 'resourceGroup'

@description('Environment name (prod, staging)')
@allowed(['prod', 'staging'])
param environment string = 'prod'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Project name prefix used in resource naming')
param projectName string = 'dolmenwood'

@description('Docker image tag to deploy')
param imageTag string = 'latest'

@description('Supabase project URL (non-secret)')
param supabaseUrl string

// ---- Naming convention ----
var prefix = '${projectName}-${environment}'
var acrName = replace('${projectName}${environment}acr', '-', '')  // ACR names: alphanumeric only
var appName = '${prefix}-web'
var planName = '${prefix}-plan'
var kvName = '${prefix}-kv'
// Key Vault URI is deterministic — compute it to avoid a circular dependency
// (appService needs the URI; keyVault needs appService's principal ID)
var keyVaultUri = 'https://${kvName}${az.environment().suffixes.keyvaultDns}/'

var tags = {
  project: 'dolmenwood-beyond'
  environment: environment
  managedBy: 'bicep'
}

// ---- Monitoring ----
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    name: prefix
    location: location
    tags: tags
  }
}

// ---- Container Registry ----
module acr 'modules/container-registry.bicep' = {
  name: 'acr'
  params: {
    name: acrName
    location: location
    tags: tags
    sku: environment == 'prod' ? 'Standard' : 'Basic'
  }
}

// ---- Cosmos DB (NoSQL) ----
module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  params: {
    name: '${prefix}-cosmos'
    location: location
    tags: tags
  }
}

// ---- Blob Storage (portraits) ----
module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: replace('${projectName}${environment}blob', '-', '')
    location: location
    tags: tags
  }
}

// ---- SignalR (live character updates) ----
module signalr 'modules/signalr.bicep' = {
  name: 'signalr'
  params: {
    name: '${prefix}-signalr'
    location: location
    tags: tags
  }
}

// ---- Change-feed Function (characters → SignalR) ----
module characterFeed 'modules/function-app.bicep' = {
  name: 'characterFeed'
  params: {
    name: '${prefix}-charfeed'
    location: location
    tags: tags
    storageAccountName: storage.outputs.storageAccountName
    cosmosAccountName: cosmos.outputs.accountName
    signalrName: signalr.outputs.signalrName
  }
}

// ---- App Service ----
// Deploy with placeholder image first; GitHub Actions updates the image tag
module appService 'modules/app-service.bicep' = {
  name: 'appService'
  params: {
    name: appName
    location: location
    tags: tags
    planName: planName
    planSku: environment == 'prod' ? {
      name: 'B2'
      tier: 'Basic'
      capacity: 1
    } : {
      name: 'B1'
      tier: 'Basic'
      capacity: 1
    }
    dockerImage: '${acr.outputs.loginServer}/dolmenwood-web:${imageTag}'
    acrLoginServer: acr.outputs.loginServer
    acrId: acr.outputs.acrId
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    keyVaultUri: keyVaultUri
    supabaseUrl: supabaseUrl
    cosmosEndpoint: cosmos.outputs.endpoint
  }
}

// ---- Key Vault ----
// Deployed after App Service so we have its managed identity principal ID
module keyVault 'modules/key-vault.bicep' = {
  name: 'keyVault'
  params: {
    name: kvName
    location: location
    tags: tags
    appServicePrincipalId: appService.outputs.principalId
  }
}

// ---- Outputs ----
output acrLoginServer string = acr.outputs.loginServer
output acrName string = acr.outputs.acrName
output webAppName string = appService.outputs.webAppName
output webAppUrl string = appService.outputs.webAppUrl
output keyVaultName string = keyVault.outputs.keyVaultName
output cosmosAccountName string = cosmos.outputs.accountName
output appInsightsConnectionString string = monitoring.outputs.appInsightsConnectionString
