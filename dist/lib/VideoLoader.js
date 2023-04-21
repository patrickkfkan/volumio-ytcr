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
Object.defineProperty(exports, "__esModule", { value: true });
const volumio_youtubei_js_1 = __importStar(require("volumio-youtubei.js")), InnertubeLib = volumio_youtubei_js_1;
const yt_cast_receiver_1 = require("yt-cast-receiver");
const node_fetch_1 = __importDefault(require("node-fetch"));
const YTCRContext_js_1 = __importDefault(require("./YTCRContext.js"));
// https://gist.github.com/sidneys/7095afe4da4ae58694d128b1034e01e2
const ITAG_TO_BITRATE = {
    '139': '48',
    '140': '128',
    '141': '256',
    '171': '128',
    '249': '50',
    '250': '70',
    '251': '160'
};
const BEST_AUDIO_FORMAT = {
    type: 'audio',
    format: 'any',
    quality: 'best'
};
class VideoLoader {
    #innertube;
    #logger;
    #innertubeInitialClient;
    #innertubeTVClient;
    constructor(logger) {
        this.#innertube = null;
        this.#logger = logger;
    }
    async #init() {
        if (!this.#innertube) {
            this.#innertube = await volumio_youtubei_js_1.default.create();
            this.#innertubeInitialClient = { ...this.#innertube.session.context.client };
            this.#innertubeTVClient = {
                ...this.#innertube.session.context.client,
                clientName: 'TVHTML5',
                clientVersion: '7.20230405.08.01',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36; SMART-TV; Tizen 4.0,gzip(gfe)'
            };
        }
    }
    async getInfo(video, abortSignal) {
        if (!this.#innertube) {
            await this.#init();
        }
        if (!this.#innertube) {
            throw Error('VideoLoader not initialized');
        }
        this.#logger.debug(`[ytcr] VideoLoader.getInfo: ${video.id}`);
        if (abortSignal) {
            abortSignal.onabort = () => {
                const abortError = Error(`VideoLoader.getInfo() aborted for video Id: ${video.id}`);
                abortError.name = 'AbortError';
                throw abortError;
            };
        }
        const cpn = InnertubeLib.Utils.generateRandomString(16);
        // Prepare request payload
        const payload = {
            videoId: video.id,
            enableMdxAutoplay: true,
            isMdxPlayback: true,
            playbackContext: {
                contentPlaybackContext: {
                    signatureTimestamp: this.#innertube.session.player?.sts || 0
                }
            }
        };
        if (video.context?.playlistId) {
            payload.playlistId = video.context.playlistId;
        }
        if (video.context?.params) {
            payload.params = video.context.params;
        }
        if (video.context?.index !== undefined) {
            payload.index = video.context.index;
        }
        // We are requesting data as a 'TV' client
        this.#innertube.session.context.client = this.#innertubeTVClient;
        // Modify innertube's session context to include `ctt` param
        if (video.context?.ctt) {
            this.#innertube.session.context.user = {
                enableSafetyMode: false,
                lockedSafetyMode: false,
                credentialTransferTokens: [
                    {
                        'scope': 'VIDEO',
                        'token': video.context?.ctt
                    }
                ]
            };
        }
        else {
            delete this.#innertube.session.context.user?.credentialTransferTokens;
        }
        try {
            // There are two endpoints we need to fetch data from:
            // 1. '/next': for metadata (title, channel for video, artist / album for music...)
            // 2. '/player': for streaming data
            const nextResponse = await this.#innertube.actions.execute('/next', payload);
            let basicInfo = null;
            // We cannot use innertube to parse `nextResponse`, because it doesn't
            // Have `SingleColumnWatchNextResults` parser class. We would have to do it ourselves.
            const singleColumnContents = nextResponse.data?.contents?.singleColumnWatchNextResults?.
                results?.results?.contents?.[0]?.itemSectionRenderer?.contents?.[0];
            const videoMetadata = singleColumnContents?.videoMetadataRenderer;
            const songMetadata = singleColumnContents?.musicWatchMetadataRenderer;
            if (videoMetadata) {
                basicInfo = {
                    id: video.id,
                    src: 'yt',
                    title: new InnertubeLib.Misc.Text(videoMetadata.title).toString(),
                    channel: new InnertubeLib.Misc.Text(videoMetadata.owner?.videoOwnerRenderer?.title).toString()
                };
            }
            else if (songMetadata) {
                basicInfo = {
                    id: video.id,
                    src: 'ytmusic',
                    title: new InnertubeLib.Misc.Text(songMetadata.title).toString(),
                    artist: new InnertubeLib.Misc.Text(songMetadata.byline).toString(),
                    album: songMetadata.albumName ? new InnertubeLib.Misc.Text(songMetadata.albumName).toString() : ''
                };
            }
            if (!basicInfo) {
                throw new yt_cast_receiver_1.DataError('Metadata not found in response');
            }
            // Fetch response from '/player' endpoint.
            // But first revert to initial client in innertube context, otherwise livestreams will only have DASH manifest URL
            // - what we need is the HLS manifest URL
            this.#innertube.session.context.client = { ...this.#innertubeInitialClient };
            if (basicInfo.src === 'ytmusic') {
                // For YouTube Music, it is also necessary to set `payload.client` to 'YTMUSIC'. Innertube will modify
                // `context.client` with YouTube Music client info before submitting it to the '/player' endpoint.
                payload.client = 'YTMUSIC';
            }
            const playerResponse = await this.#innertube.actions.execute('/player', payload);
            // Wrap it in innertube VideoInfo.
            const innertubeVideoInfo = new InnertubeLib.YT.VideoInfo([playerResponse], this.#innertube.actions, this.#innertube.session.player, cpn);
            const thumbnail = this.#getThumbnail(innertubeVideoInfo.basic_info.thumbnail);
            const isLive = !!innertubeVideoInfo.basic_info.is_live;
            // Retrieve stream info
            let playable = false;
            let errMsg = null;
            let streamInfo = null;
            if (innertubeVideoInfo.playability_status.status === 'UNPLAYABLE') {
                if (innertubeVideoInfo.has_trailer) {
                    const trailerInfo = innertubeVideoInfo.getTrailerInfo();
                    if (trailerInfo) {
                        streamInfo = this.#chooseFormat(trailerInfo);
                    }
                }
                else {
                    errMsg = innertubeVideoInfo.playability_status.reason;
                }
            }
            else if (!isLive) {
                streamInfo = this.#chooseFormat(innertubeVideoInfo);
            }
            else if (innertubeVideoInfo.streaming_data?.hls_manifest_url) {
                const targetQuality = YTCRContext_js_1.default.getConfigValue('liveStreamQuality', 'auto');
                streamInfo = {
                    url: await this.#getStreamUrlFromHLS(innertubeVideoInfo.streaming_data.hls_manifest_url, targetQuality)
                };
            }
            playable = !!streamInfo?.url;
            if (!playable && !errMsg) {
                errMsg = YTCRContext_js_1.default.getI18n('YTCR_STREAM_NOT_FOUND');
            }
            return {
                ...basicInfo,
                errMsg: errMsg || undefined,
                thumbnail,
                isLive,
                streamUrl: streamInfo?.url,
                bitrate: streamInfo?.bitrate || undefined,
                samplerate: streamInfo?.sampleRate,
                channels: streamInfo?.channels
            };
        }
        catch (error) {
            this.#logger.error(`[ytcr] Error in VideoLoader.getInfo(${video.id}):`, error);
            return {
                id: video.id,
                errMsg: error instanceof Error ? error.message : '(Check logs for errors)'
            };
        }
    }
    #getThumbnail(data) {
        const url = data?.[0]?.url;
        if (url?.startsWith('//')) {
            return `https:${url}`;
        }
        return url;
    }
    #chooseFormat(videoInfo) {
        if (!this.#innertube) {
            throw Error('VideoLoader not initialized');
        }
        const format = videoInfo?.chooseFormat(BEST_AUDIO_FORMAT);
        const streamUrl = format ? format.decipher(this.#innertube.session.player) : null;
        const streamData = format ? { ...format, url: streamUrl } : null;
        if (streamData) {
            return this.#parseStreamData(streamData);
        }
        return null;
    }
    #parseStreamData(data) {
        const audioBitrate = ITAG_TO_BITRATE[`${data.itag}`];
        return {
            url: data.url,
            mimeType: data.mime_type,
            bitrate: audioBitrate ? `${audioBitrate} kbps` : null,
            sampleRate: data.audio_sample_rate,
            channels: data.audio_channels
        };
    }
    async #getStreamUrlFromHLS(manifestUrl, targetQuality) {
        if (!targetQuality || targetQuality === 'auto') {
            return manifestUrl;
        }
        const res = await (0, node_fetch_1.default)(manifestUrl);
        const manifestContents = await res.text();
        // Match Resolution and Url
        const regex = /#EXT-X-STREAM-INF.*RESOLUTION=(\d+x\d+).*[\r\n](.+)/gm;
        const playlistVariants = [];
        // Modified from regex101's code generator :)
        let m;
        while ((m = regex.exec(manifestContents)) !== null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            const variant = {};
            playlistVariants.push(variant);
            m.forEach((match, groupIndex) => {
                if (groupIndex === 1) { // Resolution
                    variant.quality = `${match.split('x')[1]}p`;
                }
                if (groupIndex === 2) {
                    variant.url = match;
                }
            });
        }
        // Find matching variant or closest one that is lower than targetQuality
        const targetQualityInt = parseInt(targetQuality);
        const diffs = playlistVariants.map((variant) => ({
            variant,
            qualityDelta: targetQualityInt - parseInt(variant.quality)
        }));
        const closest = diffs.filter((v) => v.qualityDelta >= 0).sort((v1, v2) => v1.qualityDelta - v2.qualityDelta)[0];
        return closest?.variant.url || playlistVariants[0]?.url || null;
    }
}
exports.default = VideoLoader;
//# sourceMappingURL=VideoLoader.js.map