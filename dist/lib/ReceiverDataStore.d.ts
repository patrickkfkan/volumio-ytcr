import { DataStore } from 'yt-cast-receiver';
export default class ReceiverDataStore extends DataStore {
    #private;
    constructor();
    set<T>(key: string, value: T): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    clear(): void;
}
//# sourceMappingURL=ReceiverDataStore.d.ts.map