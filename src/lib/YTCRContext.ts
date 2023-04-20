import format from 'string-format';
import fs from 'fs-extra';

interface DeviceInfo {
  name: string;
  uuid: string;
  time: string;
}

class YTCRContext {

  #singletons: Record<string, any>;
  #data: Record<string, any>;
  #pluginContext?: any;
  #pluginConfig?: any;

  #i18n: Record<string, string | Record<string, string>>;
  #i18nDefaults: Record<string, string | Record<string, string>>;
  #i18CallbackRegistered: boolean;

  constructor() {
    this.#singletons = {};
    this.#data = {};
    this.#i18n = {};
    this.#i18nDefaults = {};
    this.#i18CallbackRegistered = false;
  }


  set(key: string, value: any) {
    this.#data[key] = value;
  }

  get(key: string, defaultValue: any = null): any {
    return (this.#data[key] !== undefined) ? this.#data[key] : defaultValue;
  }

  init(pluginContext: any, pluginConfig: any) {
    this.#pluginContext = pluginContext;
    this.#pluginConfig = pluginConfig;

    this.#loadI18n();
    if (!this.#i18CallbackRegistered) {
      this.#pluginContext.coreCommand.sharedVars.registerCallback('language_code', this.#onSystemLanguageChanged.bind(this));
      this.#i18CallbackRegistered = true;
    }
  }

  toast(type: string, message: string, title = 'YouTube Cast Receiver') {
    this.#pluginContext.coreCommand.pushToastMessage(type, title, message);
  }

  getDeviceInfo(): DeviceInfo {
    return this.#pluginContext.coreCommand.getId();
  }

  getConfigValue(key: string, defaultValue: any = undefined, json = false): any {
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

  setConfigValue(key: string, value: any, json = false) {
    this.#pluginConfig.set(key, json ? JSON.stringify(value) : value);
  }

  getMpdPlugin(): any {
    return this.#getSingleton('mpdPlugin', () => this.#pluginContext.coreCommand.pluginManager.getPlugin('music_service', 'mpd'));
  }

  getStateMachine(): any {
    return this.#pluginContext.coreCommand.stateMachine;
  }

  reset() {
    this.#pluginContext = null;
    this.#pluginConfig = null;

    this.#singletons = {};
    this.#data = {};
  }

  #getSingleton(key: string, getValue: () => any): any {
    if (this.#singletons[key] == undefined) {
      this.#singletons[key] = getValue();
    }
    return this.#singletons[key];
  }

  getI18n(key: string, ...formatValues: any[]): string {
    let str;
    if (key.indexOf('.') > 0) {
      const mainKey = key.split('.')[0];
      const secKey = key.split('.')[1];
      str = (this.#i18n[mainKey] as Record<string, string>)?.[secKey] ||
            (this.#i18nDefaults[mainKey] as Record<string, string>)?.[secKey] ||
            key;
    }
    else {
      str = (this.#i18n[key] || this.#i18nDefaults[key] || key) as string;
    }

    if (str && formatValues.length) {
      str = format(str, ...formatValues);
    }

    return str;
  }

  #loadI18n() {
    if (this.#pluginContext) {
      const i18nPath = `${__dirname}/../i18n`;

      try {
        this.#i18nDefaults = fs.readJsonSync(`${i18nPath}/strings_en.json`);
      }
      catch (e) {
        this.#i18nDefaults = {};
      }

      try {
        const language_code = this.#pluginContext.coreCommand.sharedVars.get('language_code');
        this.#i18n = fs.readJsonSync(`${i18nPath}/strings_${language_code}.json`);
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

export default new YTCRContext();
