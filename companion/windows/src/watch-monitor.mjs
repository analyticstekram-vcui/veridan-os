export class WatchMonitor {
  #sampleScreen;
  #intervalMs;
  #unchangedThresholdMs;
  #differenceThreshold;
  #onState;
  #onError;
  #timer = null;
  #lastPixels = null;
  #lastChangedAt = null;
  #sampleCount = 0;
  #sampling = false;

  constructor({ sampleScreen, intervalMs, unchangedThresholdMs, differenceThreshold, onState, onError }) {
    this.#sampleScreen = sampleScreen;
    this.#intervalMs = intervalMs;
    this.#unchangedThresholdMs = unchangedThresholdMs;
    this.#differenceThreshold = differenceThreshold;
    this.#onState = onState;
    this.#onError = onError;
  }

  async start() {
    if (this.#timer) return;
    this.#lastPixels = null;
    this.#lastChangedAt = Date.now();
    this.#sampleCount = 0;
    await this.#sample();
    this.#timer = setInterval(() => void this.#sample(), this.#intervalMs);
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#lastPixels = null;
    this.#onState({ active: false, unchangedForMs: 0 });
  }

  get active() {
    return this.#timer !== null;
  }

  async #sample() {
    if (this.#sampling) return;
    this.#sampling = true;
    try {
      const sample = await this.#sampleScreen();
      validateSample(sample);
      const now = Date.now();
      const difference = this.#lastPixels ? meanAbsoluteDifference(this.#lastPixels, sample.pixels) : Infinity;
      if (difference >= this.#differenceThreshold) this.#lastChangedAt = now;
      this.#lastPixels = sample.pixels;
      this.#sampleCount += 1;
      const unchangedForMs = now - this.#lastChangedAt;
      this.#onState({
        active: true,
        lastChangedAt: new Date(this.#lastChangedAt).toISOString(),
        unchangedForMs,
        unchangedThresholdReached: unchangedForMs >= this.#unchangedThresholdMs,
        sampleCount: this.#sampleCount,
      });
    } catch (error) {
      this.#onError(error);
    } finally {
      this.#sampling = false;
    }
  }
}

export function meanAbsoluteDifference(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) {
    throw new Error('Screen samples must be non-empty arrays of equal length.');
  }
  return left.reduce((total, value, index) => total + Math.abs(value - right[index]), 0) / left.length;
}

function validateSample(sample) {
  if (!sample || !Array.isArray(sample.pixels) || sample.pixels.length === 0) {
    throw new Error('Screen sample is empty.');
  }
}
