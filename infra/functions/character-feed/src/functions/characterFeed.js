const { app, output } = require('@azure/functions');

/**
 * Cosmos change feed on the `characters` container → SignalR broadcast.
 * Replaces the Supabase realtime subscription that drove live HP updates
 * during play. The payload is intentionally minimal (ids + hp) — clients
 * refetch through the session-authorized API, so no character data leaks
 * to listeners who couldn't read it anyway.
 */

const signalROutput = output.generic({
  type: 'signalR',
  name: 'signalRMessages',
  hubName: 'characters',
  connectionStringSetting: 'AzureSignalRConnectionString',
});

app.cosmosDB('characterFeed', {
  connection: 'CosmosConnection',
  databaseName: 'dolmenwood',
  containerName: 'characters',
  leaseContainerName: 'leases',
  createLeaseContainerIfNotExists: false, // provisioned by Bicep
  extraOutputs: [signalROutput],
  handler: (documents, context) => {
    const messages = documents.map((doc) => ({
      target: 'characterChanged',
      arguments: [
        {
          characterId: doc.id,
          ownerId: doc.ownerId,
          hpCurrent: doc.hpCurrent ?? null,
        },
      ],
    }));
    context.extraOutputs.set(signalROutput, messages);
    context.log(`characterFeed: broadcast ${messages.length} change(s)`);
  },
});
