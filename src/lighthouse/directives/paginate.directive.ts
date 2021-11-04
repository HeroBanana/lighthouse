import {FieldMapper, getDirective, MapperKind} from '@graphql-tools/utils';
import {
    FieldDefinitionNode,
    GraphQLArgumentConfig,
    GraphQLBoolean,
    GraphQLInt,
    GraphQLList,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLOutputType,
    GraphQLSchema,
    GraphQLString
} from "graphql";

import {Connection} from 'typeorm';

import {connectionFindAndPaginate} from '../utils/relay.utils';
import {getUnderlyingTypeName} from "../utils/ast.utils";

import {Directive} from "../decorators/directive.decorator";
import {BaseDirective} from "./base.directive";

enum PaginationType {
    Paginator = "PAGINATOR",
    Simple = "SIMPLE",
    Connection = "CONNECTION"
}

const DIRECTIVE_NAME = 'paginate';

@Directive(DIRECTIVE_NAME)
export class PaginateDirective extends BaseDirective {
    public constructor(
        private connection: Connection
    ) {
        super();
    }

    public definition() {
        return `
"""
Query multiple model entries as a paginated list.
"""
directive @paginate(
  """
  Which pagination style should be used.
  """
  type: PaginateType = PAGINATOR

  """
  Specify the class name of the model to use.
  This is only needed when the default model detection does not work.
  """
  model: String

  """
  Point to a function that provides a Query Builder instance.
  This replaces the use of a model.
  """
  builder: String

  """
  Apply scopes to the underlying query.
  """
  scopes: [String!]

  """
  Allow clients to query paginated lists without specifying the amount of items.
  Overrules the \`pagination.default_count\` setting from \`lighthouse.php\`.
  """
  defaultCount: Int

  """
  Limit the maximum amount of items that clients can request from paginated lists.
  Overrules the \`pagination.max_count\` setting from \`lighthouse.php\`.
  """
  maxCount: Int
) on FIELD_DEFINITION

"""
Options for the \`type\` argument of \`@paginate\`.
"""
enum PaginateType {
  """
  Offset-based pagination, similar to the Laravel default.
  """
  PAGINATOR

  """
  Offset-based pagination like the Laravel "Simple Pagination", which does not count the total number of records.
  """
  SIMPLE

  """
  Cursor-based pagination, compatible with the Relay specification.
  """
  CONNECTION
}
        `;
    }

    private registerConnection(
        schema: GraphQLSchema,
        fieldDefinition: FieldDefinitionNode,
    ) {
        const fieldTypeName = getUnderlyingTypeName(fieldDefinition.type);
        const fieldType = schema.getType(fieldTypeName);

        const connectionTypeName = `${fieldTypeName}Connection`;
        const edgeTypeName = `${fieldTypeName}Edge`;

        const paginatorInfoType = new GraphQLObjectType({
            name: "PageInfo",
            description: "Pagination information about the corresponding list of items.",
            fields: {
                hasNextPage: {
                    description: "When paginating forwards, are there more items?",
                    type: new GraphQLNonNull(GraphQLBoolean),
                },
                hasPreviousPage: {
                    description: "When paginating backwards, are there more items?",
                    type: new GraphQLNonNull(GraphQLBoolean),
                },
                startCursor: {
                    description: "When paginating backwards, the cursor to continue.",
                    type: GraphQLString,
                },
                endCursor: {
                    description: "When paginating forwards, the cursor to continue.",
                    type: GraphQLString,
                },
                // TODO support these fields, add more flexibility to relay connection.
                // total: {
                //     description: "Total number of node in connection.",
                //     type: GraphQLInt,
                // },
                // count: {
                //     description: "Count of nodes in current request.",
                //     type: GraphQLInt,
                // },
                // currentPage: {
                //     description: "Current page of request.",
                //     type: GraphQLInt,
                // },
                // lastPage: {
                //     description: "Last page in connection.",
                //     type: GraphQLInt,
                // }
            }
        });

        const edgeType = new GraphQLObjectType({
            name: edgeTypeName,
            description: `An edge that contains a node of type ${fieldTypeName} and a cursor.`,
            fields: {
                cursor: {
                    description: `A unique cursor that can be used for pagination.`,
                    type: GraphQLString,
                },
                node: {
                    description: `The ${fieldTypeName} node.`,
                    type: fieldType as GraphQLOutputType,
                },
            }
        });

        const connectionType = new GraphQLObjectType({
            name: connectionTypeName,
            description: `A paginated list of ${fieldTypeName} edges.`,
            fields: {
                pageInfo: {
                    description: "Pagination information about the list of edges.",
                    type: paginatorInfoType
                },
                edges: {
                    description: `A list of ${fieldTypeName} edges.`,
                    type: GraphQLList(edgeType)
                }
            }
        });

        return connectionType;
    }

    private registerSimplePaginator(
        schema: GraphQLSchema,
        fieldDefinition: FieldDefinitionNode,
    ) {
        const fieldTypeName = getUnderlyingTypeName(fieldDefinition.type);
        const fieldType = schema.getType(fieldTypeName);

        const paginatorTypeName = `${fieldTypeName}SimplePaginator`;

        const paginatorInfoType = new GraphQLObjectType({
            name: "SimplePaginatorInfo",
            description: "Pagination information about the corresponding list of items.",
            fields: {
                count: {
                    description: "Count of available items in the page.",
                    type: new GraphQLNonNull(GraphQLInt),
                },
                currentPage: {
                    description: "Current pagination page.",
                    type: new GraphQLNonNull(GraphQLInt),
                },
                firstItem: {
                    description: "Index of first item in the current page.",
                    type: GraphQLInt,
                },
                lastItem: {
                    description: "Index of last item in the current page.",
                    type: GraphQLInt,
                },
                perPage: {
                    description: "Number of items per page in the collection.",
                    type: new GraphQLNonNull(GraphQLInt),
                }
            }
        });

        return new GraphQLObjectType({
            name: paginatorTypeName,
            description: `A paginated list of ${fieldTypeName} items.`,
            fields: {
                paginatorInfo: {
                    description: `Pagination information about the list of items.`,
                    type: paginatorInfoType,
                },
                data: {
                    description: `A list of ${fieldTypeName} items.`,
                    type: new GraphQLList(fieldType as GraphQLOutputType),
                },
            }
        });
    }

