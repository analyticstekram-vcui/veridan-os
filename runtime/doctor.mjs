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
