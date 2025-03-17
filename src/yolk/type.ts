import { Value } from "./value";

export class Type {
    constructor(public primitives: Set<Type.Primitive> = new Set()) {}
    hasPrimitive(primitive: Type.Primitive) {
        return this.primitives.has(primitive);
    }
    hasVoid() {
        return this.primitives.has(Type.Primitive.Void);
    }
    hasNull() {
        return this.primitives.has(Type.Primitive.Null);
    }
    compatible(value: Value): Value | undefined {
        // Auto-promote 'int' to 'float'
        switch (value.kind) {
            case Value.Kind.Null:
                if (this.hasPrimitive(Type.Primitive.Null)) {
                    return value;
                }
                break;
            case Value.Kind.Bool:
                if (this.hasPrimitive(Type.Primitive.Bool)) {
                    return value;
                }
                break;
            case Value.Kind.Int:
                if (this.hasPrimitive(Type.Primitive.Float)) {
                    return Value.fromFloat(value.asFloat());
                }
                if (this.hasPrimitive(Type.Primitive.Int)) {
                    return value;
                }
                break;
            case Value.Kind.Float:
                if (this.hasPrimitive(Type.Primitive.Float)) {
                    return value;
                }
                break;
            case Value.Kind.String:
                if (this.hasPrimitive(Type.Primitive.String)) {
                    return value;
                }
                break;
        }
        return undefined;
    }
    describe(): string {
        const joined = Array.from(this.primitives.values()).join("|");
        return joined || "unknown";
    }
}

export namespace Type {
    export enum Primitive {
        Void = "void",
        Null = "null",
        Bool = "bool",
        Int = "int",
        Float = "float",
        String = "string",
    }
    export const NONE = new Type(new Set());
    export const VOID = new Type(new Set([Type.Primitive.Void]));
    export const NULL = new Type(new Set([Type.Primitive.Null]));
    export const BOOL = new Type(new Set([Type.Primitive.Bool]));
    export const INT = new Type(new Set([Type.Primitive.Int]));
    export const FLOAT = new Type(new Set([Type.Primitive.Float]));
    export const STRING = new Type(new Set([Type.Primitive.String]));
}
