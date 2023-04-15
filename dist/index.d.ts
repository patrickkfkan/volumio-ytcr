import { VolumioState } from './lib/MPDPlayer.js';
declare class ControllerYTCR {
    #private;
    constructor(context: any);
    getUIConfig(): any;
    onVolumioStart(): any;
    onStart(): any;
    configSaveConnection(data: any): void;
    configConfirmSaveConnection(data: any): void;
    configSaveOther(data: any): void;
    refreshUIConfig(): void;
    onStop(): any;
    restart(): any;
    getConfigurationFiles(): string[];
    setVolatile(): void;
    unsetVolatile(): void;
    onUnsetVolatile(): Promise<boolean>;
    pushIdleState(): void;
    pushState(state?: VolumioState): Promise<void>;
    isCurrentService(): boolean;
    stop(): any;
    play(): any;
    pause(): any;
    resume(): any;
    seek(position: number): any;
    next(): any;
    previous(): any;
}
export = ControllerYTCR;
//# sourceMappingURL=index.d.ts.map