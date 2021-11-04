import {Module, Inject} from '@nestjs/common';
import {DynamicModule, OnModuleDestroy, OnModuleInit} from '@nestjs/common/interfaces';
import {loadPackage} from '@nestjs/common/utils/load-package.util';

import {MapperKind, mapSchema, SchemaMapper} from "@graphql-tools/utils";

import {ApplicationConfig, HttpAdapterHost} from '@nestjs/core';

import {ApolloServerBase} from 'apollo-server-core';
import type {ApolloServerExpressConfig} from 'apollo-server-express';
import type {ApolloServerFastifyConfig} from "apollo-server-fastify";

import {makeExecutableSchema} from "@graphql-tools/schema";

import type {LighthouseModuleOptions} from "./interfaces/lighthouse-module-options.interface";

import {BaseDirective} from "./directives/base.directive";
import {DeprecatedDirective} from './directives/deprecated.directive';
import {GuardDirective} from "./directives/guard.directive";
import {UpperCaseDirective} from "./directives/upper-case.directive";
import {PaginateDirective} from "./directives/paginate.directive";

import {LoaderRegistry} from "./loaders/loader.registry";

import {LighthouseExplorer} from "./lighthouse.explorer";

import {LIGHTHOUSE_MODULE_OPTIONS} from './lighthouse.constants';

const APOLLO_FASTIFY_PACKAGE = 'apollo-server-fastify';
const APOLLO_EXPRESS_PACKAGE = 'apollo-server-express';

@Module({
    imports: [],
    controllers: [],
    providers: [
        LighthouseExplorer,
        DeprecatedDirective,
        GuardDirective,
        UpperCaseDirective,
        PaginateDirective,
    ],
})
export class LighthouseModule implements OnModuleInit, OnModuleDestroy {
    private internalApolloServer: ApolloServerBase;

    public constructor(
        @Inject(LIGHTHOUSE_MODULE_OPTIONS) private readonly options: LighthouseModuleOptions,
        private readonly httpAdapterHost: HttpAdapterHost,
        private readonly applicationConfig: ApplicationConfig,
        private readonly explorer: LighthouseExplorer,
    ) {
    }

    static forRoot(options: LighthouseModuleOptions = {}): DynamicModule {
        return {
            module: LighthouseModule,
            providers: [
                {
                    provide: LIGHTHOUSE_MODULE_OPTIONS,
                    useValue: options,
                },
            ],
        };
    }

    private async registerExpressGraphQLServer(
        app: any,
        config: ApolloServerExpressConfig
    ) {
        const {ApolloServer} = loadPackage(
            APOLLO_EXPRESS_PACKAGE,
            'LighthouseModule',
            () => require(APOLLO_EXPRESS_PACKAGE),
        );

        const server = new ApolloServer(config);

        await server.start();

        server.applyMiddleware({
            app,
            path: '/graphql'
        });

        return server;
    }

    private async registerFastifyGraphQLServer(
        app: any,
        config: ApolloServerFastifyConfig
    ) {
        const {ApolloServer} = loadPackage(
            APOLLO_FASTIFY_PACKAGE,
            'LighthouseModule',
            () => require(APOLLO_FASTIFY_PACKAGE),
        );

        const server = new ApolloServer(config);

        await server.start();

        await app.register(
            server.createHandler({
                path: '/graphql',
            }),
        );

        return server;
    }

    private async registerGraphQLServer(
        platform: string,
        app: any,
        config: ApolloServerExpressConfig | ApolloServerFastifyConfig
    ) {
        let server: ApolloServerBase & any;

        if (platform === 'express') {
            server = await this.registerExpressGraphQLServer(app, config)
        } else if (platform === 'fastify') {
            server = await this.registerFastifyGraphQLServer(app, config);
        } else {
            throw new Error(`No support for current HttpAdapter: ${platform}`);
        }

        if (!server) {
            throw new Error(`Unable to load ApolloServer for current HttpAdapter: ${platform}`);
        }

        this.internalApolloServer = server;
    }

    public buildSchemaMapper(
        directive: BaseDirective
    ) {
        const schemaMapper: SchemaMapper = {};

        Object.values(MapperKind).forEach((kind: string) => {
            if (typeof directive[kind] === 'function') {
                schemaMapper[kind] = directive[kind];
            }
        });

        return schemaMapper;
    }

    public async onModuleInit() {
        if (!this.httpAdapterHost) {
            return;
        }

        const httpAdapter = this.httpAdapterHost.httpAdapter;
        if (!httpAdapter) {
            return;
        }

        this.explorer.init();

        const {transformSchema, transformDirectives} = this.options;

        const directives = this.explorer.directives();

        // Get all registered directives.
        const transformedDirectives = transformDirectives ? await transformDirectives(directives) : directives;

        // Get all SDL directive definitions.
        const directivesTypeDefs = transformedDirectives.map(
            (instance) => instance.definition()
        );

        // Get and build directive schema mappers.
        const directivesSchemaMappers = transformedDirectives.map(
            (instance) => this.buildSchemaMapper(instance)
        );

        // executable schema
        const executableSchema = makeExecutableSchema({
            typeDefs: [
                ...directivesTypeDefs,
                `
                type User {
                    id: ID!
                    name: String!
                }
                
                type Query {
                  valid: String @upperCase
                  secured: String 
                  invalid: String @deprecated(reason: "I'm deprecated...")
                  usersA: [User] @paginate 
                  usersB: [User] @paginate 
                }
              `
            ],
            resolvers: {
                Query: {
                    valid: () => "test"
                },
            }
        });

        // Reduce schema with directive transformers.
        const schemaWithDirectives = directivesSchemaMappers.reduceRight((
            prev,
            next
        ) => mapSchema(prev, next), executableSchema);

        //  Transform schema if defined in
        const schema = transformSchema ? await transformSchema(schemaWithDirectives) : schemaWithDirectives;

        // Create shareable apollo config
        const config: ApolloServerExpressConfig | ApolloServerFastifyConfig = {
            schema,
            context: (req) => {
                const loader = new LoaderRegistry();

                return {
                    loader,
                }
            }
        };

        await this.registerGraphQLServer(
            httpAdapter.getType(),
            httpAdapter.getInstance(),
            config
        );
    }

    public async onModuleDestroy() {
        await this.internalApolloServer.stop();
    }
}
