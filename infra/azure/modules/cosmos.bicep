@description('Name of the Cosmos DB account')
param name string

@description('Location for all resources')
param location string

@description('Tags to apply to resources')
param tags object = {}

// Serverless: bills per-operation, right-sized for current low traffic.
resource account 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: name
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      { name: 'EnableServerless' }
    ]
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
  }
}

resource db 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: account
  name: 'dolmenwood'
  properties: {
    resource: { id: 'dolmenwood' }
  }
}

// All containers provisioned up front (serverless — no idle cost); later
// migration phases only add application code.
var containers = [
  { name: 'catalog_items', partitionKey: '/itemType' }
  { name: 'accounts', partitionKey: '/id' }
  { name: 'characters', partitionKey: '/ownerId' }
  { name: 'campaigns', partitionKey: '/id' }
  { name: 'notifications', partitionKey: '/accountId' }
]

resource sqlContainers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = [
  for c in containers: {
    parent: db
    name: c.name
    properties: {
      resource: {
        id: c.name
        partitionKey: {
          paths: [c.partitionKey]
          kind: 'Hash'
        }
      }
    }
  }
]

output endpoint string = account.properties.documentEndpoint
output accountName string = account.name
