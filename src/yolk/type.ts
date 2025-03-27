import assert from "assert";
import { Value } from "./value";

export class Type {
    constructor(public primitives: Set<Type.Primitive> = new Set(), public shapes: Set<Type.Shape> = new Set()) {}
    isEmpty() {
        return this.primitives.size === 0;
    }
    hasOnly(primitive: Type.Primitive) {
        return this.primitives.size === 1 && this.primitives.has(primitive);
    }
    hasPrimitive(primitive: Type.Primitive) {
        return this.primitives.has(primitive);
    }
    hasVoid() {
        return this.primitives.has(Type.Primitive.Void);
    }
    hasNull() {
        return this.primitives.has(Type.Primitive.Null);
    }
    addPrimitive(primitive: Type.Primitive): Type {
        if (this.hasPrimitive(primitive)) {
            return this;
        }
        return new Type(new Set(this.primitives).add(primitive));
    }
    removePrimitive(primitive: Type.Primitive): Type {
        if (!this.hasPrimitive(primitive)) {
            return this;
        }
        const set = new Set(this.primitives);
        set.delete(primitive);
        return new Type(set);
    }
    getCallables(): Type.Callable[] {
        // TODO
        if (this.hasPrimitive(Type.Primitive.Object)) {
            return [new Type.Callable(Type.ANYQ)];
        }
        return [];
    }
    getIterables(): Type.Iterable[] {
        // TODO
        if (this.hasPrimitive(Type.Primitive.Object)) {
            return [new Type.Iterable(Type.ANYQ)];
        }
        if (this.hasPrimitive(Type.Primitive.String)) {
            return [new Type.Iterable(Type.STRING)];
        }
        return [];
    }
    compatibleType(that: Type): Type {
        assert(!this.isEmpty());
        assert(!that.isEmpty());
        const intersection = new Set<Type.Primitive>();
        for (const primitive of that.primitives) {
            // Auto-promote 'int' to 'float'
            if (this.hasPrimitive(primitive)) {
                intersection.add(primitive);
            } else if (primitive === Type.Primitive.Int && this.hasPrimitive(Type.Primitive.Float)) {
                intersection.add(Type.Primitive.Float);
            }
        }
        return new Type(intersection);
    }
    compatibleValue(value: Value): Value {
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
                if (this.hasPrimitive(Type.Primitive.Int)) {
                    return value;
                }
                if (this.hasPrimitive(Type.Primitive.Float)) {
                    return Value.fromFloat(value.asNumber());
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
            case Value.Kind.Proxy:
                // TODO
                if (this.hasPrimitive(Type.Primitive.Object)) {
                    return value;
                }
                break;
        }
        return Value.VOID;
    }
    static binary(ltype_: Type, op_: string, rtype_: Type): Type {
        // TODO
        return Type.INT;
    }
    static union(...types: Type[]): Type {
        assert(types.length === 1); // TODO
        return types[0];
    }
    describe(): string {
        return `a value of type '${this}'`;
    }
    toString(): string {
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
        Object = "object",
    }
    export class Callable {
        public constructor(public readonly rettype: Type) {}
    }
    export class Iterable {
        public constructor(public readonly elementtype: Type) {}
    }
    export class Shape {
        public constructor() {}
        callable?: Callable;
        iterable?: Iterable;
    }
    export const EMPTY = new Type(new Set());
    export const VOID = new Type(new Set([Type.Primitive.Void]));
    export const NULL = new Type(new Set([Type.Primitive.Null]));
    export const BOOL = new Type(new Set([Type.Primitive.Bool]));
    export const INT = new Type(new Set([Type.Primitive.Int]));
    export const FLOAT = new Type(new Set([Type.Primitive.Float]));
    export const STRING = new Type(new Set([Type.Primitive.String]));
    export const OBJECT = new Type(new Set([Type.Primitive.Object]));
    export const ANY = new Type(new Set([Type.Primitive.Bool, Type.Primitive.Int, Type.Primitive.Float, Type.Primitive.String, Type.Primitive.Object]));
    export const ANYQ = new Type(new Set([Type.Primitive.Null, Type.Primitive.Bool, Type.Primitive.Int, Type.Primitive.Float, Type.Primitive.String, Type.Primitive.Object]));
}
