"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const yt_cast_receiver_1 = __importStar(require("yt-cast-receiver"));
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const kew_1 = __importDefault(require("kew"));
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const v_conf_1 = __importDefault(require("v-conf"));
const YTCRContext_js_1 = __importDefault(require("./lib/YTCRContext.js"));
const Logger_js_1 = __importDefault(require("./lib/Logger.js"));
const MPDPlayer_js_1 = __importDefault(require("./lib/MPDPlayer.js"));
const VolumeControl_js_1 = __importDefault(require("./lib/VolumeControl.js"));
const utils = __importStar(require("./lib/Utils.js"));
const VideoLoader_js_1 = __importDefault(require("./lib/VideoLoader.js"));
const PairingHelper_js_1 = __importDefault(require("./lib/PairingHelper.js"));
const IDLE_STATE = {
    status: 'stop',
    service: 'ytcr',
    title: undefined,
    artist: undefined,
    album: undefined,
    albumart: '/albumart',
    uri: '',
    trackType: undefined,
    seek: 0,
    duration: 0,
    samplerate: undefined,
    bitdepth: undefined,
    bitrate: undefined,
    channels: undefined
};
class ControllerYTCR {
    #serviceName = 'ytcr';
    #context;
    #config;
    #commandRouter;
    #volatileCallback;
    #logger;
    #player;
    #volumeControl;
    #receiver;
    constructor(context) {
        this.#context = context;
        this.#commandRouter = context.coreCommand;
        this.#logger = new Logger_js_1.default(context.logger);
        this.#serviceName = 'ytcr';
    }
    getUIConfig() {
        const defer = kew_1.default.defer();
        const lang_code = this.#commandRouter.sharedVars.get('language_code');
        const configPrepTasks = [
            this.#commandRouter.i18nJson(`${__dirname}/i18n/strings_${lang_code}.json`, `${__dirname}/i18n/strings_en.json`, `${__dirname}/UIConfig.json`),
            utils.jsPromiseToKew(PairingHelper_js_1.default.getManualPairingCode(this.#receiver, this.#logger))
        ];
        kew_1.default.all(configPrepTasks)
            .then((configParams) => {
            const [uiconf, pairingCode] = configParams;
            const [connectionUIConf, manualPairingUIConf, otherUIConf] = uiconf.sections;
            const port = YTCRContext_js_1.default.getConfigValue('port', 8098);
            const enableAutoplayOnConnect = YTCRContext_js_1.default.getConfigValue('enableAutoplayOnConnect', true);
            const debug = YTCRContext_js_1.default.getConfigValue('debug', false);
            const bindToIf = YTCRContext_js_1.default.getConfigValue('bindToIf', '');
            const liveStreamQuality = YTCRContext_js_1.default.getConfigValue('liveStreamQuality', 'auto');
            const liveStreamQualityOptions = otherUIConf.content[0].options;
            const availableIf = utils.getNetworkInterfaces();
            const ifOpts = [{
                    value: '',
                    label: YTCRContext_js_1.default.getI18n('YTCR_BIND_TO_ALL_IF')
                }];
            connectionUIConf.content[1].value = ifOpts[0];
            availableIf.forEach((info) => {
                const opt = {
                    value: info.name,
                    label: `${info.name} (${info.ip})`
                };
                ifOpts.push(opt);
                if (bindToIf === info.name) {
                    connectionUIConf.content[1].value = opt;
                }
            });
            connectionUIConf.content[0].value = port;
            connectionUIConf.content[1].options = ifOpts;
            manualPairingUIConf.content[0].value = pairingCode || 'Error (check logs)';
            otherUIConf.content[0].value = liveStreamQualityOptions.find((o) => o.value === liveStreamQuality);
            otherUIConf.content[1].value = enableAutoplayOnConnect;
            otherUIConf.content[2].value = debug;
            let connectionStatus;
            if (this.#hasConnectedSenders()) {
                const senders = this.#receiver.getConnectedSenders();
                if (senders.length > 1) {
                    connectionStatus = YTCRContext_js_1.default.getI18n('YTCR_CONNECTED_MULTIPLE', senders[0].name, senders.length - 1);
                }
                else {
                    connectionStatus = YTCRContext_js_1.default.getI18n('YTCR_CONNECTED', senders[0].name);
                }
            }
            else {
                connectionStatus = YTCRContext_js_1.default.getI18n('YTCR_IDLE');
            }
            connectionUIConf.label = YTCRContext_js_1.default.getI18n('YTCR_CONNECTION', connectionStatus);
            defer.resolve(uiconf);
        })
            .fail((error) => {
            this.#logger.error('[ytcr] Failed to retrieve YouTube Cast Receiver plugin configuration: ', error);
            defer.reject(error);
        });
        return defer.promise;
    }
    onVolumioStart() {
        const configFile = this.#commandRouter.pluginManager.getConfigurationFile(this.#context, 'config.json');
        this.#config = new v_conf_1.default();
        this.#config.loadFile(configFile);
        return kew_1.default.resolve();
    }
    onStart() {
        const defer = kew_1.default.defer();
        YTCRContext_js_1.default.init(this.#context, this.#config);
        this.#volumeControl = new VolumeControl_js_1.default(this.#commandRouter, this.#logger);
        const playerConfig = {
            mpd: this.#getMpdConfig(),
            volumeControl: this.#volumeControl,
            videoLoader: new VideoLoader_js_1.default(this.#logger)
        };
        this.#player = new MPDPlayer_js_1.default(playerConfig);
        const bindToIf = YTCRContext_js_1.default.getConfigValue('bindToIf', '');
        const receiver = this.#receiver = new yt_cast_receiver_1.default(this.#player, {
            dial: {
                port: YTCRContext_js_1.default.getConfigValue('port', 8098),
                bindToInterfaces: utils.hasNetworkInterface(bindToIf) ? [bindToIf] : undefined
            },
            app: {
                enableAutoplayOnConnect: YTCRContext_js_1.default.getConfigValue('enableAutoplayOnConnect', true)
            },
            logger: this.#logger,
            logLevel: YTCRContext_js_1.default.getConfigValue('debug', false) ? yt_cast_receiver_1.Constants.LOG_LEVELS.DEBUG : yt_cast_receiver_1.Constants.LOG_LEVELS.INFO
        });
        receiver.on('senderConnect', (sender) => {
            this.#logger.info('[ytcr] ***** Sender connected *****');
            YTCRContext_js_1.default.toast('success', YTCRContext_js_1.default.getI18n('YTCR_CONNECTED', sender.name));
            this.refreshUIConfig();
        });
        receiver.on('senderDisconnect', (sender) => {
            this.#logger.info('[ytcr] ***** Sender disconnected *****');
            YTCRContext_js_1.default.toast('warning', YTCRContext_js_1.default.getI18n('YTCR_DISCONNECTED', sender.name));
            this.refreshUIConfig();
        });
        this.#player.on('action', async (action) => {
            if (action.name === 'play' && !this.isCurrentService()) {
                this.#logger.debug('[ytcr] \'play\' command received while not being the current service.');
                // Stop any playback by the currently active service
                this.#logger.debug('[ytcr] Stopping playback by current service...');
                try {
                    await utils.kewToJSPromise(this.#commandRouter.volumioStop());
                }
                catch (error) {
                    this.#logger.debug('[ytcr] An error occurred while stopping playback by current service: ', error);
                    this.#logger.debug('[ytcr] Continuing anyway...');
                }
                // Unset any volatile state of currently active service
                const sm = YTCRContext_js_1.default.getStateMachine();
                if (sm.isVolatile) {
                    sm.unSetVolatile(); // Why isn't this async?!
                }
                this.#logger.debug('[ytcr] Setting ourselves as the current service...');
                this.setVolatile();
                this.pushIdleState();
                // Update volume on sender apps
                await this.#player.notifyExternalStateChange();
            }
            else if (action.name === 'setVolume' && !this.isCurrentService()) {
                this.#logger.debug('[ytcr] setVolume command received, but we are not the current service. Putting player to sleep...');
                this.#player.sleep();
            }
        });
        // Listen for changes in volume on Volumio's end
        this.#volumeControl.registerVolumioVolumeChangeListener(async (volume) => {
            if (this.isCurrentService() && this.#hasConnectedSenders()) {
                // SetVolume() will trigger volumioupdatevolume() which will trigger the statemachine's
                // PushState() - but old volatile state with outdated info will be used.
                // So we push the latest state here to refresh the old volatile state.
                this.#logger.debug(`[ytcr] Update volume to ${volume.vol}`);
                await this.pushState();
                await this.#volumeControl.setVolume(volume.vol, true);
                await this.pushState(); // Do it once more
                await this.#player.notifyExternalStateChange();
            }
            else {
                // Even if not current service, we keep track of the updated volume
                await this.#volumeControl.setVolume(volume.vol, true);
            }
        });
        this.#player.on('state', async (states) => {
            if (this.isCurrentService() && this.#hasConnectedSenders()) {
                const state = states.current;
                this.#logger.debug('[ytcr] Received state change event from MPDPlayer:', state);
                if (state.status === yt_cast_receiver_1.Constants.PLAYER_STATUSES.STOPPED || state.status === yt_cast_receiver_1.Constants.PLAYER_STATUSES.IDLE) {
                    this.#player.sleep();
                    this.pushIdleState();
                }
                else {
                    await this.pushState();
                }
            }
        });
        this.#player.on('error', (error) => {
            YTCRContext_js_1.default.toast('error', error.message);
        });
        receiver.start().then(async () => {
            this.#player.init();
            this.#logger.debug('[ytcr] Receiver started.');
            defer.resolve();
        })
            .catch((error) => {
            this.#logger.error('[ytcr] Failed to start plugin:', error);
            if (receiver.status === yt_cast_receiver_1.Constants.STATUSES.RUNNING) {
                receiver.stop();
            }
            defer.reject(error);
        });
        return defer.promise;
    }
    #getMpdConfig() {
        return {
            path: '/run/mpd/socket'
        };
    }
    #hasConnectedSenders() {
        return this.#receiver?.getConnectedSenders().length > 0 || false;
    }
    configSaveConnection(data) {
        const oldPort = YTCRContext_js_1.default.getConfigValue('port', 8098);
        const port = parseInt(data['port'], 10);
        if (port < 1024 || port > 65353) {
            YTCRContext_js_1.default.toast('error', YTCRContext_js_1.default.getI18n('YTCR_INVALID_PORT'));
            return;
        }
        const oldBindToIf = YTCRContext_js_1.default.getConfigValue('bindToIf', '');
        const bindToIf = data['bindToIf'].value;
        if (oldPort !== port || oldBindToIf !== bindToIf) {
            if (this.#hasConnectedSenders()) {
                const modalData = {
                    title: YTCRContext_js_1.default.getI18n('YTCR_CONFIGURATION'),
                    size: 'lg',
                    buttons: [
                        {
                            name: YTCRContext_js_1.default.getI18n('YTCR_NO'),
                            class: 'btn btn-warning'
                        },
                        {
                            name: YTCRContext_js_1.default.getI18n('YTCR_YES'),
                            class: 'btn btn-info',
                            emit: 'callMethod',
                            payload: {
                                'endpoint': 'music_service/ytcr',
                                'method': 'configConfirmSaveConnection',
                                'data': { port, bindToIf }
                            }
                        }
                    ]
                };
                const senders = this.#receiver.getConnectedSenders();
                if (senders.length > 1) {
                    modalData.message = YTCRContext_js_1.default.getI18n('YTCR_CONF_RESTART_CONFIRM_M', senders[0].name, senders.length - 1);
                }
                else {
                    modalData.message = YTCRContext_js_1.default.getI18n('YTCR_CONF_RESTART_CONFIRM', senders[0].name);
                }
                this.#commandRouter.broadcastMessage('openModal', modalData);
            }
            else {
                this.configConfirmSaveConnection({ port, bindToIf });
            }
        }
        else {
            YTCRContext_js_1.default.toast('success', YTCRContext_js_1.default.getI18n('YTCR_SETTINGS_SAVED'));
        }
    }
    configConfirmSaveConnection(data) {
        this.#config.set('port', data['port']);
        this.#config.set('bindToIf', data['bindToIf']);
        this.restart().then(() => {
            this.refreshUIConfig();
            YTCRContext_js_1.default.toast('success', YTCRContext_js_1.default.getI18n('YTCR_RESTARTED'));
        });
    }
    configSaveOther(data) {
        this.#config.set('liveStreamQuality', data['liveStreamQuality'].value);
        this.#config.set('enableAutoplayOnConnect', data['enableAutoplayOnConnect']);
        this.#config.set('debug', data['debug']);
        if (this.#receiver) {
            this.#receiver.setLogLevel(data['debug'] ? yt_cast_receiver_1.Constants.LOG_LEVELS.DEBUG : yt_cast_receiver_1.Constants.LOG_LEVELS.INFO);
            this.#receiver.enableAutoplayOnConnect(data['enableAutoplayOnConnect']);
        }
        YTCRContext_js_1.default.toast('success', YTCRContext_js_1.default.getI18n('YTCR_SETTINGS_SAVED'));
    }
    refreshUIConfig() {
        this.#commandRouter.getUIConfigOnPlugin('music_service', 'ytcr', {}).then((config) => {
            this.#commandRouter.broadcastMessage('pushUiConfig', config);
        });
    }
    onStop() {
        const defer = kew_1.default.defer();
        this.#receiver.removeAllListeners();
        this.#receiver.stop().then(async () => {
            this.#logger.debug('[ytcr] Receiver stopped');
            this.unsetVolatile();
            this.#volumeControl.unregisterVolumioVolumeChangeListener();
            await this.#player.destroy();
            YTCRContext_js_1.default.reset();
            defer.resolve();
        })
            .catch((error) => {
            this.#logger.error('[ytcr] Failed to stop receiver:', error);
            defer.reject(error);
        });
        return defer.promise;
    }
    restart() {
        return this.onStop().then(() => {
            this.onStart();
        });
    }
    getConfigurationFiles() {
        return ['config.json'];
    }
    setVolatile() {
        if (!this.#volatileCallback) {
            this.#volatileCallback = this.onUnsetVolatile.bind(this);
        }
        if (!this.isCurrentService()) {
            YTCRContext_js_1.default.getStateMachine().setVolatile({
                service: this.#serviceName,
                callback: this.#volatileCallback
            });
            YTCRContext_js_1.default.getMpdPlugin().ignoreUpdate(true);
            YTCRContext_js_1.default.getStateMachine().setConsumeUpdateService(undefined);
        }
    }
    unsetVolatile() {
        YTCRContext_js_1.default.getStateMachine().unSetVolatile();
    }
    async onUnsetVolatile() {
        this.pushIdleState();
        YTCRContext_js_1.default.getMpdPlugin().ignoreUpdate(false);
        return this.#player.stop();
    }
    pushIdleState() {
        this.#logger.debug('[ytcr] Pushing idle state...');
        // Need to first push empty state with pause status first so the empty volatileState gets registered
        // By statemachine.
        this.#commandRouter.servicePushState(Object.assign(IDLE_STATE, { status: 'pause' }), this.#serviceName);
        // Then push empty state with stop status
        this.#commandRouter.servicePushState(IDLE_STATE, this.#serviceName);
    }
    async pushState(state) {
        const volumioState = state || await this.#player.getVolumioState();
        if (volumioState) {
            this.#logger.debug('[ytcr] pushState(): ', volumioState);
            this.#commandRouter.servicePushState(volumioState, this.#serviceName);
        }
    }
    isCurrentService() {
        // Check what is the current Volumio service
        const currentstate = this.#commandRouter.volumioGetState();
        if (currentstate !== undefined && currentstate.service !== undefined && currentstate.service !== this.#serviceName) {
            return false;
        }
        return true;
    }
    stop() {
        return utils.jsPromiseToKew(this.#player.stop());
    }
    play() {
        return utils.jsPromiseToKew(this.#player.resume());
    }
    pause() {
        return utils.jsPromiseToKew(this.#player.pause());
    }
    resume() {
        return utils.jsPromiseToKew(this.#player.resume());
    }
    seek(position) {
        return utils.jsPromiseToKew(this.#player.seek(Math.round(position / 1000)));
    }
    next() {
        return utils.jsPromiseToKew(this.#player.next());
    }
    previous() {
        return utils.jsPromiseToKew(this.#player.previous());
    }
}
module.exports = ControllerYTCR;
//# sourceMappingURL=index.js.map