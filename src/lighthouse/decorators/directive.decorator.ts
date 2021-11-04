export const Directive = (name: string): ClassDecorator => {
    return (target) => {
        Reflect.defineMetadata("@lighthouse/directive", {
            name: name || target.name,
            target,
        }, target);
    };
}
