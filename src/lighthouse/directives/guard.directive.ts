import {FieldMapper, getDirective, MapperKind, ObjectTypeMapper} from '@graphql-tools/utils';
import {GraphQLSchema, GraphQLError} from 'graphql';

import {Directive} from "../decorators/directive.decorator";
import {BaseDirective} from "./base.directive";

const DIRECTIVE_NAME = 'guard';

@Directive(DIRECTIVE_NAME)
export class GuardDirective extends BaseDirective {
    public definition() {
        return `
"""
Run authentication through one or more guards.
This is run per field and may allow unauthenticated
users to still receive partial results.
Used upon an object, it applies to all fields within.
"""
directive @${DIRECTIVE_NAME}(
  """
  Specify which guards to use, e.g. ["api"].
  """
  with: [String!]
) repeatable on FIELD_DEFINITION | OBJECT
        `;
    }

    public [MapperKind.OBJECT_FIELD]: FieldMapper = (
        fieldConfig,
        fieldName,
        typeName,
        schema
    ) => {
        const directive = getDirective(schema, fieldConfig, DIRECTIVE_NAME)?.[0];
        if (directive) {
            fieldConfig.resolve = () => {
                throw new GraphQLError("You are not authorized to access this area.");
            }

            return fieldConfig;
        }
    }

    public [MapperKind.OBJECT_TYPE]: ObjectTypeMapper = (
        fieldConfig,
        schema
    ) => {
        const directive = getDirective(schema, fieldConfig, DIRECTIVE_NAME)?.[0];
        if (directive) {
            fieldConfig.resolveObject = () => {
                throw new GraphQLError("You are not authorized to access this area.");
            }

            return fieldConfig;
        }
    }
}
