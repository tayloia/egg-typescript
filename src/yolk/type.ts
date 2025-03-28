import { assert } from "./assertion";
import { FormatOptions, IFormattable } from "./format";
import { Value } from "./value";

export class Type implements IFormattable {
    private constructor(private primitives: Set<Type.Primitive>, private shapes: Set<Type.Shape>) {}
    isEmpty() {
        return this.primitives.size === 0 && this.shapes.size === 0;
    }
    hasOnly(primitive: Type.Primitive) {
        return this.primitives.size === 1 && this.primitives.has(primitive) && this.shapes.size === 0;
    }
    hasPrimitive(primitive: Type.Primitive) {
        return this.primitives.has(primitive);
    }
    addPrimitive(primitive: Type.Primitive): Type {
        if (this.hasPrimitive(primitive)) {
            return this;
        }
        return new Type(new Set(this.primitives).add(primitive), new Set(this.shapes));
    }
    removePrimitive(primitive: Type.Primitive): Type {
        if (!this.hasPrimitive(primitive)) {
            return this;
        }
        const set = new Set(this.primitives);
        set.delete(primitive);
        return new Type(set, new Set(this.shapes));
    }
    getCallables(): Type.Callable[] {
        // TODO
        if (this.hasPrimitive(Type.Primitive.Object)) {
            return [new Type.Callable(Type.ANYQ)];
        }
        return [...this.shapes].map(shape => shape.callable).filter(callable => callable !== undefined);
    }
    getIterables(): Type.Iterable[] {
        // TODO
        if (this.hasPrimitive(Type.Primitive.Object)) {
            return [new Type.Iterable(Type.ANYQ)];
        }
        if (this.hasPrimitive(Type.Primitive.String)) {
            return [new Type.Iterable(Type.STRING)];
        }
        return [...this.shapes].map(shape => shape.iterable).filter(iterable => iterable !== undefined);
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
        return new Type(intersection, new Set(this.shapes));
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
                if (this.hasPrimitive(Type.Primitive.Object) || this.shapes.size > 0) {
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
    static fromPrimitives(...primitives: Type.Primitive[]): Type {
        return new Type(new Set(primitives), new Set());
    }
    static fromShape(shape: Type.Shape): Type {
        return new Type(new Set(), new Set([shape]));
    }
    describeValue(): string {
        return `a value of type '${this.format()}'`;
    }
    format(options?: FormatOptions): string {
        if (this.hasOnly(Type.Primitive.Null)) {
            return "null";
        }
        const head = [...this.primitives].filter(x => x !== Type.Primitive.Null).join("|").replace("bool|int|float|string|object", "any");
        const tail = this.hasPrimitive(Type.Primitive.Null) ? "?" : "";
        if (this.shapes.size === 0) {
            if (head === "") {
                return "empty";
            }
            return head + tail;
        }
        if (this.shapes.size === 1) {
            if (head === "") {
                return [...this.shapes][0].format(options) + tail;
            }
        }
        if (head === "") {
            return [...this.shapes].map(x => `(${x.format()})`).join("|") + tail;
        }
        return head + "|" + [...this.shapes].map(x => `(${x.format()})`).join("|") + tail;
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
    export abstract class Shape implements IFormattable {
        callable?: Callable;
        iterable?: Iterable;
        abstract format(options?: FormatOptions): string;
    }
    export const EMPTY = Type.fromPrimitives();
    export const VOID = Type.fromPrimitives(Type.Primitive.Void);
    export const NULL = Type.fromPrimitives(Type.Primitive.Null);
    export const BOOL = Type.fromPrimitives(Type.Primitive.Bool);
    export const INT = Type.fromPrimitives(Type.Primitive.Int);
    export const FLOAT = Type.fromPrimitives(Type.Primitive.Float);
    export const STRING = Type.fromPrimitives(Type.Primitive.String);
    export const OBJECT = Type.fromPrimitives(Type.Primitive.Object);
    export const ANY = Type.fromPrimitives(Type.Primitive.Bool, Type.Primitive.Int, Type.Primitive.Float, Type.Primitive.String, Type.Primitive.Object);
    export const ANYQ = Type.fromPrimitives(Type.Primitive.Null, Type.Primitive.Bool, Type.Primitive.Int, Type.Primitive.Float, Type.Primitive.String, Type.Primitive.Object);
}
