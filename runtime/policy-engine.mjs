export function evaluatePolicy({ capability, policy, context = {} }) {
  if (!capability) {
    return deny('unknown_capability', null);
  }

  if (policy.hard_denials.includes(capability.id)) {
    return deny('hard_denial', capability.risk_level);
  }

  if (capability.mode === 'PAPER_ONLY' && context.executionMode && context.executionMode !== 'PAPER_ONLY') {
    return deny('paper_only_boundary', capability.risk_level);
  }

  const level = policy.levels[String(capability.risk_level)];
  if (!level) {
    return deny('unknown_risk_level', capability.risk_level);
  }

  if (level.decision === 'deny') {
    return deny('risk_level_denied', capability.risk_level);
  }

  if (level.approval === 'user_direction' && context.userDirected !== true) {
    return conditional('user_direction_required', level, capability);
  }

  if (level.approval === 'explicit_confirmation' && context.explicitlyConfirmed !== true) {
    return conditional('explicit_confirmation_required', level, capability);
  }

  return {
    decision: 'allow',
    reason: 'policy_satisfied',
    riskLevel: capability.risk_level,
    mode: capability.mode,
    requirements: requirementsFor(capability.id, policy),
  };
}

function requirementsFor(capabilityId, policy) {
  return Object.entries(policy.requirements)
    .filter(([, capabilityIds]) => capabilityIds.includes(capabilityId))
    .map(([requirement]) => requirement);
}

function deny(reason, riskLevel) {
  return { decision: 'deny', reason, riskLevel, requirements: [] };
}

function conditional(reason, level, capability) {
  return {
    decision: 'conditional',
    reason,
    riskLevel: capability.risk_level,
    mode: capability.mode,
    approval: level.approval,
    requirements: [],
  };
}
