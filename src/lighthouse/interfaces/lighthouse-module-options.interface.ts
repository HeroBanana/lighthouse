import {GraphQLSchema} from "graphql";
import {BaseDirective} from "../directives/base.directive";


export interface LighthouseModuleOptions {
    transformDirectives?: (directives: BaseDirective[]) => BaseDirective[] | Promise<BaseDirective[]>;
    transformSchema?: (schema: GraphQLSchema) => GraphQLSchema | Promise<GraphQLSchema>;
}
