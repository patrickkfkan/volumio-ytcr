import { Logger, Video } from 'yt-cast-receiver';
import { AbortSignal } from 'abort-controller';
export interface VideoInfo {
    id: string;
    errMsg?: string;
    title?: string;
    channel?: string;
    thumbnail?: string;
    isLive?: boolean;
    streamUrl?: string | null;
    bitrate?: string;
    samplerate?: number;
    channels?: number;
}
export default class VideoLoader {
    #private;
    constructor(logger: Logger);
    getInfo(video: Video, abortSignal: AbortSignal): Promise<VideoInfo>;
}
//# sourceMappingURL=VideoLoader.d.ts.map