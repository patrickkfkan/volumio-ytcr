interface DeviceInfo {
    name: string;
    uuid: string;
    time: string;
}
declare class YTCRContext {
    #private;
    constructor();
    set(key: string, value: any): void;
    get(key: string, defaultValue?: any): any;
    init(pluginContext: any, pluginConfig: any): void;
    toast(type: string, message: string, title?: string): void;
    getDeviceInfo(): DeviceInfo;
    getConfigValue(key: string, defaultValue?: any, json?: boolean): any;
    getMpdPlugin(): any;
    getStateMachine(): any;
    reset(): void;
    getI18n(key: string, ...formatValues: any[]): string;
}
declare const _default: YTCRContext;
export default _default;
//# sourceMappingURL=YTCRContext.d.ts.map