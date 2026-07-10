import { CosmosClient, type Container } from '@azure/cosmos';

/**
 * Server-only Cosmos DB client factory. The key must never reach the
 * browser — all data access goes through route handlers / server code.
 */

let client: CosmosClient | null = null;

function getClient(): CosmosClient {
  if (!client) {
    const endpoint = process.env.COSMOS_ENDPOINT;
    const key = process.env.COSMOS_KEY;
    if (!endpoint || !key) {
      throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be set');
    }
    client = new CosmosClient({ endpoint, key });
  }
  return client;
}

export function getContainer(name: string): Container {
  return getClient().database('dolmenwood').container(name);
}
