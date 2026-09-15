import { randomUUID } from 'node:crypto';

export function observationEnvelope({ capability, payload, source = 'windows-companion', clock = () => new Date() }) {
  return Object.freeze({
    envelopeVersion: '1.0',
    observationId: randomUUID(),
    source,
    capability,
    observedAt: clock().toISOString(),
    retention: 'ephemeral',
    payload,
  });
}
