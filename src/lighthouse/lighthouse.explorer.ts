import {Injectable, Type} from "@nestjs/common";
import {ModuleRef, ModulesContainer} from "@nestjs/core";
import {Module} from "@nestjs/core/injector/module";
import {InstanceWrapper} from "@nestjs/core/injector/instance-wrapper";

import {BaseDirective} from "./directives/base.directive"

@Injectable()
export class LighthouseExplorer {
    private directivesRecords: BaseDirective[];

    private initialized = false;

    public constructor(
        protected readonly modulesContainer: ModulesContainer,
        protected readonly moduleRef: ModuleRef,
    ) {
    }

    protected discover<T>(key) {
        const modules = Array.from(this.modulesContainer.values());

        return this.flatMap<T>(modules, (instance) => {
            return this.filterProvider(instance, key);
        });
    }

    private flatMap<T>(modules: Module[], callback: (instance: InstanceWrapper) => Type<T>): Type<T>[] {
        const items = modules.map((module) => {
            const providers = module.providers.values();

            return Array.from(providers).map(callback)
        }).reduce((a, b) => a.concat(b), []);

        return items.filter(element => !!element);
    }

    private filterProvider<T>(wrapper: InstanceWrapper, metadataKey: string,): Type<T> {
        const {instance} = wrapper;
        if (!instance) {
            return null;
        }

        return this.extractMetadata<T>(instance, metadataKey);
    }

    private extractMetadata<T>(instance: Object, metadataKey: string): Type<T> {
        if (!instance.constructor) {
            return null;
        }

        const metadata = Reflect.getMetadata(metadataKey, instance.constructor);

        return metadata ? (instance.constructor as Type<T>) : null;
    }

    public init(): void {
        if (this.initialized) {
            return;
        }

        const directives = this.discover<BaseDirective>("@lighthouse/directive");

        this.directivesRecords = directives.map((directive) => this.moduleRef.get(directive, {
            strict: true,
        }));

        this.initialized = true;
    }

    public directives() {
        return this.directivesRecords;
    }
}
