const DISPATCH = Object.freeze({
  'screen.see': (client) => client.see(),
  'screen.watch.prepare': (client) => client.startWatch(),
});

export function createCompanionDispatcher(client, { clock = () => new Date(), freshnessMs = 30_000 } = {}) {
  if (!client) throw new Error('Windows Companion client is not configured.');
  if (!Number.isInteger(freshnessMs) || freshnessMs < 1) throw new Error('A positive freshness window is required.');

  return Object.freeze({
    async execute(capabilityId) {
      const operation = DISPATCH[capabilityId];
      if (!operation) throw new DispatchError('capability_not_dispatchable');
      const result = await operation(client);
      return verify(capabilityId, result, clock, freshnessMs);
    },
  });
}

export class DispatchError extends Error {
  constructor(code) {
    super(`Companion dispatch failed: ${code}`);
    this.name = 'DispatchError';
    this.code = code;
  }
}

function verify(capabilityId, result, clock, freshnessMs) {
  if (capabilityId === 'screen.see') {
    const payload = result?.payload;
    const observedAt = Date.parse(result?.observedAt);
    const valid = result?.envelopeVersion === '1.0'
      && result?.source === 'windows-companion'
      && result?.capability === 'screen_see'
      && result?.retention === 'ephemeral'
      && Number.isFinite(observedAt)
      && Math.abs(clock().getTime() - observedAt) <= freshnessMs
      && typeof result?.observationId === 'string'
      && payload?.mimeType === 'image/png'
      && payload?.ephemeral === true
      && typeof payload?.data === 'string'
      && payload.data.length > 0
      && payload.data.length % 4 === 0
      && /^[A-Za-z0-9+/]+={0,2}$/.test(payload.data);
    if (!valid) throw new DispatchError('observation_verification_failed');
    return Object.freeze({
      result,
      checks: Object.freeze(['fresh_frame', 'retention_ephemeral', 'source_identified']),
      observationId: result.observationId,
    });
  }

  if (capabilityId === 'screen.watch.prepare') {
    const valid = ['active', 'already_active'].includes(result?.status)
      && result?.watch?.active === true
      && result?.watch?.visibleIndicator === true;
    if (!valid) throw new DispatchError('watch_verification_failed');
    return Object.freeze({
      result,
      checks: Object.freeze(['visible_indicator', 'stop_control_present', 'retention_ephemeral']),
      observationId: null,
    });
  }

  throw new DispatchError('capability_not_dispatchable');
}
