"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yt_cast_receiver_1 = require("yt-cast-receiver");
const YTCRContext_js_1 = __importDefault(require("./YTCRContext.js"));
class PairingHelper {
    static #toastFetchingTimer = null;
    static getManualPairingCode(receiver, logger) {
        if (receiver.status !== yt_cast_receiver_1.Constants.STATUSES.RUNNING) {
            return Promise.resolve(null);
        }
        let timeout = null;
        const service = receiver.getPairingCodeRequestService();
        const stopService = () => {
            this.#cancelToastFetching();
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            service.stop();
            service.removeAllListeners();
        };
        if (service.status === yt_cast_receiver_1.Constants.STATUSES.RUNNING) {
            stopService();
        }
        return new Promise((resolve) => {
            service.on('request', () => {
                logger.debug('[ytcr] Obtaining manual pairing code...');
                this.#toastFetching();
            });
            service.on('response', (code) => {
                stopService();
                logger.debug('[ytcr] Obtained manual pairing code.');
                const segments = code.match(/.{1,3}/g);
                const formatted = segments ? segments.join(' ') : code;
                resolve(formatted);
            });
            service.on('error', (error) => {
                stopService();
                logger.error('[ytcr] Failed to obtain manual pairing code:', error);
                YTCRContext_js_1.default.toast('error', YTCRContext_js_1.default.getI18n('YTCR_FETCH_TV_CODE_ERR', error.message));
                resolve(null);
            });
            service.start();
            timeout = setTimeout(() => {
                stopService();
                logger.error('[ytcr] Failed to obtain manual pairing code: timeout.');
                YTCRContext_js_1.default.toast('error', YTCRContext_js_1.default.getI18n('YTCR_FETCH_TV_CODE_ERR', 'timeout'));
                resolve(null);
            }, 10000);
        });
    }
    static #toastFetching() {
        this.#cancelToastFetching();
        this.#toastFetchingTimer = setTimeout(() => {
            YTCRContext_js_1.default.toast('info', YTCRContext_js_1.default.getI18n('YTCR_FETCHING_TV_CODE'));
        }, 4000);
    }
    static #cancelToastFetching() {
        if (this.#toastFetchingTimer) {
            clearTimeout(this.#toastFetchingTimer);
            this.#toastFetchingTimer = null;
        }
    }
}
exports.default = PairingHelper;
//# sourceMappingURL=PairingHelper.js.map