import YouTubeCastReceiver, { Constants, Logger } from 'yt-cast-receiver';
import ytcr from './YTCRContext.js';

export default class PairingHelper {

  static getManualPairingCode(receiver: YouTubeCastReceiver, logger: Logger): Promise<string | null> {
    let timeout: any = null;
    const service = receiver.getPairingCodeRequestService();
    const stopService = () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      service.stop();
      service.removeAllListeners();
    };

    if (service.status === Constants.STATUSES.RUNNING) {
      stopService();
    }

    return new Promise((resolve) => {
      service.on('request', () => {
        logger.debug('[ytcr] Obtaining manual pairing code...');
        ytcr.toast('info', ytcr.getI18n('YTCR_FETCHING_TV_CODE'));
      });

      service.on('response', (code: string) => {
        stopService();
        logger.debug('[ytcr] Obtained manual pairing code.');
        const segments = code.match(/.{1,3}/g);
        const formatted = segments ? segments.join(' ') : code;
        resolve(formatted);
      });

      service.on('error', (error: Error) => {
        stopService();
        logger.error('[ytcr] Failed to obtain manual pairing code:', error);
        ytcr.toast('error', ytcr.getI18n('YTCR_FETCH_TV_CODE_ERR', error.message));
        resolve(null);
      });

      service.start();

      timeout = setTimeout(() => {
        stopService();
        logger.error('[ytcr] Failed to obtain manual pairing code: timeout.');
        ytcr.toast('error', ytcr.getI18n('YTCR_FETCH_TV_CODE_ERR', 'timeout'));
        resolve(null);
      }, 10000);
    });
  }
}
