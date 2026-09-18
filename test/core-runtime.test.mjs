import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContracts, indexContracts } from '../runtime/contracts.mjs';
import { runDoctor } from '../runtime/doctor.mjs';
import { EventBus } from '../runtime/event-bus.mjs';
import { evaluatePolicy } from '../runtime/policy-engine.mjs';
import { routeCommand } from '../runtime/router.mjs';

const contracts = await loadContracts();
const indexes = indexContracts(contracts);

test('routes production diagnostics through the developer agent', () => {
  const result = routeCommand('Veridan, check production and diagnose what broke', contracts, indexes);
  assert.equal(result.status, 'routed');
  assert.equal(result.intent, 'SYSTEM_DIAGNOSTIC');
  assert.equal(result.capability.id, 'system.inspect');
  assert.equal(result.agent.id, 'developer-agent');
});

test('routes TEKRAM analysis as paper only', () => {
  const result = routeCommand('What is TEKRAM saying on NQ?', contracts, indexes, { executionMode: 'PAPER_ONLY' });
  assert.equal(result.status, 'routed');
  assert.equal(result.capability.id, 'trading.analyze');
  assert.equal(result.policy.mode, 'PAPER_ONLY');
});

test('denies TEKRAM capability when live execution is requested in context', () => {
  const capability = indexes.capabilities.get('trading.analyze');
  const result = evaluatePolicy({ capability, policy: contracts.policy, context: { executionMode: 'LIVE' } });
  assert.equal(result.decision, 'deny');
  assert.equal(result.reason, 'paper_only_boundary');
});

test('fails closed for unknown intent', () => {
  const result = routeCommand('flibbertigibbet', contracts, indexes);
  assert.equal(result.status, 'denied');
  assert.equal(result.reason, 'unknown_intent');
});

test('routes ordinary memory-search questions to memory.search', () => {
  for (const command of [
    'What do we know about Veridan OS?',
    'What have we written about the Windows Companion?',
    'Find notes about zero cross.',
    'Search the Mind Vault for retrieval quality.',
    'Look up retrieval quality in the Mind Vault.',
  ]) {
    const result = routeCommand(command, contracts, indexes);
    assert.equal(result.status, 'routed', command);
    assert.equal(result.intent, 'MEMORY_RETRIEVAL', command);
    assert.equal(result.capability.id, 'memory.search', command);
  }
});

test('keeps non-memory action requests denied or outside the memory capability', () => {
  const commands = [
    'Place a trade on NQ.',
    'Start watching my screen.',
    'Run this PowerShell command.',
  ];
  for (const command of commands) {
    const result = routeCommand(command, contracts, indexes);
    assert.notEqual(result.capability?.id, 'memory.search', command);
    assert.notEqual(result.status, 'routed', command);
  }
});

test('validates and freezes registered events', () => {
  const bus = new EventBus(contracts.events);
  const event = bus.publish('command.received', { command_id: 'cmd-1', source: 'test' });
  assert.equal(event.type, 'command.received');
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.payload), true);
  assert.throws(() => bus.publish('unknown.event', {}), /Unregistered event type/);
});

test('doctor verifies cross-contract integrity', async () => {
  const report = await runDoctor();
  assert.equal(report.ok, true, JSON.stringify(report.checks, null, 2));
  assert.equal(report.failed, 0);
});
