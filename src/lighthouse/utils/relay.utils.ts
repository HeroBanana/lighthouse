import {ConnectionArguments, connectionFromArraySlice, cursorToOffset} from "graphql-relay";
import {FindManyOptions, Repository} from "typeorm";

export function connectionGetPagingMeta(args: ConnectionArguments) {
    const {first = 0, last = 0, after, before} = args;
    const isForwardPaging = !!first || !!after;
    const isBackwardPaging = !!last || !!before;

    if (isForwardPaging) {
        return {
            pagingType: 'forward',
            after,
            first
        };
    }

    if (isBackwardPaging) {
        return {
            pagingType: 'backward',
            before,
            last
        };
    }

    return {
        pagingType: 'none'
    };
}

export function connectionGetPagingParameters(args: ConnectionArguments) {
    const meta = connectionGetPagingMeta(args);

    if (meta.pagingType === 'forward') {
        return {
            limit: meta.first,
            offset: meta.after ? cursorToOffset(meta.after) + 1 : 0,
        };
    }

    if (meta.pagingType === 'backward') {
        const {last, before} = meta;
        let limit = last;
        let offset = cursorToOffset(before!) - last;

        if (offset < 0) {
            limit = Math.max(last + offset, 0);
            offset = 0;
        }

        return {offset, limit};
    }

    return {};
}

export async function connectionFindAndPaginate<T>(
    condition: FindManyOptions<T>,
    args: ConnectionArguments,
    repository: Repository<T>,
    options: {
        defaultCount?: number,
        maxCount?: number,
    }) {
    const defaultLimit = options?.maxCount ?? options.defaultCount ?? 25;

    if (args.last) {
        args.last = Math.min(Math.max(args.last, 0), defaultLimit);
    } else if (args.first) {
        args.first =  Math.min(Math.max(args.first, 0), defaultLimit);
    }

    const params = connectionGetPagingParameters(args);

    const offset = params?.offset || 0;
    const limit = params?.limit || 0;

    const [items, count] = await repository.findAndCount({
        ...condition,
        skip: offset,
        take: limit,
    });

    return connectionFromArraySlice(items, args, {
        arrayLength: count,
        sliceStart: offset,
    });
}
