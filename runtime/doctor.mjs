import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { indexContracts, loadContracts, projectRoot } from './contracts.mjs';

export async function runDoctor() {
  const checks = [];
  let contracts;

  try {
    contracts = await loadContracts();
    pass(checks, 'contracts.parse', 'All core JSON contracts parse.');
  } catch (error) {
    fail(checks, 'contracts.parse', error.message);
    return summarize(checks);
  }

  const indexes = indexContracts(contracts);
  await checkRequiredFiles(contracts, checks);
  checkUniqueIds(contracts, checks);
  checkAgentCapabilities(contracts, indexes, checks);
  checkConnectorReferences(contracts, indexes, checks);
  checkRoutes(contracts, indexes, checks);
  checkSafety(contracts, checks);
  checkTekram(contracts.tekram, checks);
  checkCompanion(contracts.companion, checks);
  checkCompanionIntegration(contracts, indexes, checks);
  checkMemoryIntegration(contracts, indexes, checks);
  return summarize(checks);
}

async function checkRequiredFiles(contracts, checks) {
  const missing = [];
  for (const relativePath of contracts.manifest.required_contracts) {
    try {
      await access(resolve(projectRoot, relativePath));
    } catch {
      missing.push(relativePath);
    }
  }
  missing.length === 0
    ? pass(checks, 'contracts.required', `${contracts.manifest.required_contracts.length} required contracts found.`)
    : fail(checks, 'contracts.required', `Missing: ${missing.join(', ')}`);
}

function checkUniqueIds(contracts, checks) {
  const collections = [
    ['agents', contracts.agents.agents.map(({ id }) => id)],
    ['capabilities', contracts.capabilities.capabilities.map(({ id }) => id)],
    ['connectors', contracts.connectors.connectors.map(({ id }) => id)],
    ['events', contracts.events.events.map(({ type }) => type)],
    ['routes', contracts.router.rules.map(({ id }) => id)],
  ];

  const duplicates = collections.flatMap(([name, ids]) => {
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
    return [...new Set(repeated)].map((id) => `${name}:${id}`);
  });
  duplicates.length === 0
    ? pass(checks, 'registry.unique_ids', 'Registry identifiers are unique.')
    : fail(checks, 'registry.unique_ids', `Duplicates: ${duplicates.join(', ')}`);
}

function checkAgentCapabilities(contracts, indexes, checks) {
  const errors = [];
  for (const capability of contracts.capabilities.capabilities) {
    const agent = indexes.agents.get(capability.agent_id);
    if (!agent) errors.push(`${capability.id} -> missing ${capability.agent_id}`);
    else if (!agent.capabilities.includes(capability.id)) errors.push(`${agent.id} does not declare ${capability.id}`);
  }
  errors.length === 0
    ? pass(checks, 'registry.agent_capabilities', 'Every capability has one declaring agent.')
    : fail(checks, 'registry.agent_capabilities', errors.join('; '));
}

function checkConnectorReferences(contracts, indexes, checks) {
  const errors = contracts.agents.agents.flatMap((agent) =>
    agent.allowed_mcp_ids
      .filter((connectorId) => !indexes.connectors.has(connectorId))
      .map((connectorId) => `${agent.id} -> ${connectorId}`),
  );
  errors.length === 0
    ? pass(checks, 'registry.connectors', 'Every agent connector is registered.')
    : fail(checks, 'registry.connectors', `Unknown connectors: ${errors.join(', ')}`);
}

function checkRoutes(contracts, indexes, checks) {
  const errors = contracts.router.rules
    .filter((rule) => !indexes.capabilities.has(rule.capability_id))
    .map((rule) => `${rule.id} -> ${rule.capability_id}`);
  errors.length === 0
    ? pass(checks, 'router.capabilities', 'Every route resolves to a registered capability.')
    : fail(checks, 'router.capabilities', `Invalid routes: ${errors.join(', ')}`);
}

function checkSafety(contracts, checks) {
  const safety = contracts.manifest.safety;
  const safe = safety.trading_mode === 'PAPER_ONLY'
    && safety.broker_connected === false
    && safety.live_execution_enabled === false
    && safety.money_movement_enabled === false
    && contracts.policy.levels['4']?.decision === 'deny';
  safe
    ? pass(checks, 'safety.financial_boundary', 'PAPER_ONLY and financial execution boundaries are locked.')
    : fail(checks, 'safety.financial_boundary', 'Financial safety invariants are not locked.');
}

function checkTekram(tekram, checks) {
  const expected = {
    macd: 'ema2 - ema25',
    signalMirror: 'ema25 + EMA(ema2 - ema25, 12)',
  };
  const safe = tekram.execution_mode === 'PAPER_ONLY'
    && tekram.calculations.macd === expected.macd
    && tekram.calculations.signalMirror === expected.signalMirror
    && tekram.rules.tp_sl_ladder_reset === 'zero_cross_only';
  safe
    ? pass(checks, 'tekram.authoritative_contract', 'Authoritative MACD, SignalMirror, and zero-cross reset rules match.')
    : fail(checks, 'tekram.authoritative_contract', 'Authoritative TEKRAM invariants changed.');
}