    private registerPaginator(
        schema: GraphQLSchema,
        fieldDefinition: FieldDefinitionNode,
    ) {
        const fieldTypeName = getUnderlyingTypeName(fieldDefinition.type);
        const fieldType = schema.getType(fieldTypeName);

        const paginatorTypeName = `${fieldTypeName}Paginator`;

        const paginatorInfoType = new GraphQLObjectType({
            name: "PaginatorInfo",
            description: "Pagination information about the corresponding list of items.",
            fields: {
                count: {
                    description: "Count of available items in the page.",
                    type: new GraphQLNonNull(GraphQLInt),
                },
                currentPage: {
                    description: "Current pagination page.",
                    type: new GraphQLNonNull(GraphQLInt),
                },
                firstItem: {
                    description: "Index of first item in the current page.",
                    type: GraphQLInt,
                },
                hasMorePages: {
                    description: "If collection has more pages.",
                    type: new GraphQLNonNull(GraphQLBoolean),
                },
                lastItem: {
                    description: "Index of last item in the current page.",
                    type: GraphQLInt,
                },
                lastPage: {
                    description: "Last page number of the collection.",
                    type: new GraphQLNonNull(GraphQLInt),
                },
                perPage: {
                    description: "Number of items per page in the collection.",
                    type: new GraphQLNonNull(GraphQLInt),
                },
                total: {
                    description: "Total items available in the collection.",
                    type: new GraphQLNonNull(GraphQLInt),
                },
            }
        });

        return new GraphQLObjectType({
            name: paginatorTypeName,
            description: `A paginated list of ${fieldTypeName} items.`,
            fields: {
                paginatorInfo: {
                    description: `Pagination information about the list of items.`,
                    type: paginatorInfoType,
                },
                data: {
                    description: `A list of ${fieldTypeName} items.`,
                    type: new GraphQLList(fieldType as GraphQLOutputType),
                },
            }
        });
    }

    private transformToPaginatedArgs(
        paginationType: PaginationType,
        defaultCount?: number,
        maxCount?: number,
    ): Record<string, GraphQLArgumentConfig> {
        const args: Record<string, GraphQLArgumentConfig> = {};

        if (paginationType === PaginationType.Connection) {
            args.after = {
                description: "A cursor after which elements are returned.",
                type: GraphQLString,
            }
        } else if (
            paginationType === PaginationType.Simple ||
            paginationType === PaginationType.Paginator
        ) {
            args.page = {
                description: "The offset from which elements are returned.",
                type: GraphQLInt,
            }
        }

        args.first = {
            description: maxCount ? `Maximum allowed value: ${maxCount}` : 'Limits number of fetched elements.',
            type: defaultCount ? GraphQLInt : new GraphQLNonNull(GraphQLInt),
        }

        if (defaultCount) {
            args.first.defaultValue = defaultCount;
        }

        return args;
    }

    private transformToPaginatedField(
        schema: GraphQLSchema,
        paginationType: PaginationType,
        fieldDefinition: FieldDefinitionNode,
    ) {
        switch (paginationType) {
            case PaginationType.Connection:
                return this.registerConnection(schema, fieldDefinition);
            case PaginationType.Paginator:
                return this.registerPaginator(schema, fieldDefinition);
            case PaginationType.Simple:
                return this.registerSimplePaginator(schema, fieldDefinition);
            default:
                throw new Error(`Unknown '${paginationType}' pagination type found.`);
        }
    }

    public [MapperKind.OBJECT_FIELD]: FieldMapper = (
        fieldConfig,
        fieldName,
        typeName,
        schema
    ) => {
        const directive = getDirective(schema, fieldConfig, DIRECTIVE_NAME)?.[0];
        if (directive) {
            const {resolve, astNode} = fieldConfig;

            const paginationType = directive.type || PaginationType.Paginator;
            const model = directive.model || getUnderlyingTypeName(astNode.type);
            const defaultCount = directive.defaultCount;
            const maxCount = directive.maxCount;

            // Transform args type.
            fieldConfig.args = this.transformToPaginatedArgs(
                paginationType,
                defaultCount,
                maxCount,
            );

            // Transform field type.
            fieldConfig.type = this.transformToPaginatedField(
                schema,
                paginationType,
                astNode,
            ) as GraphQLOutputType;

            // Create custom pagination resolver.
            fieldConfig.resolve = async (
                source,
                args,
                context,
                info
            ) => {
                const repository = this.connection.getRepository(model);

                switch (paginationType) {
                    case PaginationType.Paginator:
                    case PaginationType.Simple:
                        return {
                            paginatorInfo: null,
                            items: [],
                        };
                    case PaginationType.Connection:
                        return connectionFindAndPaginate({}, args, repository, {
                            defaultCount,
                            maxCount,
                        });
                }
            }

            return fieldConfig;
        }
    }
}
