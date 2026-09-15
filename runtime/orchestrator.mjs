import { randomUUID } from 'node:crypto';
import { EventBus } from './event-bus.mjs';
import { indexContracts, loadContracts } from './contracts.mjs';
import { routeCommand } from './router.mjs';

export async function createOrchestrator() {
  const contracts = await loadContracts();
  const indexes = indexContracts(contracts);
  const events = new EventBus(contracts.events);

  return {
    contracts,
    events,
    route(command, context = {}) {
      const commandId = randomUUID();
      events.publish('command.received', { command_id: commandId, source: context.source ?? 'unknown' });

      const route = routeCommand(command, contracts, indexes, context);
      if (route.status === 'denied') {
        events.publish('route.denied', { command_id: commandId, reason: route.reason });
      } else {
        events.publish('route.resolved', {
          command_id: commandId,
          intent: route.intent,
          capability_id: route.capability.id,
          agent_id: route.agent.id,
        });
        events.publish('policy.evaluated', {
          command_id: commandId,
          decision: route.policy.decision,
          risk_level: route.policy.riskLevel,
        });
      }

      return { commandId, ...route };
    },
  };
}
