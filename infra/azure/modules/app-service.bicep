@description('Name of the App Service (web app)')
param name string

@description('Location for all resources')
param location string

@description('Tags to apply to resources')
param tags object = {}

@description('Name of the App Service Plan')
param planName string

@description('SKU for the App Service Plan')
param planSku object = {
  name: 'B2'
  tier: 'Basic'
  capacity: 1
}

@description('Docker image to deploy, e.g. myacr.azurecr.io/dolmenwood-web:latest')
param dockerImage string

@description('Login server of the ACR')
param acrLoginServer string

@description('Resource ID of the ACR for pull access')
param acrId string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('Key Vault URI')
param keyVaultUri string

@description('Supabase project URL (non-secret, injected as app setting)')
param supabaseUrl string

resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'linux'
  sku: planSku
  properties: {
    reserved: true  // Required for Linux
  }
}

resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: name
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${dockerImage}'
      acrUseManagedIdentityCreds: true
      alwaysOn: true
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acrLoginServer}'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'NEXT_PUBLIC_SUPABASE_URL'
          value: supabaseUrl
        }
        // Secrets pulled from Key Vault via managed identity
        {
          name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/supabase-anon-key/)'
        }
        {
          name: 'SUPABASE_SERVICE_ROLE_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/supabase-service-role-key/)'
        }
        {
          name: 'WORDPRESS_API_URL'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/wordpress-api-url/)'
        }
        {
          name: 'WORDPRESS_APP_PASSWORD'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/wordpress-app-password/)'
        }
        {
          name: 'WORDPRESS_USERNAME'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/wordpress-username/)'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '3000'
        }
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
      ]
    }
  }
}

// Grant Web App managed identity "AcrPull" on the ACR
// Note: scoped to resource group for idempotency — Azure rejects scope changes on existing role assignments.
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acrId, webApp.id, acrPullRoleId)
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output webAppId string = webApp.id
output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output principalId string = webApp.identity.principalId
output appServicePlanId string = appServicePlan.id
