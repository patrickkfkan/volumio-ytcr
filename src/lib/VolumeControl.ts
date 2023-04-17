import { Logger } from 'yt-cast-receiver';

interface VolumioVolumeChangeListener {
  (volume: { vol: number }): Promise<void>;
}

export default class VolumeControl {

  #commandRouter: any;
  #logger: Logger;
  #currentVolume: number;
  #volumioVolumeChangeListener: VolumioVolumeChangeListener | null;

  constructor(commandRouter: any, logger: Logger) {
    this.#commandRouter = commandRouter;
    this.#logger = logger;
    this.#currentVolume = -1;
    this.#volumioVolumeChangeListener = null;
  }

  async setVolume(volume: number, setInternalOnly = false) {
    this.#logger.debug(`[ytcr] VolumeControl setting volume to: ${volume}.`);
    this.#currentVolume = volume;
    if (!setInternalOnly) {
      this.#commandRouter.volumiosetvolume(volume);
    }
  }

  async getVolume(): Promise<number> {
    let result: Promise<number>;
    if (this.#currentVolume < 0) {
      result = new Promise((resolve, reject) => {
        this.#commandRouter.volumioretrievevolume().then((volumeData: any) => {
          resolve(volumeData.vol as number);
        })
          .fail((error: any) => {
            this.#logger.error('[ytcr] VolumeControl failed to obtain volume from Volumio:', error);
            reject(error);
            return -1;
          });
      });
    }
    else {
      result = Promise.resolve(this.#currentVolume);
    }

    this.#currentVolume = await result;
    return this.#currentVolume;
  }

  registerVolumioVolumeChangeListener(listener: VolumioVolumeChangeListener) {
    if (this.#volumioVolumeChangeListener) {
      this.unregisterVolumioVolumeChangeListener();
    }
    this.#volumioVolumeChangeListener = listener;
    this.#commandRouter.addCallback('volumioupdatevolume', listener);
  }

  unregisterVolumioVolumeChangeListener() {
    if (!this.#volumioVolumeChangeListener) {
      return;
    }
    const callbacks = this.#commandRouter.callbacks['volumioupdatevolume'];
    if (callbacks) {
      const oldCount = callbacks.length;
      this.#logger.debug(`[ytcr] VolumeControl removing Volumio callbacks for ''volumioupdatevolume'. Current count: ${oldCount}`);
      this.#commandRouter.callbacks['volumioupdatevolume'] = callbacks.filter((l: any) => l !== this.#volumioVolumeChangeListener);
      const newCount = this.#commandRouter.callbacks['volumioupdatevolume'].length;
      this.#logger.debug(`[ytcr] VolumeControl removed ${oldCount - newCount} Volumio callbacks for ''volumioupdatevolume'.`);
    }
  }
}
