"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubsystemEvent = void 0;
class SubsystemEvent {
    #name;
    #propagate;
    constructor(name, propagate = true) {
        this.#name = name;
        this.#propagate = propagate;
    }
    stopPropagation() {
        this.#propagate = false;
    }
    get propagate() {
        return this.#propagate;
    }
    get name() {
        return this.#name;
    }
}
exports.SubsystemEvent = SubsystemEvent;
class MPDSubsystemEventEmitter {
    #status;
    #mpdClient;
    #logger;
    #systemEventListener;
    #subsystemEventListeners;
    constructor(logger) {
        this.#logger = logger;
        this.#status = 'stopped';
        this.#systemEventListener = this.#handleSystemEvent.bind(this);
        this.#subsystemEventListeners = {};
    }
    static instance(mpdClient, logger) {
        const emitter = new MPDSubsystemEventEmitter(logger);
        emitter.#mpdClient = mpdClient;
        return emitter;
    }
    enable() {
        if (this.#status === 'stopped') {
            this.#mpdClient.on('system', this.#systemEventListener);
            this.#status = 'running';
            this.#logger.debug('[ytcr] MPDSubsystemEventEmitter enabled.');
        }
    }
    disable() {
        this.#status = 'stopped';
        this.#mpdClient.removeListener('system', this.#systemEventListener);
        this.#logger.debug('[ytcr] MPDSubsystemEventEmitter disabled.');
    }
    #addSubsystemEventListener(event, listener, once = false, prepend = false) {
        if (!this.#subsystemEventListeners[event]) {
            this.#subsystemEventListeners[event] = [];
        }
        const wrapped = {
            once,
            callback: listener
        };
        if (prepend) {
            this.#subsystemEventListeners[event].unshift(wrapped);
        }
        else {
            this.#subsystemEventListeners[event].push(wrapped);
        }
    }
    on(event, listener) {
        this.#addSubsystemEventListener(event, listener);
        return this;
    }
    once(event, listener) {
        this.#addSubsystemEventListener(event, listener, true);
        return this;
    }
    off(event, listener) {
        const listeners = this.#subsystemEventListeners[event];
        if (!listeners) {
            return this;
        }
        this.#subsystemEventListeners[event] = listeners.filter((l) => l.callback !== listener);
        return this;
    }
    prependOnceListener(event, listener) {
        this.#addSubsystemEventListener(event, listener, true, true);
        return this;
    }
    async #handleSystemEvent(subsystem) {
        if (this.#status === 'running') {
            const listeners = this.#subsystemEventListeners[subsystem];
            if (!listeners) {
                return;
            }
            this.#logger.debug(`[ytcr] MPDSubsystemEventEmitter invoking ${listeners.length} SubsystemEventListener callbacks for: ${subsystem}`);
            for (let i = 0; i < listeners.length; i++) {
                const l = listeners[i];
                const event = new SubsystemEvent(subsystem);
                try {
                    const callbackResult = l.callback(event);
                    if (callbackResult.then !== undefined) {
                        await callbackResult;
                    }
                }
                catch (error) {
                    this.#logger.debug('[ytcr] MPDSubsystemEventEmitter handleSystemEvent error:', error);
                }
                if (!event.propagate) {
                    this.#logger.debug('[ytcr] SubsystemEvent.propagate: false. Event propagation stopped.');
                    break;
                }
            }
            this.#subsystemEventListeners[subsystem] = listeners.filter((l) => !l.once);
        }
    }
}
exports.default = MPDSubsystemEventEmitter;
//# sourceMappingURL=MPDSubsystemEventEmitter.js.map