"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const yt_cast_receiver_1 = require("yt-cast-receiver");
const mpd_api_1 = __importDefault(require("mpd-api"));
const abort_controller_1 = __importDefault(require("abort-controller"));
const MPDSubsystemEventEmitter_js_1 = __importDefault(require("./MPDSubsystemEventEmitter.js"));
const YTCRContext_js_1 = __importDefault(require("./YTCRContext.js"));
class MPDPlayer extends yt_cast_receiver_1.Player {
    #config;
    #currentVideoInfo;
    #mpdClient;
    #volumeControl;
    #videoLoader;
    #loadVideoAbortController;
    #subsystemEventEmitter;
    #destroyed;
    #asleep;
    constructor(config) {
        super();
        this.#config = config;
    }
    // Must be called after receiver started, not before.
    async init() {
        this.#currentVideoInfo = null;
        this.#mpdClient = await mpd_api_1.default.connect(this.#config.mpd);
        this.#destroyed = false;
        this.#videoLoader = this.#config.videoLoader;
        this.#volumeControl = this.#config.volumeControl;
        const externalMPDEventListener = this.#handleExternalMPDEvent.bind(this);
        this.#subsystemEventEmitter = MPDSubsystemEventEmitter_js_1.default.instance(this.#mpdClient, this.logger);
        this.#subsystemEventEmitter.on('player', externalMPDEventListener);
        this.#subsystemEventEmitter.on('mixer', externalMPDEventListener);
        this.#subsystemEventEmitter.enable();
    }
    #abortLoadVideo() {
        if (this.#loadVideoAbortController) {
            this.#loadVideoAbortController.abort();
            this.#loadVideoAbortController = null;
        }
    }
    async doPlay(video, position) {
        if (this.#destroyed || !this.#mpdClient) {
            return false;
        }
        this.emit('action', { name: 'play', data: { videoId: video.id, position } });
        this.logger.debug(`[ytcr] MPDPlayer: play ${video.id} at position ${position}s`);
        this.#abortLoadVideo();
        this.#loadVideoAbortController = new abort_controller_1.default();
        let videoInfo;
        try {
            videoInfo = await this.#videoLoader.getInfo(video, this.#loadVideoAbortController.signal);
        }
        catch (error) {
            if (error.name === 'AbortError') {
                this.logger.debug('[ytcr] AbortError:', error);
                return false;
            }
            throw error;
        }
        finally {
            this.#loadVideoAbortController = null;
        }
        this.logger.debug(`[ytcr] MPDPLayer obtained info for ${video.id}:`, videoInfo);
        await this.#mpdClient.api.queue.clear();
        if (videoInfo?.streamUrl) {
            const songId = (await this.#mpdClient.api.queue.addid(videoInfo.streamUrl)).toString();
            videoInfo.mpdSongId = songId;
            if (videoInfo.title) {
                await this.#mpdClient.api.queue.addtagid(songId, 'title', videoInfo.title);
            }
            if (videoInfo.channel) {
                await this.#mpdClient.api.queue.addtagid(songId, 'album', videoInfo.channel);
            }
            await this.#mpdClient.api.queue.addtagid(songId, 'artist', 'YouTube Cast');
            await this.#mpdClient.api.playback.consume('1');
            await this.#mpdClient.api.playback.seekid(songId, position.toString());
            this.wake();
            const resolved = await this.resolveOnMPDStatusChanged(this.#mpdClient.api.playback.playid.bind(this, songId), 'player', { state: 'play', songid: videoInfo.mpdSongId });
            if (resolved) { // Playback successful
                this.#currentVideoInfo = videoInfo;
            }
            return resolved;
            /*       Return this.resolveOnMPDStatusChanged(
                      this.#mpdClient.api.playback.playid.bind(this, songId), 'player',
                      { state: 'play', songid: videoInfo.mpdSongId }
                    )
                      .then(async (mpdStatus) => {
                        this.#currentVideoInfo = videoInfo;
                        await this.notifyVolumeChanged();
                        await this.notifyPlayed();
                        return mpdStatus;
                      })
                      .then(mpdStatus => this.getState(mpdStatus))
                      .then(playerState => this.eventEmitter.emit('stateChanged', playerState, { triggeredBy: 'play' }))*/
        }
        this.logger.debug(`[ytcr] MPDPlayer failed to play ${video.id}: ${videoInfo.errMsg}`);
        this.emit('error', {
            message: YTCRContext_js_1.default.getI18n('YTCR_START_PLAYBACK_FAILED', videoInfo.title || videoInfo.id, videoInfo.errMsg)
        });
        // Check if video was in fact loaded (just that it's unplayable) - this affects whether we're going to play next.
        if (videoInfo?.title) {
            this.logger.debug('[ytcr] Video unplayable; proceeding to next in queue...');
            return this.next();
        }
        return false;
    }
    async doPause() {
        if (this.#destroyed || !this.#mpdClient || !this.#currentVideoInfo?.mpdSongId) {
            return false;
        }
        this.emit('action', { name: 'pause' });
        this.logger.debug('[ytcr] MPDPlayer: pause');
        return this.resolveOnMPDStatusChanged(this.#mpdClient.api.playback.pause.bind(this), 'player', { state: 'pause', songid: this.#currentVideoInfo.mpdSongId });
    }
    async doResume() {
        if (this.#destroyed || !this.#mpdClient || !this.#currentVideoInfo?.mpdSongId) {
            return false;
        }
        this.emit('action', { name: 'resume' });
        this.logger.debug('[ytcr] MPDPlayer: resume');
        return this.resolveOnMPDStatusChanged(this.#mpdClient.api.playback.resume.bind(this), 'player', { state: 'play', songid: this.#currentVideoInfo.mpdSongId });
    }
    async doStop() {
        if (this.#destroyed || !this.#mpdClient) {
            return true;
        }
        if (this.status === yt_cast_receiver_1.Constants.PLAYER_STATUSES.LOADING) {
            this.#abortLoadVideo();
            return true;
        }
        this.emit('action', { name: 'stop' });
        this.logger.debug('[ytcr] MPDPlayer: stop');
        const resolved = await this.resolveOnMPDStatusChanged(this.#mpdClient.api.playback.stop.bind(this), 'player', { state: 'stop' });
        if (resolved) { // Stopped
            this.#currentVideoInfo = null;
        }
        return resolved;
    }
    async doSeek(position) {
        if (this.#destroyed || !this.#mpdClient || !this.#currentVideoInfo?.mpdSongId) {
            return false;
        }
        // Seeking not supported for livestreams
        if (this.#currentVideoInfo.isLive) {
            this.logger.debug('[ytcr] MPDPlayer playing livestream; seek request ignored.');
            return false;
        }
        this.emit('action', { name: 'seek', data: { position } });
        this.logger.debug(`[ytcr] MPDPlayer: seek to ${position}s`);
        return await this.resolveOnMPDStatusChanged(this.#mpdClient.api.playback.seekcur.bind(this, position.toString()), 'player', { songid: this.#currentVideoInfo.mpdSongId });
    }
    async doSetVolume(volume) {
        if (this.#asleep || this.#destroyed) {
            return false;
        }
        this.emit('action', { name: 'setVolume', data: { volume } });
        if (this.#asleep || this.#destroyed) {
            return false;
        }
        this.logger.debug(`[ytcr] MPDPlayer: set volume to ${volume}`);
        this.#volumeControl.setVolume(volume);
        return true;
    }
    doGetVolume() {
        return this.#volumeControl.getVolume();
    }
    async doGetPosition() {
        if (this.#asleep || this.#destroyed || !this.#mpdClient) {
            return 0;
        }
        if (this.#currentVideoInfo?.isLive) {
            return 600;
        }
        const mpdStatus = await this.#mpdClient.api.status.get();
        return mpdStatus?.elapsed || 0;
    }
    async doGetDuration() {
        if (this.#asleep || this.#destroyed || !this.#mpdClient) {
            return 0;
        }
        if (this.#currentVideoInfo?.isLive) {
            return 600;
        }
        const mpdStatus = await this.#mpdClient.api.status.get();
        return mpdStatus?.time?.total || 0;
    }
    async destroy() {
        this.#destroyed = true;
        this.#subsystemEventEmitter?.disable();
        await this.stop();
        await this.#mpdClient?.disconnect();
        this.removeAllListeners();
        this.#subsystemEventEmitter = null;
        this.#mpdClient = null;
        this.#currentVideoInfo = null;
        this.#asleep = true;
    }
    sleep() {
        if (!this.#asleep) {
            this.logger.debug('[ytcr] MPDPlayer going to sleep...');
            this.#asleep = true;
        }
    }
    wake() {
        if (this.#asleep) {
            this.logger.debug('[ytcr] MPDPlayer waking up...');
            this.#asleep = false;
        }
    }
    async #handleExternalMPDEvent(event) {
        if (this.#asleep || this.#destroyed || !this.#mpdClient) {
            return;
        }
        this.logger.debug(`[ytcr] MPDPlayer received external MPD event for subsystem: ${event.name}.`);
        const mpdStatus = await this.#mpdClient.api.status.get();
        this.logger.debug('[ytcr] MPD status for subsystem event:', mpdStatus);
        if (!this.#currentVideoInfo || (this.#currentVideoInfo.mpdSongId !== mpdStatus.songid?.toString() && mpdStatus.state !== 'stop')) {
            this.logger.debug('[ytcr] MPD subsystem event does not match current song. Putting player to sleep...');
            this.#currentVideoInfo = null;
            await this.notifyExternalStateChange(yt_cast_receiver_1.Constants.PLAYER_STATUSES.STOPPED);
            this.sleep();
            return;
        }
        if (event.name === 'mixer') {
            this.logger.debug('[ytcr] MPD subsystem event indicated volume change. Notifying senders of change...');
            await this.notifyExternalStateChange();
            //This.emit('volumeChanged', mpdStatus.volume)
            return;
        }
        if (event.name === 'player') {
            switch (mpdStatus.state) {
                case 'pause':
                    await this.notifyExternalStateChange(yt_cast_receiver_1.Constants.PLAYER_STATUSES.PAUSED);
                    break;
                case 'stop':
                    await this.notifyExternalStateChange(yt_cast_receiver_1.Constants.PLAYER_STATUSES.STOPPED);
                    break;
                default:
                    await this.notifyExternalStateChange(yt_cast_receiver_1.Constants.PLAYER_STATUSES.PLAYING);
            }
            //Let playerState = await this.getState(mpdStatus);
            if (mpdStatus.state === 'stop') {
                // In play(), we set consume on for mpd. If song is no longer in the queue,
                // That means it has finished playing
                let songIdInfo;
                try {
                    if (this.#currentVideoInfo.mpdSongId) {
                        songIdInfo = await this.#mpdClient.api.queue.id(this.#currentVideoInfo.mpdSongId);
                    }
                }
                catch (error) {
                    songIdInfo = null;
                }
                this.#currentVideoInfo = null;
                //Let playbackFinished = false;
                if (!songIdInfo) {
                    this.logger.debug('[ytcr] Current playback finished.');
                    //PlaybackFinished = true;
                    await this.next();
                }
                //This.eventEmitter.emit('stateChanged', playerState, { triggeredBy: 'playbackFinished' });
            }
            else {
                //This.eventEmitter.emit('stateChanged', playerState, { triggeredBy: 'external' });
            }
        }
    }
    resolveOnMPDStatusChanged(action, subsystem, resolveOn = {}) {
        return new Promise((resolve) => {
            this.#subsystemEventEmitter?.prependOnceListener(subsystem, async (event) => {
                const mpdStatus = await this.#mpdClient?.api.status.get();
                let shouldResolve = true;
                for (const [key, value] of Object.entries(resolveOn)) {
                    if (mpdStatus[key] === undefined || mpdStatus[key].toString() !== value.toString()) {
                        shouldResolve = false;
                        break;
                    }
                }
                event.stopPropagation();
                if (shouldResolve) {
                    this.logger.debug('[ytcr] Condition for resolveOnMPDStatusChanged() satisfied. Resolving Promise...');
                    resolve(true);
                }
                else {
                    this.logger.debug('[ytcr] MPD status:', mpdStatus, 'does not match condition:', resolveOn);
                    this.logger.debug('[ytcr] Condition for resolveOnMPDStatusChanged() failed. Rejecting Promise...');
                    resolve(false);
                }
            });
            action();
        });
    }
    async getVolumioState() {
        if (this.#asleep || this.#destroyed || !this.#mpdClient) {
            return null;
        }
        const mpdStatus = await this.#mpdClient.api.status.get();
        if (!mpdStatus) {
            return null;
        }
        const state = {
            status: mpdStatus.state,
            service: 'ytcr',
            album: 'YouTube Cast',
            albumart: this.#currentVideoInfo?.thumbnail || '/albumart',
            uri: '',
            trackType: 'YouTube',
            seek: Math.round((mpdStatus.elapsed || 0) * 1000),
            duration: Math.round(mpdStatus.time?.total || 0),
            volume: mpdStatus.volume || 0
        };
        const audio = mpdStatus?.audio;
        if (audio) {
            if (audio.bits && audio.bits !== 'f') {
                state.bitdepth = `${audio.bits.toString()} bit`;
            }
            if (audio.sample_rate_short) {
                state.samplerate = `${audio.sample_rate_short.value} ${audio.sample_rate_short.unit}`;
            }
        }
        if (this.#currentVideoInfo) {
            state.title = this.#currentVideoInfo.title;
            state.artist = this.#currentVideoInfo.channel;
            if (this.#currentVideoInfo.bitrate) {
                state.bitrate = this.#currentVideoInfo.bitrate;
            }
            if (this.#currentVideoInfo.channels) {
                state.channels = this.#currentVideoInfo.channels;
            }
            state.isStreaming = this.#currentVideoInfo.isLive;
            if (this.#currentVideoInfo.isLive) {
                state.duration = 0;
                state.seek = 0;
            }
        }
        return state;
    }
    on(event, listener) {
        super.on(event, listener);
        return this;
    }
}
exports.default = MPDPlayer;
//# sourceMappingURL=MPDPlayer.js.map