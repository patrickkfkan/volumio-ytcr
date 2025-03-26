import { DataStore } from 'yt-cast-receiver';
import ytcr from './YTCRContext.js';

const BUNDLE_KEY = 'yt-cast-receiver';
const TTL = 3600000;

export default class ReceiverDataStore extends DataStore {

  #markDirtyTimer: NodeJS.Timeout | null;

  constructor() {
    super();
    this.#markDirtyTimer = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  set<T>(key: string, value: T): Promise<void> {
    const bundle = ytcr.getConfigValue(BUNDLE_KEY, {}, true);
    bundle[key] = value;
    ytcr.setConfigValue(BUNDLE_KEY, bundle, true);
    this.#setMarkDirtyTimer();
    return Promise.resolve();
  }

  get<T>(key: string): Promise<T | null> {
    const bundle = ytcr.getConfigValue(BUNDLE_KEY, {}, true);
    return Promise.resolve(bundle[key] || null);
  }

  clear() {
    ytcr.deleteConfigValue(BUNDLE_KEY);
  }

  #setMarkDirtyTimer() {
    if (this.#markDirtyTimer) {
      clearTimeout(this.#markDirtyTimer);
      this.#markDirtyTimer = null;
    }
    this.#markDirtyTimer = setTimeout(() => {
      ytcr.setConfigValue('dataStoreDirty', true);
      this.#markDirtyTimer = null;
    }, TTL);
  }
}
