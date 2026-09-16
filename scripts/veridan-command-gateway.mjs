import { createCommandGatewayServer, loadCommandGatewayConfig } from '../runtime/command-gateway.mjs';
import { createMemoryClientFromEnv } from '../runtime/memory-client.mjs';
import { createOrchestrator } from '../runtime/orchestrator.mjs';

const core = await createOrchestrator({ memoryClient: createMemoryClientFromEnv() });
const server = createCommandGatewayServer({ config: loadCommandGatewayConfig(), orchestrator: core });
const address = await server.listen();
console.log(`Veridan Command Gateway listening on http://${address.address}:${address.port}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close().finally(() => process.exit(0)));
