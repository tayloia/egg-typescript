import { assert } from "./assertion";
import { inspect } from "util";

import { BaseException, ExceptionOrigin, ExceptionParameters } from "./exception";

export type ValueUnderlying = null | Value.Bool | Value.Int | Value.Float | Value.Unicode | Value.Objekt;

export type Comparison = -1 | 0 | 1;

function scalarCompare<T>(lhs: T, rhs: T): Comparison {
    return (lhs < rhs) ? -1 : (lhs > rhs) ? +1 : 0;
}

export class Value {
    private constructor(public underlying: ValueUnderlying, public readonly kind: Value.Kind) {}
    [inspect.custom](depth_: unknown, options_: unknown, inspect_: unknown) {
        switch (this.kind) {
            case Value.Kind.Void:
                return "void";
            case Value.Kind.Null:
                return "null";
            case Value.Kind.Bool:
                return this.asBoolean() ? "true" : "false";
            case Value.Kind.Int:
                return this.asBigint().toString();
            case Value.Kind.Float:
                return this.asNumber().toString();
            case Value.Kind.String:
                return JSON.stringify(this.asString());
            case Value.Kind.Object:
                return "<object>";
        }
    }
    toString() {
        return this.underlying?.toString();
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
    getUnicode(): Value.Unicode {
        assert.eq(this.kind, Value.Kind.String);
        return this.underlying as Value.Unicode;
    }
    getObject(): Value.Objekt {
        assert.eq(this.kind, Value.Kind.Object);
        return this.underlying as Value.Objekt;
    }
    asBoolean(): boolean {
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
    asString(): string {
        return this.getUnicode().toString();
    }
    describe(): string {
        switch (this.kind) {
            case Value.Kind.Void:
                return "a value of type 'void'";
            case Value.Kind.Null:
                return "'null'";
            case Value.Kind.Bool:
                return this.getBool().underlying ? "'true'" : "'false'";
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
    equals(that: Value): boolean {
        switch (this.kind) {
            case Value.Kind.Void:
                return that.kind == Value.Kind.Void;
            case Value.Kind.Null:
                return that.kind == Value.Kind.Null;
            case Value.Kind.Bool:
                return that.kind == Value.Kind.Bool && this.getBool().underlying === that.getBool().underlying;
            case Value.Kind.Int:
                return that.kind == Value.Kind.Int && this.getInt().underlying === that.getInt().underlying;
            case Value.Kind.Float:
                return that.kind == Value.Kind.Float && this.getFloat().underlying === that.getFloat().underlying;
            case Value.Kind.String:
                return that.kind == Value.Kind.String && this.getUnicode().toString() === that.getUnicode().toString();
            case Value.Kind.Object:
                return that.kind == Value.Kind.Object && this.getObject().underlying === that.getObject().underlying;
        }
    }
    compare(that: Value): Comparison {
        if (this.kind !== that.kind) {
            return (this.kind < that.kind) ? -1 : +1;
        }
        switch (this.kind) {
            case Value.Kind.Void:
            case Value.Kind.Null:
                return 0;
            case Value.Kind.Bool:
                return scalarCompare(this.asBoolean(), that.asBoolean());
            case Value.Kind.Int:
                return scalarCompare(this.asBigint(), that.asBigint());
            case Value.Kind.Float:
                return scalarCompare(this.asNumber(), that.asNumber());
            case Value.Kind.String:
                return scalarCompare(this.asString(), that.asString());
            case Value.Kind.Object:
                assert.fail("Cannot compare object instances");
        }
    }
    mutate(op: string, lazy_: () => Value): Value | Value.Exception {
        switch (op) {
            case "++":
                if (this.kind !== Value.Kind.Int) {
                    return new Value.Exception("Operator '++' can only be applied to values of type 'int'");
                }
                return Value.fromInt(this.getInt().underlying++);
            case "--":
                if (this.kind !== Value.Kind.Int) {
                    return new Value.Exception("Operator '--' can only be applied to values of type 'int'");
                }
                return Value.fromInt(this.getInt().underlying--);
        }
        assert.fail("Unknown mutating operator: '{op}'", {op, caller:this.mutate});
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
    static fromString(value: Value.Unicode | string) {
        if (typeof value === "string") {
            const unicode = Uint32Array.from([...value].map(ch => ch.codePointAt(0)));
            value = new Value.Unicode(unicode);
        }
        return new Value(value, Value.Kind.String);
    }
    static binary(lhs: Value, op: string, rhs: Value): Value {
        switch (op) {
            case "+":
                if (lhs.kind === Value.Kind.Float || rhs.kind === Value.Kind.Float) {
                    return Value.fromFloat(lhs.asNumber() + rhs.asNumber());
                }
                return Value.fromInt(lhs.asBigint() + rhs.asBigint());
            case "-":
                if (lhs.kind === Value.Kind.Float || rhs.kind === Value.Kind.Float) {
                    return Value.fromFloat(lhs.asNumber() - rhs.asNumber());
                }
                return Value.fromInt(lhs.asBigint() - rhs.asBigint());
            case "*":
                if (lhs.kind === Value.Kind.Float || rhs.kind === Value.Kind.Float) {
                    return Value.fromFloat(lhs.asNumber() * rhs.asNumber());
                }
                return Value.fromInt(lhs.asBigint() * rhs.asBigint());
            case "/":
                if (lhs.kind === Value.Kind.Float || rhs.kind === Value.Kind.Float) {
                    return Value.fromFloat(lhs.asNumber() / rhs.asNumber());
                }
                return Value.fromInt(lhs.asBigint() / rhs.asBigint());
            case "==":
                return Value.fromBool(lhs.equals(rhs));
            case "!=":
                return Value.fromBool(!lhs.equals(rhs));
            case "<":
                return Value.fromBool(lhs.compare(rhs) < 0);
            case "<=":
                return Value.fromBool(lhs.compare(rhs) <= 0);
            case ">=":
                return Value.fromBool(lhs.compare(rhs) >= 0);
            case ">":
                return Value.fromBool(lhs.compare(rhs) > 0);
            }
        assert.fail("Unknown binary operator: '{op}'", {op, caller:Value.binary});
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
    export class Unicode {
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
    export class Objekt {
        constructor(public underlying: object) {}
        toString() {
            return this.underlying.toString();
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
