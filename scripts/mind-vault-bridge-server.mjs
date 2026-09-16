import { createMindVaultServer, loadMindVaultConfig } from '../mind-vault/server.mjs';

const server = createMindVaultServer({ config: loadMindVaultConfig() });
const address = await server.listen();
console.log(`Veridan Mind Vault bridge listening on http://${address.address}:${address.port}`);

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close().finally(() => process.exit(0)));
