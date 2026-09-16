import { randomUUID } from 'node:crypto';
import { EventBus } from './event-bus.mjs';
import { createCompanionClientFromEnv } from './companion-client.mjs';
import { createCompanionDispatcher } from './companion-dispatcher.mjs';
import { createMemoryClientFromEnv } from './memory-client.mjs';
import { createMemoryDispatcher } from './memory-dispatcher.mjs';
import { indexContracts, loadContracts } from './contracts.mjs';
import { routeCommand } from './router.mjs';

const COMPANION_CAPABILITIES = new Set(['screen.see', 'screen.watch.prepare']);
const MEMORY_CAPABILITIES = new Set(['memory.search']);

export async function createOrchestrator({ companionClient = null, memoryClient = null, idFactory = randomUUID } = {}) {
  const contracts = await loadContracts();
  const indexes = indexContracts(contracts);
  const events = new EventBus(contracts.events);

  function route(command, context = {}) {
    const commandId = idFactory();
    events.publish('command.received', { command_id: commandId, source: context.source ?? 'unknown' });

    const resolved = routeCommand(command, contracts, indexes, context);
    if (resolved.status === 'denied') {
      events.publish('route.denied', { command_id: commandId, reason: resolved.reason });
    } else {
      events.publish('route.resolved', {
        command_id: commandId,
        intent: resolved.intent,
        capability_id: resolved.capability.id,
        agent_id: resolved.agent.id,
      });
      events.publish('policy.evaluated', {
        command_id: commandId,
        decision: resolved.policy.decision,
        risk_level: resolved.policy.riskLevel,
      });
    }

    return { commandId, ...resolved };
  }

  return {
    contracts,
    events,
    route,
    async execute(command, context = {}) {
      const resolved = route(command, context);
      if (resolved.status !== 'routed') return resolved;

      const correlationId = idFactory();
      const capabilityId = resolved.capability.id;
      events.publish('action.proposed', {
        command_id: resolved.commandId,
        correlation_id: correlationId,
        capability_id: capabilityId,
      });

      try {
        let verified;
        if (COMPANION_CAPABILITIES.has(capabilityId)) {
          const client = companionClient ?? createCompanionClientFromEnv();
          verified = await createCompanionDispatcher(client).execute(capabilityId);
        } else if (MEMORY_CAPABILITIES.has(capabilityId)) {
          const client = memoryClient ?? createMemoryClientFromEnv();
          verified = await createMemoryDispatcher(client).execute(capabilityId, command, context);
        } else {
          const error = new Error('Capability is not connected to a dispatcher.');
          error.code = 'capability_not_dispatchable';
          throw error;
        }
        events.publish('action.verified', {
          command_id: resolved.commandId,
          correlation_id: correlationId,
          capability_id: capabilityId,
          checks: verified.checks,
        });
        if (verified.observationId) {
          events.publish('observation.received', {
            command_id: resolved.commandId,
            correlation_id: correlationId,
            capability_id: capabilityId,
            observation_id: verified.observationId,
            source: 'windows-companion',
          });
        }
        if (MEMORY_CAPABILITIES.has(capabilityId)) {
          events.publish('memory.retrieved', {
            command_id: resolved.commandId,
            correlation_id: correlationId,
            capability_id: capabilityId,
            source_ids: verified.sourceIds,
            source_count: verified.sourceIds.length,
          });
        }
        return {
          ...resolved,
          status: 'completed',
          correlationId,
          result: verified.result,
          verified: verified.checks,
        };
      } catch (error) {
        const reason = error?.code ?? 'dispatch_failed';
        events.publish('action.failed', {
          command_id: resolved.commandId,
          correlation_id: correlationId,
          capability_id: capabilityId,
          reason,
        });
        return { ...resolved, status: 'failed', correlationId, reason };
      }
    },
  };
}
