import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(runtimeDir, '..');

async function readJson(relativePath) {
  const absolutePath = resolve(projectRoot, relativePath);
  return JSON.parse(await readFile(absolutePath, 'utf8'));
}

export async function loadContracts() {
  const [manifest, agents, capabilities, connectors, events, policy, router, tekram, companion, companionIntegration, memory, memoryIntegration, commandGateway, commandGatewayIntegration, retrievalQuality] = await Promise.all([
    readJson('core/system-manifest.json'),
    readJson('core/agent-registry.json'),
    readJson('core/capability-registry.json'),
    readJson('core/mcp-registry.json'),
    readJson('core/event-catalog.json'),
    readJson('core/policy.json'),
    readJson('core/router.json'),
    readJson('core/tekram-contract.json'),
    readJson('companion/windows/manifest.json'),
    readJson('core/companion-integration.json'),
    readJson('mind-vault/manifest.json'),
    readJson('core/memory-integration.json'),
    readJson('gateway/manifest.json'),
    readJson('core/command-gateway-integration.json'),
    readJson('core/retrieval-quality-contract.json'),
  ]);

  return { manifest, agents, capabilities, connectors, events, policy, router, tekram, companion, companionIntegration, memory, memoryIntegration, commandGateway, commandGatewayIntegration, retrievalQuality };
}

export function indexContracts(contracts) {
  return {
    agents: new Map(contracts.agents.agents.map((agent) => [agent.id, agent])),
    capabilities: new Map(contracts.capabilities.capabilities.map((capability) => [capability.id, capability])),
    connectors: new Map(contracts.connectors.connectors.map((connector) => [connector.id, connector])),
    events: new Map(contracts.events.events.map((event) => [event.type, event])),
  };
}
