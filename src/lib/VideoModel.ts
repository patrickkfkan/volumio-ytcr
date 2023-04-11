import { AutoplayLoader, Logger, Player } from 'yt-cast-receiver';
import InnerTube, * as InnerTubeLib from 'volumio-youtubei.js';
import { VideoInfo as InnerTubeVideoInfo } from 'volumio-youtubei.js/dist/src/parser/youtube/index.js';
import Format from 'volumio-youtubei.js/dist/src/parser/classes/misc/Format.js';
import fetch from 'node-fetch';
import ytcr from './YTCRContext.js';
import { AbortSignal } from 'abort-controller';

type InnerTubeEndpoint = InnerTubeLib.YTNodes.NavigationEndpoint;

// https://gist.github.com/sidneys/7095afe4da4ae58694d128b1034e01e2
const ITAG_TO_BITRATE = {
  '139': '48',
  '140': '128',
  '141': '256',
  '171': '128',
  '249': '50',
  '250': '70',
  '251': '160'
} as Record<string, string>;

const BEST_AUDIO_FORMAT = {
  type: 'audio',
  format: 'any',
  quality: 'best'
} as InnerTubeLib.FormatOptions;

export interface VideoInfo {
  id: string,
  errMsg?: string,
  title?: string,
  channel?: string,
  thumbnail?: string,
  isLive?: boolean,
  streamUrl?: string | null,
  bitrate?: string,
  samplerate?: number,
  channels?: number
}

interface StreamInfo {
  url: string | null,
  mimeType?: string,
  bitrate?: string | null,
  sampleRate?: number,
  channels?: number
}

export default class VideoModel implements AutoplayLoader {

  #innerTube: Record<string, InnerTube> | null;
  #logger: Logger;

  constructor(logger: Logger) {
    this.#innerTube = null;
    this.#logger = logger;
  }

