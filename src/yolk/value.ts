import { assert } from "./assertion";
import { inspect } from "util";

import { BaseException, ExceptionOrigin, ExceptionParameters } from "./exception";
import { Fallible } from "./fallible";

export type ValueUnderlying = null | Value.Bool | Value.Int | Value.Float | Value.Unicode | Value.Objekt;

export type Comparison = -1 | 0 | 1;

type BinaryInt = (lhs: bigint, rhs: bigint) => bigint;
type BinaryFloat = (lhs: number, rhs: number) => number;

function binaryArithmetic(lhs: Value, op: string, rhs: Value, bi: BinaryInt, bf: BinaryFloat): Fallible<Value> {
    switch (lhs.kind) {
        case Value.Kind.Int:
            switch (rhs.kind) {
                case Value.Kind.Int:
                    return Fallible.success(Value.fromInt(bi(lhs.asBigint(), rhs.asBigint())));
                case Value.Kind.Float:
                    return Fallible.success(Value.fromFloat(bf(lhs.asNumber(), rhs.asNumber())));
            }
            break;
        case Value.Kind.Float:
            switch (rhs.kind) {
                case Value.Kind.Int:
                    return Fallible.success(Value.fromFloat(bf(lhs.asNumber(), rhs.asNumber())));
                case Value.Kind.Float:
                    return Fallible.success(Value.fromFloat(bf(lhs.asNumber(), rhs.asNumber())));
            }
            break;
        default:
            return Fallible.failure(
                "Expected left-hand side of arithmetic operator '{op}' to be an 'int' or 'float', but instead got " + lhs.describe(),
                {lhs, op, rhs}
            );
    }
    return Fallible.failure(
        "Expected right-hand side of arithmetic operator '{op}' to be an 'int' or 'float', but instead got " + rhs.describe(),
        {lhs, op, rhs}
    );
}

function compareScalar<T>(lhs: T, rhs: T): Comparison {
    return (lhs < rhs) ? -1 : (lhs > rhs) ? +1 : 0;
}

type CompareInt = (lhs: bigint, rhs: bigint) => boolean;
type CompareFloat = (lhs: number, rhs: number) => boolean;

function compareArithmetic(lhs: Value, op: string, rhs: Value, ci: CompareInt, cf: CompareFloat): Fallible<Value> {
    switch (lhs.kind) {
        case Value.Kind.Int:
            switch (rhs.kind) {
                case Value.Kind.Int:
                    return Fallible.success(Value.fromBool(ci(lhs.asBigint(), rhs.asBigint())));
                case Value.Kind.Float:
                    return Fallible.success(Value.fromBool(cf(lhs.asNumber(), rhs.asNumber())));
            }
            break;
        case Value.Kind.Float:
            switch (rhs.kind) {
                case Value.Kind.Int:
                    return Fallible.success(Value.fromBool(cf(lhs.asNumber(), rhs.asNumber())));
                case Value.Kind.Float:
                    return Fallible.success(Value.fromBool(cf(lhs.asNumber(), rhs.asNumber())));
            }
            break;
        default:
            return Fallible.failure(
                "Expected left-hand side of comparison operator '{op}' to be an 'int' or 'float', but instead got " + lhs.describe(),
                {lhs, op, rhs}
            );
    }
    return Fallible.failure(
        "Expected right-hand side of comparison operator '{op}' to be an 'int' or 'float', but instead got " + rhs.describe(),
        {lhs, op, rhs}
    );
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
        if (this.kind === Value.Kind.Int && that.kind === Value.Kind.Float) {
            return this.asNumber() === this.asNumber();
        }
        if (this.kind === Value.Kind.Float && that.kind === Value.Kind.Int) {
            return this.asNumber() === this.asNumber();
        }
        return this.same(that);
    }
    same(that: Value): boolean {
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
                return compareScalar(this.asBoolean(), that.asBoolean());
            case Value.Kind.Int:
                return compareScalar(this.asBigint(), that.asBigint());
            case Value.Kind.Float:
                return compareScalar(this.asNumber(), that.asNumber());
            case Value.Kind.String:
                return compareScalar(this.asString(), that.asString());
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
    static binary(lhs: Value, op: string, rhs: Value): Fallible<Value>  {
        switch (op) {
            case "+":
                return binaryArithmetic(lhs, op, rhs, (a,b)=>a+b, (a,b)=>a+b);
            case "-":
                return binaryArithmetic(lhs, op, rhs, (a,b)=>a-b, (a,b)=>a-b);
            case "*":
                return binaryArithmetic(lhs, op, rhs, (a,b)=>a*b, (a,b)=>a*b);
            case "/":
                return binaryArithmetic(lhs, op, rhs, (a,b)=>a/b, (a,b)=>a/b);
            case "==":
                return Fallible.success(Value.fromBool(lhs.equals(rhs)));
            case "!=":
                return Fallible.success(Value.fromBool(!lhs.equals(rhs)));
            case "<":
                return compareArithmetic(lhs, op, rhs, (a,b)=>a<b, (a,b)=>a<b);
            case "<=":
                return compareArithmetic(lhs, op, rhs, (a,b)=>a<=b, (a,b)=>a<=b);
            case ">=":
                return compareArithmetic(lhs, op, rhs, (a,b)=>a>=b, (a,b)=>a>=b);
            case ">":
                return compareArithmetic(lhs, op, rhs, (a,b)=>a>b, (a,b)=>a>b);
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
