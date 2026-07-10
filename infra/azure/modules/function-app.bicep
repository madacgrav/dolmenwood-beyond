@description('Name of the Function App')
param name string

@description('Location for all resources')
param location string

@description('Tags to apply to resources')
param tags object = {}

@description('Existing storage account name (AzureWebJobsStorage)')
param storageAccountName string

@description('Existing Cosmos DB account name (change-feed source)')
param cosmosAccountName string

@description('Existing SignalR service name (broadcast target)')
param signalrName string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

resource signalr 'Microsoft.SignalRService/signalR@2024-03-01' existing = {
  name: signalrName
}

var storageConnection = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${az.environment().suffixes.storage}'
var cosmosConnection = 'AccountEndpoint=${cosmosAccount.properties.documentEndpoint};AccountKey=${cosmosAccount.listKeys().primaryMasterKey};'

// Windows consumption: Linux dynamic workers can't share a resource group
// with the existing Linux App Service plan (LinuxDynamicWorkersNotAllowed).
resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${name}-plan'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'Y1' // consumption
    tier: 'Dynamic'
  }
  properties: {}
}

resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: name
  location: location
  tags: tags
  kind: 'functionapp'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage', value: storageConnection }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING', value: storageConnection }
        { name: 'WEBSITE_CONTENTSHARE', value: toLower(name) }
        { name: 'CosmosConnection', value: cosmosConnection }
        { name: 'AzureSignalRConnectionString', value: signalr.listKeys().primaryConnectionString }
      ]
    }
  }
}

output functionAppName string = functionApp.name
