@description('Name of the SignalR service')
param name string

@description('Location for all resources')
param location string

@description('Tags to apply to resources')
param tags object = {}

// Serverless mode: no hub server — the change-feed Function pushes via the
// REST API and browsers connect with negotiate-issued tokens.
resource signalr 'Microsoft.SignalRService/signalR@2024-03-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Free_F1'
    tier: 'Free'
    capacity: 1
  }
  properties: {
    features: [
      {
        flag: 'ServiceMode'
        value: 'Serverless'
      }
    ]
    cors: {
      allowedOrigins: ['*']
    }
  }
}

output signalrName string = signalr.name
output hostName string = signalr.properties.hostName
