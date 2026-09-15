export class Heartbeat {
  #intervalMs;
  #onBeat;
  #timer = null;

  constructor({ intervalMs, onBeat }) {
    this.#intervalMs = intervalMs;
    this.#onBeat = onBeat;
  }

  start() {
    if (this.#timer) return;
    this.#onBeat();
    this.#timer = setInterval(() => this.#onBeat(), this.#intervalMs);
  }

  stop() {
    if (!this.#timer) return;
    clearInterval(this.#timer);
    this.#timer = null;
  }

  get running() {
    return this.#timer !== null;
  }
}
