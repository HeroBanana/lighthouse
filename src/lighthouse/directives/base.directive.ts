import {Directive} from "../interfaces/directive.interface";

export abstract class BaseDirective implements Directive {
    public abstract definition(): string;
}