  async init() {
    if (!this.#innerTube) {
      const instances = await Promise.all([ InnerTube.create(), InnerTube.create() ]);
      this.#innerTube = {
        'info': instances[0],
        'autoplay': instances[1]
      };

      this.#innerTube.autoplay.session.context.client.clientName = 'TVHTML5';
      this.#innerTube.autoplay.session.context.client.clientVersion = '7.20230405.08.01';
      this.#innerTube.autoplay.session.context.client.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.142 Safari/537.36; SMART-TV; Tizen 4.0,gzip(gfe)';
    }
    // TODO: apply i18n to innertube
  }

  #createInnerTubeEndpoint(ctx: 'info' | 'autoplay', videoId: string, player: Player): InnerTubeEndpoint {
    if (!this.#innerTube) {
      throw Error('[ytcr] VideoModel not initialized.');
    }

    const endpoint = new InnerTubeLib.YTNodes.NavigationEndpoint({});
    endpoint.payload = {
      videoId
    };
    if (player.playlist.id) {
      endpoint.payload.playlistId = player.playlist.id;
    }
    /*If (player.playlist.params) {
      endpoint.payload.params = player.playlist.params;
    }*/
    const vIndex = player.playlist.videoIds.findIndex((id) => id === videoId);
    if (vIndex >= 0) {
      if (ctx === 'info') {
        endpoint.payload.index = vIndex;
      }
      else {
        endpoint.payload.playlistIndex = vIndex;
      }
    }
    if (ctx === 'autoplay') {
      endpoint.payload.enableMdxAutoplay = true;
      endpoint.payload.isMdxPlayback = true;
    }

    return endpoint;
  }

  #configureInnerTubeContext(ctx: 'info' | 'autoplay', config: Record<string, any> = {}) {
    if (!this.#innerTube) {
      throw Error('[ytcr] VideoModel not initialized.');
    }

    if (config.ctt) {
      this.#innerTube[ctx].session.context.user = {
        enableSafetyMode: false,
        lockedSafetyMode: false,
        credentialTransferTokens: [
          {
            'scope': 'VIDEO',
            'token': config.ctt
          }
        ]
      } as any;
    }
    else {
      delete (this.#innerTube[ctx].session.context.user as any)?.credentialTransferTokens;
    }
  }

  async getInfo(videoId: string, player: Player, abortSignal: AbortSignal): Promise<VideoInfo> {
    if (!this.#innerTube) {
      throw Error('[ytcr] VideoModel not initialized.');
    }

    this.#logger.debug(`[ytcr] VideoModel.getInfo: ${videoId}`);

    if (abortSignal) {
      abortSignal.onabort = () => {
        const abortError = Error(`VideoModel.getInfo() aborted for video Id: ${videoId}`);
        abortError.name = 'AbortError';
        throw abortError;
      };
    }

    try {
      const endpoint = this.#createInnerTubeEndpoint('info', videoId, player);
      this.#configureInnerTubeContext('info', { ctt: player.playlist.ctt });
      const info = await this.#innerTube.info.getInfo(endpoint);

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
        // TODO: Add liveStreamQuality setting
        const targetQuality = ytcr.getConfigValue('liveStreamQuality', 'auto');
        streamInfo = {
          url: await this.#getStreamUrlFromHLS(info.streaming_data.hls_manifest_url, targetQuality)
        };
      }

      playable = !!streamInfo?.url;

      if (!playable && !errMsg) {
        errMsg = ytcr.getI18n('YTCR_STREAM_NOT_FOUND');
      }

      return {
        id: videoId,
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
      this.#logger.error(`[ytcr] Error in VideoModel.getInfo(${videoId}):`, error);
      return {
        id: videoId,
        errMsg: error instanceof Error ? error.message : '(Check logs for errors)'
      };
    }
  }

  #getThumbnail(data: any): string {
    const url = data?.[0]?.url;
    if (url?.startsWith('//')) {
      return `https:${url}`;
    }
    return url;
  }

  #chooseFormat(videoInfo: InnerTubeVideoInfo) {
    if (!this.#innerTube) {
      throw Error('VideoModel not initialized');
    }
    const format = videoInfo?.chooseFormat(BEST_AUDIO_FORMAT);
    const streamUrl = format ? format.decipher(this.#innerTube.info.session.player) : null;
    const streamData = format ? { ...format, url: streamUrl } as Format : null;
    if (streamData) {
      return this.#parseStreamData(streamData);
    }
    return null;
  }

  #parseStreamData(data: Format): StreamInfo {
    const audioBitrate = ITAG_TO_BITRATE[`${data.itag}`];

    return {
      url: data.url,
      mimeType: data.mime_type,
      bitrate: audioBitrate ? `${audioBitrate} kbps` : null,
      sampleRate: data.audio_sample_rate,
      channels: data.audio_channels
    };
  }

  async #getStreamUrlFromHLS(manifestUrl: string, targetQuality?: string): Promise<string | null> {
    if (!targetQuality || targetQuality === 'auto') {
      return manifestUrl;
    }

    const res = await fetch(manifestUrl);
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

      const variant: any = {};
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

  // Implements
  async getAutoplayVideoId(videoId: string, player: Player, logger: Logger): Promise<string | null> {
    if (!this.#innerTube) {
      throw Error('VideoModel not initialized');
    }
    this.#logger.debug(`[ytcr] VideoModel.getAutoplayVideoId: ${videoId}`);

    try {
      const endpoint = this.#createInnerTubeEndpoint('autoplay', videoId, player);
      this.#configureInnerTubeContext('autoplay', { ctt: player.playlist.ctt });
      const nextResponse = await this.#innerTube.autoplay.actions.execute('/next', endpoint.payload) as any;

      const autoplayEndpoint = new InnerTubeLib.YTNodes.NavigationEndpoint(
        nextResponse.data?.contents?.singleColumnWatchNextResults?.autoplay?.autoplay
          ?.sets?.[0]?.autoplayVideoRenderer?.mdxAutoplayVideoRenderer?.navigationEndpoint);

      logger.debug(`[ytcr] Autoplay endpoint for video Id: ${videoId}`, autoplayEndpoint);

      return autoplayEndpoint.payload?.videoId || null;
    }
    catch (error) {
      logger.error(`[ytcr] Failed to get autoplay video for video Id: ${videoId}`, error);
      return null;
    }
  }
}
