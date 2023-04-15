import Innertube, * as InnertubeLib from 'volumio-youtubei.js';
import { VideoInfo as InnertubeVideoInfo } from 'volumio-youtubei.js/dist/src/parser/youtube/index.js';
import Format from 'volumio-youtubei.js/dist/src/parser/classes/misc/Format.js';
import { Logger, Video } from 'yt-cast-receiver';
import { AbortSignal } from 'abort-controller';
import ytcr from './YTCRContext.js';
import fetch from 'node-fetch';

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
} as InnertubeLib.FormatOptions;

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

export default class VideoLoader {

  #innertube: Innertube | null;
  #logger: Logger;

  constructor(logger: Logger) {
    this.#innertube = null;
    this.#logger = logger;
  }

  async #init() {
    if (!this.#innertube) {
      this.#innertube = await Innertube.create();
    }
  }

  async getInfo(video: Video, abortSignal: AbortSignal): Promise<VideoInfo> {
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
      } as any;
    }
    else {
      delete (this.#innertube.session.context.user as any)?.credentialTransferTokens;
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

  #getThumbnail(data: any): string {
    const url = data?.[0]?.url;
    if (url?.startsWith('//')) {
      return `https:${url}`;
    }
    return url;
  }

  #chooseFormat(videoInfo: InnertubeVideoInfo) {
    if (!this.#innertube) {
      throw Error('VideoLoader not initialized');
    }
    const format = videoInfo?.chooseFormat(BEST_AUDIO_FORMAT);
    const streamUrl = format ? format.decipher(this.#innertube.session.player) : null;
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
}
