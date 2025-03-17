import { assert } from "./assertion";
import { BaseException, ExceptionOrigin, ExceptionParameters } from "./exception";

export type ValueUnderlying = null | boolean | bigint | number | string;

function floatToString(value: number, sigfigs: number = 12): string {
    const parts = value.toPrecision(sigfigs).split("e");
    parts[0] = parts[0].replace(/0+$/, "").replace(/\.$/, ".0");
    return parts.join("e");
}
  
export class Value {
    private constructor(public underlying: ValueUnderlying, public readonly kind: Value.Kind) {}
    [Symbol.toPrimitive](hint_: string) {
        return this.underlying;
    }
    toString(): string {
        if (this.kind === Value.Kind.Float) {
            return floatToString(this.underlying as number);
        }
        return String(this.underlying);
    }
    isVoid(): boolean {
        return this.kind === Value.Kind.Void;
    }
    isNull(): boolean {
        return this.kind === Value.Kind.Null;
    }
    getBool(): boolean {
        assert.eq(this.kind, Value.Kind.Bool);
        return this.underlying as boolean;
    }
    getInt(): bigint {
        assert.eq(this.kind, Value.Kind.Int);
        return this.underlying as bigint;
    }
    getFloat(): number {
        assert.eq(this.kind, Value.Kind.Float);
        return this.underlying as number;
    }
    getString(): string {
        assert.eq(this.kind, Value.Kind.String);
        return this.underlying as string;
    }
    asFloat(): number {
        if (this.kind === Value.Kind.Float) {
            return this.underlying as number;
        }
        assert.eq(this.kind, Value.Kind.Int);
        return Number(this.underlying as bigint);
    }
    describe(): string {
        switch (this.kind) {
            case Value.Kind.Void:
                return "a value of type 'void'";
            case Value.Kind.Null:
                return "'null'";
            case Value.Kind.Bool:
                return this.underlying ? "'true'" : "'false'";
            case Value.Kind.Int:
                return "a value of type 'int'";
            case Value.Kind.Float:
                return "a value of type 'float'";
            case Value.Kind.String:
                return "a value of type 'string'";
            case Value.Kind.Object:
                return "a value of type 'object'";
        }
    }
    static fromVoid() {
        return new Value(null, Value.Kind.Void);
    }
    static fromNull() {
        return new Value(null, Value.Kind.Null);
    }
    static fromBool(value: boolean) {
        return new Value(Boolean(value), Value.Kind.Bool);
    }
    static fromInt(value: number | bigint) {
        return new Value(BigInt(value), Value.Kind.Int);
    }
    static fromFloat(value: number) {
        return new Value(Number(value), Value.Kind.Float);
    }
    static fromString(value: string) {
        return new Value(String(value), Value.Kind.String);
    }
}

export namespace Value {
    export class Exception extends BaseException {
        constructor(message: string, parameters?: ExceptionParameters) {
            super("ValueException", ExceptionOrigin.Runtime, message, parameters);
        }
    }
    export enum Kind {
        Void, Null, Bool, Int, Float, String, Object
    }
    export const VOID = Value.fromVoid();
    export const NULL = Value.fromNull();
    export const FALSE = Value.fromBool(false);
    export const TRUE = Value.fromBool(true);
}
