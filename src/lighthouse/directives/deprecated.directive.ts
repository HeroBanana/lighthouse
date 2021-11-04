import {EnumValueMapper, FieldMapper, getDirective, MapperKind, SchemaMapper} from '@graphql-tools/utils';

import {Directive} from "../decorators/directive.decorator";

import {BaseDirective} from './base.directive';

const DIRECTIVE_NAME = 'deprecated';

@Directive(DIRECTIVE_NAME)
export class DeprecatedDirective extends BaseDirective {
    public definition() {
        return `directive @${DIRECTIVE_NAME}(reason: String) on FIELD_DEFINITION | ENUM_VALUE`;
    }

    public [MapperKind.OBJECT_FIELD]: FieldMapper = (
        fieldConfig,
        fieldName,
        typeName,
        schema
    ) => {
        const deprecatedDirective = getDirective(schema, fieldConfig, DIRECTIVE_NAME)?.[0];
        if (deprecatedDirective) {
            fieldConfig.deprecationReason = deprecatedDirective['reason'];

            return fieldConfig;
        }
    }

    public [MapperKind.ENUM_VALUE]: EnumValueMapper = (
        valueConfig,
        typeName,
        schema
    ) => {
        const deprecatedDirective = getDirective(schema, valueConfig, DIRECTIVE_NAME)?.[0];
        if (deprecatedDirective) {
            valueConfig.deprecationReason = deprecatedDirective['reason'];

            return valueConfig;
        }
    }
}
