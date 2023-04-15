"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = require("os");
const yt_cast_receiver_1 = require("yt-cast-receiver");
class Logger extends yt_cast_receiver_1.DefaultLogger {
    #logger;
    constructor(volumioLogger) {
        super();
        this.#logger = volumioLogger;
    }
    // Override
    toOutput(targetLevel, msg) {
        const str = msg.join(os_1.EOL);
        switch (targetLevel) {
            case yt_cast_receiver_1.LOG_LEVELS.ERROR:
                this.#logger.error(str);
                break;
            case yt_cast_receiver_1.LOG_LEVELS.WARN:
                this.#logger.warn(str);
                break;
            case yt_cast_receiver_1.LOG_LEVELS.INFO:
                this.#logger.info(str);
                break;
            case yt_cast_receiver_1.LOG_LEVELS.DEBUG:
                this.#logger.verbose(str);
                break;
            default:
        }
    }
}
exports.default = Logger;
//# sourceMappingURL=Logger.js.map