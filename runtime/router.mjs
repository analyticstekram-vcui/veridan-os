import { evaluatePolicy } from './policy-engine.mjs';

export function routeCommand(command, contracts, indexes, context = {}) {
  const normalized = normalize(command);
  if (!normalized) {
    return deniedRoute('empty_command');
  }

  const matches = contracts.router.rules
    .map((rule) => ({ rule, score: scoreRule(rule, normalized) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || right.rule.priority - left.rule.priority);

  if (matches.length === 0) {
    return deniedRoute('unknown_intent');
  }

  const { rule, score } = matches[0];
  const capability = indexes.capabilities.get(rule.capability_id);
  if (!capability) {
    return deniedRoute('unregistered_capability');
  }

  const agent = indexes.agents.get(capability.agent_id);
  if (!agent || !agent.capabilities.includes(capability.id)) {
    return deniedRoute('agent_capability_mismatch');
  }

  const policy = evaluatePolicy({ capability, policy: contracts.policy, context });
  if (policy.decision === 'deny') {
    return { status: 'denied', reason: policy.reason, intent: rule.intent, capability, agent, policy };
  }

  return {
    status: policy.decision === 'conditional' ? 'approval_required' : 'routed',
    confidence: Number(Math.min(1, score / 3).toFixed(2)),
    intent: rule.intent,
    capability,
    agent,
    policy,
    verification: capability.verification,
  };
}

function normalize(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

function scoreRule(rule, command) {
  const hits = rule.any_terms.filter((term) => command.includes(term.toLowerCase())).length;
  return hits === 0 ? 0 : hits + rule.priority / 1000;
}

function deniedRoute(reason) {
  return { status: 'denied', reason, policy: { decision: 'deny', reason } };
}
