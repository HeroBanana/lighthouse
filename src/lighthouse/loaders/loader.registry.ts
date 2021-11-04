import DataLoader from "dataloader";

export class LoaderRegistry {
    private loaders: Record<string, unknown> = {};

    public has = (loader: string) => {
        return this.loaders.hasOwnProperty(loader);
    }

    public get = (loader: string) => {
        return this.loaders[loader] || null;
    }

    public add = <K, V, C = K>(loader: string, batchLoadFn: DataLoader.BatchLoadFn<K, V>, options: DataLoader.Options<K, V, C>) => {
        this.loaders[loader] = new DataLoader(batchLoadFn, options);
    }
}
