"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const string_format_1 = __importDefault(require("string-format"));
const fs_extra_1 = __importDefault(require("fs-extra"));
class YTCRContext {
    #singletons;
    #data;
    #pluginContext;
    #pluginConfig;
    #i18n;
    #i18nDefaults;
    #i18CallbackRegistered;
    constructor() {
        this.#singletons = {};
        this.#data = {};
        this.#i18n = {};
        this.#i18nDefaults = {};
        this.#i18CallbackRegistered = false;
    }
    set(key, value) {
        this.#data[key] = value;
    }
    get(key, defaultValue = null) {
        return (this.#data[key] !== undefined) ? this.#data[key] : defaultValue;
    }
    init(pluginContext, pluginConfig) {
        this.#pluginContext = pluginContext;
        this.#pluginConfig = pluginConfig;
        this.#loadI18n();
        if (!this.#i18CallbackRegistered) {
            this.#pluginContext.coreCommand.sharedVars.registerCallback('language_code', this.#onSystemLanguageChanged.bind(this));
            this.#i18CallbackRegistered = true;
        }
    }
    toast(type, message, title = 'YouTube Cast Receiver') {
        this.#pluginContext.coreCommand.pushToastMessage(type, title, message);
    }
    getDeviceInfo() {
        return this.#pluginContext.coreCommand.getId();
    }
    getConfigValue(key, defaultValue = undefined, json = false) {
        if (this.#pluginConfig.has(key)) {
            const val = this.#pluginConfig.get(key);
            if (json) {
                try {
                    return JSON.parse(val);
                }
                catch (e) {
                    return defaultValue;
                }
            }
            else {
                return val;
            }
        }
        else {
            return defaultValue;
        }
    }
    setConfigValue(key, value, json = false) {
        this.#pluginConfig.set(key, json ? JSON.stringify(value) : value);
    }
    getMpdPlugin() {
        return this.#getSingleton('mpdPlugin', () => this.#pluginContext.coreCommand.pluginManager.getPlugin('music_service', 'mpd'));
    }
    getStateMachine() {
        return this.#pluginContext.coreCommand.stateMachine;
    }
    reset() {
        this.#pluginContext = null;
        this.#pluginConfig = null;
        this.#singletons = {};
        this.#data = {};
    }
    #getSingleton(key, getValue) {
        if (this.#singletons[key] == undefined) {
            this.#singletons[key] = getValue();
        }
        return this.#singletons[key];
    }
    getI18n(key, ...formatValues) {
        let str;
        if (key.indexOf('.') > 0) {
            const mainKey = key.split('.')[0];
            const secKey = key.split('.')[1];
            str = this.#i18n[mainKey]?.[secKey] ||
                this.#i18nDefaults[mainKey]?.[secKey] ||
                key;
        }
        else {
            str = (this.#i18n[key] || this.#i18nDefaults[key] || key);
        }
        if (str && formatValues.length) {
            str = (0, string_format_1.default)(str, ...formatValues);
        }
        return str;
    }
    #loadI18n() {
        if (this.#pluginContext) {
            const i18nPath = `${__dirname}/../i18n`;
            try {
                this.#i18nDefaults = fs_extra_1.default.readJsonSync(`${i18nPath}/strings_en.json`);
            }
            catch (e) {
                this.#i18nDefaults = {};
            }
            try {
                const language_code = this.#pluginContext.coreCommand.sharedVars.get('language_code');
                this.#i18n = fs_extra_1.default.readJsonSync(`${i18nPath}/strings_${language_code}.json`);
            }
            catch (e) {
                this.#i18n = this.#i18nDefaults;
            }
        }
    }
    #onSystemLanguageChanged() {
        this.#loadI18n();
    }
}
exports.default = new YTCRContext();
//# sourceMappingURL=YTCRContext.js.map