function checkCompanion(companion, checks) {
  const boundaries = companion.execution_boundaries;
  const safe = companion.platform === 'win32'
    && companion.bind_host === '127.0.0.1'
    && companion.authentication === 'bearer_hmac_sha256'
    && companion.request_signing?.replay_window_ms === 30000
    && companion.request_signing?.nonce_reuse === 'deny'
    && companion.privacy.screen_frames === 'ephemeral'
    && companion.privacy.visible_indicator_required === true
    && companion.privacy.hidden_monitoring === false
    && Object.values(boundaries).every((enabled) => enabled === false);
  safe
    ? pass(checks, 'companion.sensory_boundary', 'Windows Companion is loopback-only, visible, ephemeral, and non-executing.')
    : fail(checks, 'companion.sensory_boundary', 'Windows Companion sensory boundary changed.');
}

function checkCompanionIntegration(contracts, indexes, checks) {
  const integration = contracts.companionIntegration;
  const expected = new Map([
    ['screen.see', { method: 'POST', path: '/v1/see' }],
    ['screen.watch.prepare', { method: 'POST', path: '/v1/watch/start' }],
  ]);
  const errors = [];

  if (integration.transport?.origin !== 'http://127.0.0.1:4701') errors.push('origin');
  if (integration.transport?.authentication !== contracts.companion.authentication) errors.push('authentication');
  if (integration.transport?.replay_window_ms !== contracts.companion.request_signing?.replay_window_ms) errors.push('replay_window');
  if (integration.dispatch_allowlist?.length !== expected.size) errors.push('allowlist_size');

  for (const entry of integration.dispatch_allowlist ?? []) {
    const route = expected.get(entry.capability_id);
    const capability = indexes.capabilities.get(entry.capability_id);
    if (!route || entry.method !== route.method || entry.path !== route.path) errors.push(`route:${entry.capability_id}`);
    if (!capability || JSON.stringify(entry.verification) !== JSON.stringify(capability.verification)) {
      errors.push(`verification:${entry.capability_id}`);
    }
    if (entry.capability_id === 'screen.watch.prepare' && entry.requires_user_direction !== true) errors.push('watch_user_direction');
    expected.delete(entry.capability_id);
  }
  if (expected.size > 0) errors.push(`missing:${[...expected.keys()].join(',')}`);

  if (!integration.hard_boundaries || !Object.values(integration.hard_boundaries).every((enabled) => enabled === false)) {
    errors.push('hard_boundaries');
  }
  if (!contracts.policy.requirements.user_direction?.includes('screen.watch.prepare')) errors.push('policy_user_direction');

  errors.length === 0
    ? pass(checks, 'companion.core_integration', 'Core dispatch is signed, allowlisted, verified, and fail-closed.')
    : fail(checks, 'companion.core_integration', `Invalid integration invariants: ${errors.join(', ')}`);
}

function checkMemoryIntegration(contracts, indexes, checks) {
  const integration = contracts.memoryIntegration;
  const memory = contracts.memory;
  const capability = indexes.capabilities.get('memory.search');
  const entry = integration.dispatch_allowlist?.[0];
  const expectedVerification = ['sources_returned', 'source_paths_scoped', 'read_only_asserted'];
  const errors = [];
  if (integration.transport?.origin !== 'http://127.0.0.1:57446') errors.push('origin');
  if (integration.transport?.authentication !== memory.authentication) errors.push('authentication');
  if (integration.transport?.replay_window_ms !== 30000) errors.push('replay_window');
  if (integration.dispatch_allowlist?.length !== 1 || entry?.capability_id !== 'memory.search' || entry?.method !== 'GET' || entry?.path !== '/mind-vault/search') errors.push('allowlist');
  if (JSON.stringify(entry?.verification) !== JSON.stringify(expectedVerification) || JSON.stringify(capability?.verification) !== JSON.stringify(expectedVerification)) errors.push('verification');
  if (memory.bind_host !== '127.0.0.1' || memory.authentication !== 'bearer_hmac_sha256' || memory.execution_boundaries?.vault_write !== false || !Object.values(memory.execution_boundaries ?? {}).every((value) => value === false)) errors.push('bridge_boundaries');
  if (!integration.hard_boundaries || !Object.values(integration.hard_boundaries).every((value) => value === false)) errors.push('integration_boundaries');
  if (!Array.isArray(integration.source_scope?.allowlisted_roots) || integration.source_scope.allowlisted_roots.length === 0 || integration.source_scope?.max_results !== 5) errors.push('source_scope');
  errors.length === 0
    ? pass(checks, 'memory.core_integration', 'Core retrieval is signed, scoped, read-only, source-cited, and fail-closed.')
    : fail(checks, 'memory.core_integration', `Invalid integration invariants: ${errors.join(', ')}`);
}

function pass(checks, id, detail) {
  checks.push({ id, status: 'PASS', detail });
}

function fail(checks, id, detail) {
  checks.push({ id, status: 'FAIL', detail });
}

function summarize(checks) {
  const passed = checks.filter(({ status }) => status === 'PASS').length;
  const failed = checks.filter(({ status }) => status === 'FAIL').length;
  return { ok: failed === 0, passed, failed, checks };
}
