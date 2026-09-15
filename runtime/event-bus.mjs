import { randomUUID } from 'node:crypto';

export class EventBus {
  #catalog;
  #events = [];
  #subscribers = new Map();

  constructor(eventCatalog) {
    this.#catalog = new Map(eventCatalog.events.map((event) => [event.type, event]));
  }

  publish(type, payload, metadata = {}) {
    const contract = this.#catalog.get(type);
    if (!contract) throw new Error(`Unregistered event type: ${type}`);

    const missing = contract.required.filter((field) => payload[field] === undefined || payload[field] === null);
    if (missing.length > 0) throw new Error(`Event ${type} is missing: ${missing.join(', ')}`);

    const event = deepFreeze({
      event_id: randomUUID(),
      type,
      occurred_at: new Date().toISOString(),
      payload: structuredClone(payload),
      metadata: structuredClone(metadata),
    });

    this.#events.push(event);
    for (const handler of this.#subscribers.get(type) ?? []) handler(event);
    return event;
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

function deepFreeze(value) {
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) deepFreeze(nested);
  }
  return value;
}
