import { assert } from "./assertion";
import { BaseException, ExceptionOrigin, ExceptionParameters } from "./exception";

export type ValueUnderlying = null | Value.Bool | Value.Int | Value.Float | Value.String;

export class Value {
    private constructor(public underlying: ValueUnderlying, public readonly kind: Value.Kind) {}
    [Symbol.toPrimitive](hint_: string) {
        return this.underlying;
    }
    toString(): string {
        return String(this.underlying);
    }
    isVoid(): boolean {
        return this.kind === Value.Kind.Void;
    }
    isNull(): boolean {
        return this.kind === Value.Kind.Null;
    }
    getBool(): Value.Bool {
        assert.eq(this.kind, Value.Kind.Bool);
        return this.underlying as Value.Bool;
    }
    getInt(): Value.Int {
        assert.eq(this.kind, Value.Kind.Int);
        return this.underlying as Value.Int;
    }
    getFloat(): Value.Float {
        assert.eq(this.kind, Value.Kind.Float);
        return this.underlying as Value.Float;
    }
    getString(): Value.String {
        assert.eq(this.kind, Value.Kind.String);
        return this.underlying as Value.String;
    }
    asBoolean(): boolean {
        assert.eq(this.kind, Value.Kind.Bool);
        return this.getBool().underlying;
    }
    asBigint(): bigint {
        if (this.kind === Value.Kind.Float) {
            return BigInt(this.getFloat().underlying);
        }
        return this.getInt().underlying;
    }
    asNumber(): number {
        if (this.kind === Value.Kind.Float) {
            return this.getFloat().underlying;
        }
        return Number(this.getInt().underlying);
    }
    describe(): string {
        switch (this.kind) {
            case Value.Kind.Void:
                return "a value of type 'void'";
            case Value.Kind.Null:
                return "'null'";
            case Value.Kind.Bool:
                return this.asBoolean() ? "'true'" : "'false'";
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
    static fromBool(value: Value.Bool | boolean) {
        if (typeof value === "boolean") {
            value = new Value.Bool(value);
        }
        return new Value(value, Value.Kind.Bool);
    }
    static fromInt(value: Value.Int | bigint) {
        if (typeof value === "bigint") {
            value = new Value.Int(value);
        }
        return new Value(value, Value.Kind.Int);
    }
    static fromFloat(value: Value.Float | number) {
        if (typeof value === "number") {
            value = new Value.Float(value);
        }
        return new Value(value, Value.Kind.Float);
    }
    static fromString(value: Value.String | string) {
        if (typeof value === "string") {
            const unicode = Uint32Array.from([...value].map(ch => ch.codePointAt(0)));
            value = new Value.String(unicode);
        }
        return new Value(value, Value.Kind.String);
    }
}

function unicodeStringAt(codepoints: Uint32Array, index: number) {
    return String.fromCodePoint(codepoints[index]);
}

function unicodeStringAll(codepoints: Uint32Array) {
    return String.fromCodePoint(...codepoints);
}

export namespace Value {
    export class Bool {
        constructor(public underlying: boolean) {}
        toString() {
            return this.underlying ? "true" : "false";
        }
    }
    export class Int {
        constructor(public underlying: bigint) {}
        toString() {
            return this.underlying.toString();
        }
    }
    export class Float {
        constructor(public underlying: number) {}
        static format(value: number, sigfigs: number = 12): string {
            const parts = value.toPrecision(sigfigs).split("e");
            parts[0] = parts[0].replace(/0+$/, "").replace(/\.$/, ".0");
            return parts.join("e");
        }
        toString() {
            return Float.format(this.underlying);
        }
    }
    export class String {
        constructor(public underlying: Uint32Array) {}
        at(index: bigint): string {
            if (index < 0 || index >= this.length) {
                return "";
            }
            return unicodeStringAt(this.underlying, Number(index));
        }
        get length(): bigint {
            return BigInt(this.underlying.length);
        }
        toString() {
            return unicodeStringAll(this.underlying);
        }
    }
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
