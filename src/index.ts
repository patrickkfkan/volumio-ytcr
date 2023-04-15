import YouTubeCastReceiver, { Constants, PlayerState, Sender } from 'yt-cast-receiver';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import libQ from 'kew';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import vconf from 'v-conf';
import ytcr from './lib/YTCRContext.js';
import Logger from './lib/Logger.js';
import MPDPlayer, { ActionEvent, MPDPlayerError, VolumioState } from './lib/MPDPlayer.js';
import VolumeControl from './lib/VolumeControl.js';
import * as utils from './lib/Utils.js';
import VideoLoader from './lib/VideoLoader.js';
import PairingHelper from './lib/PairingHelper.js';

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
  #context: any;
  #config: any;
  #commandRouter: any;
  #volatileCallback: any;

  #logger: Logger;
  #player: MPDPlayer;
  #volumeControl: VolumeControl;
  #receiver: YouTubeCastReceiver;

  constructor(context: any) {
    this.#context = context;
    this.#commandRouter = context.coreCommand;
    this.#logger = new Logger(context.logger);
    this.#serviceName = 'ytcr';
  }

  getUIConfig() {
    const defer = libQ.defer();

    const lang_code = this.#commandRouter.sharedVars.get('language_code');

    const configPrepTasks = [
      this.#commandRouter.i18nJson(`${__dirname}/i18n/strings_${lang_code}.json`,
        `${__dirname}/i18n/strings_en.json`,
        `${__dirname}/UIConfig.json`),

      utils.jsPromiseToKew(PairingHelper.getManualPairingCode(this.#receiver, this.#logger))
    ];

    libQ.all(configPrepTasks)
      .then((configParams: [any, string]) => {
        const [ uiconf, pairingCode ] = configParams;
        const [ connectionUIConf,
          manualPairingUIConf,
          otherUIConf ] = uiconf.sections;

        const port = ytcr.getConfigValue('port', 8098);
        const enableAutoplayOnConnect = ytcr.getConfigValue('enableAutoplayOnConnect', true);
        const debug = ytcr.getConfigValue('debug', false);
        const bindToIf = ytcr.getConfigValue('bindToIf', '');
        const liveStreamQuality = ytcr.getConfigValue('liveStreamQuality', 'auto');
        const liveStreamQualityOptions = otherUIConf.content[0].options;

        const availableIf = utils.getNetworkInterfaces();
        const ifOpts = [ {
          value: '',
          label: ytcr.getI18n('YTCR_BIND_TO_ALL_IF')
        } ];
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
        otherUIConf.content[0].value = liveStreamQualityOptions.find((o: any) => o.value === liveStreamQuality);
        otherUIConf.content[1].value = enableAutoplayOnConnect;
        otherUIConf.content[2].value = debug;

        let connectionStatus;
        if (this.#hasConnectedSenders()) {
          const senders = this.#receiver.getConnectedSenders();
          if (senders.length > 1) {
            connectionStatus = ytcr.getI18n('YTCR_CONNECTED_MULTIPLE', senders[0].name, senders.length - 1);
          }
          else {
            connectionStatus = ytcr.getI18n('YTCR_CONNECTED', senders[0].name);
          }
        }
        else {
          connectionStatus = ytcr.getI18n('YTCR_IDLE');
        }
        connectionUIConf.label = ytcr.getI18n('YTCR_CONNECTION', connectionStatus);

        defer.resolve(uiconf);
      })
      .fail((error: any) => {
        this.#logger.error('[ytcr] Failed to retrieve YouTube Cast Receiver plugin configuration: ', error);
        defer.reject(error);
      });

    return defer.promise;
  }

  onVolumioStart() {
    const configFile = this.#commandRouter.pluginManager.getConfigurationFile(this.#context, 'config.json');
    this.#config = new vconf();
    this.#config.loadFile(configFile);
    return libQ.resolve();
  }

  onStart() {
    const defer = libQ.defer();

    ytcr.init(this.#context, this.#config);

    this.#volumeControl = new VolumeControl(this.#commandRouter, this.#logger);

    const playerConfig = {
      mpd: this.#getMpdConfig(),
      volumeControl: this.#volumeControl,
      videoLoader: new VideoLoader(this.#logger)
    };
    this.#player = new MPDPlayer(playerConfig);

    const bindToIf = ytcr.getConfigValue('bindToIf', '');
    const receiver = this.#receiver = new YouTubeCastReceiver(this.#player, {
      dial: {
        port: ytcr.getConfigValue('port', 8098),
        bindToInterfaces: utils.hasNetworkInterface(bindToIf) ? [ bindToIf ] : undefined
      },
      app: {
        enableAutoplayOnConnect: ytcr.getConfigValue('enableAutoplayOnConnect', true)
      },
      logger: this.#logger,
      logLevel: ytcr.getConfigValue('debug', false) ? Constants.LOG_LEVELS.DEBUG : Constants.LOG_LEVELS.INFO
    });

    receiver.on('senderConnect', (sender: Sender) => {
      this.#logger.info('[ytcr] ***** Sender connected *****');
      ytcr.toast('success', ytcr.getI18n('YTCR_CONNECTED', sender.name));
      this.refreshUIConfig();
    });

    receiver.on('senderDisconnect', (sender: Sender) => {
      this.#logger.info('[ytcr] ***** Sender disconnected *****');
      ytcr.toast('warning', ytcr.getI18n('YTCR_DISCONNECTED', sender.name));
      this.refreshUIConfig();
    });

    this.#player.on('action', async (action: ActionEvent) => {
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
        const sm = ytcr.getStateMachine();
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
    this.#volumeControl.registerVolumioVolumeChangeListener(async (volume: { vol: number }) => {
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

    this.#player.on('state', async (states: { current: PlayerState, previous: PlayerState }) => {
      if (this.isCurrentService() && this.#hasConnectedSenders()) {
        const state = states.current;
        this.#logger.debug('[ytcr] Received state change event from MPDPlayer:', state);
        if (state.status === Constants.PLAYER_STATUSES.STOPPED || state.status === Constants.PLAYER_STATUSES.IDLE) {
          this.#player.sleep();
          this.pushIdleState();
        }
        else {
          await this.pushState();
        }
      }
    });

    this.#player.on('error', (error: MPDPlayerError) => {
      ytcr.toast('error', error.message);
    });

    receiver.start().then(async () => {
      this.#player.init();
      this.#logger.debug('[ytcr] Receiver started.');
      defer.resolve();
    })
      .catch((error: any) => {
        this.#logger.error('[ytcr] Failed to start plugin:', error);
        if (receiver.status === Constants.STATUSES.RUNNING) {
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

  #hasConnectedSenders(): boolean {
    return this.#receiver?.getConnectedSenders().length > 0 || false;
  }

  configSaveConnection(data: any) {
    const oldPort = ytcr.getConfigValue('port', 8098);
    const port = parseInt(data['port'], 10);
    if (port < 1024 || port > 65353) {
      ytcr.toast('error', ytcr.getI18n('YTCR_INVALID_PORT'));
      return;
    }
    const oldBindToIf = ytcr.getConfigValue('bindToIf', '');
    const bindToIf = data['bindToIf'].value;

    if (oldPort !== port || oldBindToIf !== bindToIf) {
      if (this.#hasConnectedSenders()) {
        const modalData: any = {
          title: ytcr.getI18n('YTCR_CONFIGURATION'),
          size: 'lg',
          buttons: [
            {
              name: ytcr.getI18n('YTCR_NO'),
              class: 'btn btn-warning'
            },
            {
              name: ytcr.getI18n('YTCR_YES'),
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
          modalData.message = ytcr.getI18n('YTCR_CONF_RESTART_CONFIRM_M', senders[0].name, senders.length - 1);
        }
        else {
          modalData.message = ytcr.getI18n('YTCR_CONF_RESTART_CONFIRM', senders[0].name);
        }
        this.#commandRouter.broadcastMessage('openModal', modalData);
      }
      else {
        this.configConfirmSaveConnection({ port, bindToIf });
      }
    }
    else {
      ytcr.toast('success', ytcr.getI18n('YTCR_SETTINGS_SAVED'));
    }
  }

  configConfirmSaveConnection(data: any) {
    this.#config.set('port', data['port']);
    this.#config.set('bindToIf', data['bindToIf']);
    this.restart().then(() => {
      this.refreshUIConfig();
      ytcr.toast('success', ytcr.getI18n('YTCR_RESTARTED'));
    });
  }

  configSaveOther(data: any) {
    this.#config.set('liveStreamQuality', data['liveStreamQuality'].value);
    this.#config.set('enableAutoplayOnConnect', data['enableAutoplayOnConnect']);
    this.#config.set('debug', data['debug']);

    if (this.#receiver) {
      this.#receiver.setLogLevel(data['debug'] ? Constants.LOG_LEVELS.DEBUG : Constants.LOG_LEVELS.INFO);
      this.#receiver.enableAutoplayOnConnect(data['enableAutoplayOnConnect']);
    }

    ytcr.toast('success', ytcr.getI18n('YTCR_SETTINGS_SAVED'));
  }

  refreshUIConfig() {
    this.#commandRouter.getUIConfigOnPlugin('music_service', 'ytcr', {}).then((config: any) => {
      this.#commandRouter.broadcastMessage('pushUiConfig', config);
    });
  }

  onStop() {
    const defer = libQ.defer();

    this.#receiver.removeAllListeners();
    this.#receiver.stop().then(async () => {
      this.#logger.debug('[ytcr] Receiver stopped');
      this.unsetVolatile();
      this.#volumeControl.unregisterVolumioVolumeChangeListener();
      await this.#player.destroy();
      ytcr.reset();
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

  getConfigurationFiles(): string[] {
    return [ 'config.json' ];
  }

  setVolatile() {
    if (!this.#volatileCallback) {
      this.#volatileCallback = this.onUnsetVolatile.bind(this);
    }
    if (!this.isCurrentService()) {
      ytcr.getStateMachine().setVolatile({
        service: this.#serviceName,
        callback: this.#volatileCallback
      });
      ytcr.getMpdPlugin().ignoreUpdate(true);
      ytcr.getStateMachine().setConsumeUpdateService(undefined);
    }
  }

  unsetVolatile() {
    ytcr.getStateMachine().unSetVolatile();
  }

  async onUnsetVolatile() {
    this.pushIdleState();
    ytcr.getMpdPlugin().ignoreUpdate(false);
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

  async pushState(state?: VolumioState) {
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

  seek(position: number) {
    return utils.jsPromiseToKew(this.#player.seek(Math.round(position / 1000)));
  }

  next() {
    return utils.jsPromiseToKew(this.#player.next());
  }

  previous() {
    return utils.jsPromiseToKew(this.#player.previous());
  }
}

export = ControllerYTCR;
