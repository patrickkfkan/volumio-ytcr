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
    constructor(logger) {
        this.#innertube = null;
        this.#logger = logger;
    }
    async #init() {
        if (!this.#innertube) {
            this.#innertube = await volumio_youtubei_js_1.default.create();
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
        // Prepare endpoint for innertube.getInfo()
        const endpoint = new InnertubeLib.YTNodes.NavigationEndpoint({});
        endpoint.payload = {
            videoId: video.id
        };
        if (video.context?.playlistId) {
            endpoint.payload.playlistId = video.context.playlistId;
        }
        if (video.context?.params) {
            endpoint.payload.params = video.context.params;
        }
        if (video.context?.index !== undefined) {
            endpoint.payload.index = video.context.index;
        }
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
            const info = await this.#innertube.getInfo(endpoint);
            const basicInfo = info.basic_info;
            const title = basicInfo.title;
            const channel = basicInfo.author;
            const thumbnail = this.#getThumbnail(basicInfo.thumbnail);
            const isLive = !!basicInfo.is_live;
            let playable = false;
            let errMsg = null;
            let streamInfo = null;
            if (info.playability_status.status === 'UNPLAYABLE') {
                if (info.has_trailer) {
                    const trailerInfo = info.getTrailerInfo();
                    if (trailerInfo) {
                        streamInfo = this.#chooseFormat(trailerInfo);
                    }
                }
                else {
                    errMsg = info.playability_status.reason;
                }
            }
            else if (!isLive) {
                streamInfo = this.#chooseFormat(info);
            }
            else if (info.streaming_data?.hls_manifest_url) {
                const targetQuality = YTCRContext_js_1.default.getConfigValue('liveStreamQuality', 'auto');
                streamInfo = {
                    url: await this.#getStreamUrlFromHLS(info.streaming_data.hls_manifest_url, targetQuality)
                };
            }
            playable = !!streamInfo?.url;
            if (!playable && !errMsg) {
                errMsg = YTCRContext_js_1.default.getI18n('YTCR_STREAM_NOT_FOUND');
            }
            return {
                id: video.id,
                errMsg: errMsg || undefined,
                title,
                channel,
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