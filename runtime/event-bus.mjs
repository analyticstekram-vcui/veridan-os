import { randomUUID } from 'node:crypto';

export class EventBus {
  #catalog;
  #store;
  #events = [];
  #subscribers = new Map();

  constructor(eventCatalog, { store = null, initialEvents = [] } = {}) {
    this.#catalog = new Map(eventCatalog.events.map((event) => [event.type, event]));
    this.#store = store;
    const eventIds = new Set();
    for (const event of initialEvents) {
      if (eventIds.has(event?.event_id)) continue;
      try {
        const sanitized = sanitizeEvent(event);
        const missing = this.#catalog.get(event.type).required.filter((field) => sanitized.payload[field] === undefined || sanitized.payload[field] === null);
        if (missing.length > 0) continue;
        eventIds.add(event.event_id);
        this.#events.push(deepFreeze({ ...sanitized, metadata: {} }));
      } catch {
        continue;
      }
    }
  }

  publish(type, payload, metadata = {}) {
    const contract = this.#catalog.get(type);
    if (!contract) throw new Error(`Unregistered event type: ${type}`);

    const missing = contract.required.filter((field) => payload[field] === undefined || payload[field] === null);
    if (missing.length > 0) throw new Error(`Event ${type} is missing: ${missing.join(', ')}`);

    const event = {
      event_id: randomUUID(),
      type,
      occurred_at: new Date().toISOString(),
      payload: structuredClone(payload),
      metadata: structuredClone(metadata),
    };

    if (this.#store) this.#store.append(sanitizeEvent(event));

    const frozen = deepFreeze(event);
    this.#events.push(frozen);
    for (const handler of this.#subscribers.get(type) ?? []) handler(frozen);
    return frozen;
  }

  subscribe(type, handler) {
    if (!this.#catalog.has(type)) throw new Error(`Unregistered event type: ${type}`);
    const handlers = this.#subscribers.get(type) ?? new Set();
    handlers.add(handler);
    this.#subscribers.set(type, handlers);
    return () => handlers.delete(handler);
  }

  history() {
    return [...this.#events];
  }
}

const SAFE_FIELDS = Object.freeze({
  'command.received': ['command_id', 'source'],
  'route.resolved': ['command_id', 'intent', 'capability_id', 'agent_id'],
  'route.denied': ['command_id', 'reason'],
  'policy.evaluated': ['command_id', 'decision', 'risk_level'],
  'action.proposed': ['command_id', 'correlation_id', 'capability_id'],
  'action.verified': ['command_id', 'correlation_id', 'capability_id', 'checks'],
  'action.failed': ['command_id', 'correlation_id', 'capability_id', 'reason'],
  'observation.received': ['command_id', 'correlation_id', 'capability_id', 'observation_id', 'source'],
  'memory.retrieved': ['command_id', 'correlation_id', 'capability_id', 'source_ids', 'source_count'],
  'trading.signal.received': ['source', 'symbol', 'execution_mode'],
  'system.health.failed': ['source', 'check_id', 'reason'],
});

function sanitizeEvent(event) {
  const fields = SAFE_FIELDS[event.type];
  if (!fields) throw coded('unregistered_event_type');
  safeToken(event.event_id, 'event_id');
  safeToken(event.type, 'type');
  if (typeof event.occurred_at !== 'string' || event.occurred_at.length > 64 || !Number.isFinite(Date.parse(event.occurred_at))) throw coded('unsafe_event_field:occurred_at');

  const payload = {};
  for (const field of fields) {
    if (event.payload[field] === undefined) continue;
    payload[field] = sanitizeField(field, event.payload[field]);
  }

  const missing = fields.filter((field) => payload[field] === undefined || payload[field] === null);
  if (missing.length > 0) throw coded(`unsafe_or_missing_event_fields:${missing.join(',')}`);

  return Object.freeze({
    record_type: 'event',
    event_id: event.event_id,
    type: event.type,
    occurred_at: event.occurred_at,
    payload: Object.freeze(payload),
  });
}

function sanitizeField(field, value) {
  if (field === 'checks') {
    if (!Array.isArray(value) || value.length > 16) throw coded(`unsafe_event_field:${field}`);
    return value.map((item) => safeToken(item, field));
  }
  if (field === 'source_ids') {
    if (!Array.isArray(value) || value.length > 16 || value.some((item) => typeof item !== 'string' || !/^[a-f0-9]{20}$/.test(item))) throw coded(`unsafe_event_field:${field}`);
    return [...value];
  }
  if (field === 'risk_level' || field === 'source_count') {
    if (!Number.isInteger(value) || value < 0 || value > 1000) throw coded(`unsafe_event_field:${field}`);
    return value;
  }
  return safeToken(value, field);
}

function safeToken(value, field) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 160 || /\s/.test(value)) throw coded(`unsafe_event_field:${field}`);
  if (!/^[A-Za-z0-9._-]+$/.test(value)) throw coded(`unsafe_event_field:${field}`);
  return value;
}

function coded(code) {
  const error = new Error(`Event persistence rejected: ${code}`);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) deepFreeze(nested);
  }
  return value;
}
