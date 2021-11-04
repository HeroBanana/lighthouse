import {FieldMapper, getDirective, MapperKind, SchemaMapper} from '@graphql-tools/utils';

import {Directive} from "../decorators/directive.decorator";
import {BaseDirective} from "./base.directive";

const DIRECTIVE_NAME = 'upperCase';

@Directive(DIRECTIVE_NAME)
export class UpperCaseDirective extends BaseDirective {
    public definition() {
        return `directive @${DIRECTIVE_NAME} on FIELD_DEFINITION`;
    }

    public [MapperKind.OBJECT_FIELD]: FieldMapper = (
        fieldConfig,
        fieldName,
        typeName,
        schema
    ) => {
        const directive = getDirective(schema, fieldConfig, DIRECTIVE_NAME)?.[0];
        if (directive) {
            const {resolve} = fieldConfig;

            fieldConfig.resolve = async (
                source,
                args,
                context,
                info
            ) => {
                const result = await resolve(source, args, context, info);
                if (typeof result === 'string') {
                    return result.toUpperCase();
                }
                return result;
            }

            return fieldConfig;
        }
    }
}
