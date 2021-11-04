import type {NamedTypeNode, ASTNode} from "graphql";

export const getUnderlyingTypeName = function (node: ASTNode): string {
    const namedType = getUnderlyingNamedTypeNode(node);

    return namedType.name.value;
};

export const getUnderlyingNamedTypeNode = function (node: ASTNode): NamedTypeNode {
    if (node.kind === "NamedType") {
        return node;
    }

    if (
        ["NonNullType", "ListType", "FieldDefinition", "InputValueDefinition"].includes(node.kind) &&
        "type" in node
    ) {
        return getUnderlyingNamedTypeNode(node.type);
    }

    throw new Error(`The node '${node.kind}' does not have a type associated with it.`);
};
