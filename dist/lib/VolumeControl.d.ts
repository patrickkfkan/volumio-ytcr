import { Logger } from 'yt-cast-receiver';
interface VolumioVolumeChangeListener {
    (volume: {
        vol: number;
    }): Promise<void>;
}
export default class VolumeControl {
    #private;
    constructor(commandRouter: any, logger: Logger);
    setVolume(volume: number, setInternalOnly?: boolean): Promise<void>;
    getVolume(): Promise<number>;
    registerVolumioVolumeChangeListener(listener: VolumioVolumeChangeListener): void;
    unregisterVolumioVolumeChangeListener(): void;
}
export {};
//# sourceMappingURL=VolumeControl.d.ts.map