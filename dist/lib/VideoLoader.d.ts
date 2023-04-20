import { Logger, Video } from 'yt-cast-receiver';
import { AbortSignal } from 'abort-controller';
interface BasicInfo {
    id: string;
    type?: 'song' | 'video';
    title?: string;
    channel?: string;
    artist?: string;
    album?: string;
}
export interface VideoInfo extends BasicInfo {
    errMsg?: string;
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
export {};
//# sourceMappingURL=VideoLoader.d.ts.map