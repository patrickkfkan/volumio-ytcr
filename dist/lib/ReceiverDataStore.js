"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _ReceiverDataStore_instances, _ReceiverDataStore_markDirtyTimer, _ReceiverDataStore_setMarkDirtyTimer;
Object.defineProperty(exports, "__esModule", { value: true });
const yt_cast_receiver_1 = require("yt-cast-receiver");
const YTCRContext_1 = __importDefault(require("./YTCRContext"));
const BUNDLE_KEY = 'yt-cast-receiver';
const TTL = 3600000;
class ReceiverDataStore extends yt_cast_receiver_1.DataStore {
    constructor() {
        super();
        _ReceiverDataStore_instances.add(this);
        _ReceiverDataStore_markDirtyTimer.set(this, void 0);
        __classPrivateFieldSet(this, _ReceiverDataStore_markDirtyTimer, null, "f");
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
    set(key, value) {
        const bundle = YTCRContext_1.default.getConfigValue(BUNDLE_KEY);
        bundle[key] = value;
        YTCRContext_1.default.setConfigValue(BUNDLE_KEY, bundle);
        __classPrivateFieldGet(this, _ReceiverDataStore_instances, "m", _ReceiverDataStore_setMarkDirtyTimer).call(this);
        return Promise.resolve();
    }
    get(key) {
        const bundle = YTCRContext_1.default.getConfigValue(BUNDLE_KEY);
        return Promise.resolve(bundle[key] || null);
    }
    clear() {
        YTCRContext_1.default.deleteConfigValue(BUNDLE_KEY);
    }
}
_ReceiverDataStore_markDirtyTimer = new WeakMap(), _ReceiverDataStore_instances = new WeakSet(), _ReceiverDataStore_setMarkDirtyTimer = function _ReceiverDataStore_setMarkDirtyTimer() {
    if (__classPrivateFieldGet(this, _ReceiverDataStore_markDirtyTimer, "f")) {
        clearTimeout(__classPrivateFieldGet(this, _ReceiverDataStore_markDirtyTimer, "f"));
        __classPrivateFieldSet(this, _ReceiverDataStore_markDirtyTimer, null, "f");
    }
    __classPrivateFieldSet(this, _ReceiverDataStore_markDirtyTimer, setTimeout(() => {
        YTCRContext_1.default.setConfigValue('dataStoreDirty', true);
        __classPrivateFieldSet(this, _ReceiverDataStore_markDirtyTimer, null, "f");
    }, TTL), "f");
};
exports.default = ReceiverDataStore;
//# sourceMappingURL=ReceiverDataStore.js.map