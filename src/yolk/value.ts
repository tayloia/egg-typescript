import { inspect } from "util";

import { assert } from "./assertion";
import { RuntimeException } from "./exception";
import { ProxyRuntimeException, ProxyVanillaArray, ProxyVanillaFunction, ProxyVanillaObject } from "./proxy";
import { Program } from "./program";
import { ValueMap } from "./valuemap";
import { FunctionArguments, FunctionDefinition } from "./function";

export type ValueUnderlying = null | Value.Bool | Value.Int | Value.Float | Value.Unicode | Value.IProxy;

export type Comparison = -1 | 0 | 1;

export function compareScalar<T>(lhs: T, rhs: T): Comparison {
    return (lhs < rhs) ? -1 : (lhs > rhs) ? +1 : 0;
}

type BinaryInt = (lhs: bigint, rhs: bigint) => bigint;
type BinaryFloat = (lhs: number, rhs: number) => number;

function binaryArithmetic(lhs: Value, op: string, rhs: Value, bi: BinaryInt, bf: BinaryFloat): Value {
    switch (lhs.kind) {
        case Value.Kind.Int:
            switch (rhs.kind) {
                case Value.Kind.Int:
                    return Value.fromInt(bi(lhs.asBigint(), rhs.asBigint()));
                case Value.Kind.Float:
                    return Value.fromFloat(bf(lhs.asNumber(), rhs.asNumber()));
            }
            break;
        case Value.Kind.Float:
            switch (rhs.kind) {
                case Value.Kind.Int:
                    return Value.fromFloat(bf(lhs.asNumber(), rhs.asNumber()));
                case Value.Kind.Float:
                    return Value.fromFloat(bf(lhs.asNumber(), rhs.asNumber()));
            }
            break;
        default:
            throw new RuntimeException(
                "Expected left-hand side of arithmetic operator '{op}' to be an 'int' or 'float', but instead got " + lhs.describe(),
                {lhs, op, rhs}
            );
    }
    throw new RuntimeException(
        "Expected right-hand side of arithmetic operator '{op}' to be an 'int' or 'float', but instead got " + rhs.describe(),
        {lhs, op, rhs}
    );
}

type CompareInt = (lhs: bigint, rhs: bigint) => boolean;
type CompareFloat = (lhs: number, rhs: number) => boolean;

function compareArithmetic(lhs: Value, op: string, rhs: Value, ci: CompareInt, cf: CompareFloat): Value {
    switch (lhs.kind) {
        case Value.Kind.Int:
            switch (rhs.kind) {
                case Value.Kind.Int:
                    return Value.fromBool(ci(lhs.asBigint(), rhs.asBigint()));
                case Value.Kind.Float:
                    return Value.fromBool(cf(lhs.asNumber(), rhs.asNumber()));
            }
            break;
        case Value.Kind.Float:
            switch (rhs.kind) {
                case Value.Kind.Int:
                    return Value.fromBool(cf(lhs.asNumber(), rhs.asNumber()));
                case Value.Kind.Float:
                    return Value.fromBool(cf(lhs.asNumber(), rhs.asNumber()));
            }
            break;
        default:
            throw new RuntimeException(
                "Expected left-hand side of comparison operator '{op}' to be an 'int' or 'float', but instead got " + lhs.describe(),
                {lhs, op, rhs}
            );
    }
    throw new RuntimeException(
        "Expected right-hand side of comparison operator '{op}' to be an 'int' or 'float', but instead got " + rhs.describe(),
        {lhs, op, rhs}
    );
}

export class ToStringOptions {
    quoteString?: string;
}

export class Value {
    private constructor(private underlying: ValueUnderlying, private _kind: Value.Kind) {}
    get kind() {
        return this._kind;
    }
    toString(options?: ToStringOptions) {
        if (this.underlying !== null) {
            return this.underlying.toString(options);
        }
        switch (this.kind) {
            case Value.Kind.Void:
                return "void";
            case Value.Kind.Null:
                return "null";
        }
        assert.fail("Cannot convert value to string: " + JSON.stringify(this));
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
    getProxy(): Value.IProxy {
        assert.eq(this.kind, Value.Kind.Proxy);
        return this.underlying as Value.IProxy;
    }
    asBoolean(): boolean {
        return this.getBool().toBoolean();
    }
    asBigint(): bigint {
        if (this.kind === Value.Kind.Float) {
            return this.getFloat().toBigint();
        }
        return this.getInt().toBigint();
    }
    asNumber(): number {
        if (this.kind === Value.Kind.Float) {
            return this.getFloat().toNumber();
        }
        return this.getInt().toNumber();
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
                return this.asBoolean() ? "'true'" : "'false'";
            case Value.Kind.Int:
                return "a value of type 'int'";
            case Value.Kind.Float:
                return "a value of type 'float'";
            case Value.Kind.String:
                return "a value of type 'string'";
            case Value.Kind.Proxy:
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
                return that.kind == Value.Kind.Bool && this.asBoolean() === that.asBoolean();
            case Value.Kind.Int:
                return that.kind == Value.Kind.Int && this.getInt().toBigint() === that.getInt().toBigint();
            case Value.Kind.Float:
                return that.kind == Value.Kind.Float && this.getFloat().toNumber() === that.getFloat().toNumber();
            case Value.Kind.String:
                return that.kind == Value.Kind.String && this.getUnicode().toString() === that.getUnicode().toString();
            case Value.Kind.Proxy:
                return that.kind == Value.Kind.Proxy && this.getProxy().toUnderlying() === that.getProxy().toUnderlying();
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
            case Value.Kind.Proxy:
                assert.fail("Cannot compare object instances");
        }
    }
    assign(value: Value): void {
        this.underlying = value.underlying;
        this._kind = value.kind;
    }
    swap(value: Value): Value {
        const before = new Value(this.underlying, this.kind);
        this.assign(value);
        return before;
    }
    mutate(op: string, lazy: () => Value): Value {
        switch (op) {
            case "=":
                return this.swap(lazy());
            case "++":
            case "--":
                if (this.kind !== Value.Kind.Int) {
                    throw new RuntimeException("Operator '{op}' can only be applied to values of type 'int'", {op});
                }
                return Value.fromInt(this.getInt().mutate(op));
        }
        assert.fail("Unknown mutating operator: '{op}'", {op, caller:this.mutate});
    }
    invoke(runner: Program.IRunner, args: FunctionArguments): Value {
        if (this.kind !== Value.Kind.Proxy) {
            throw new RuntimeException("Function invocation '()' is not supported by " + this.describe());
        }
        return this.getProxy().invoke(runner, args);
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
            value = Value.Unicode.fromString(value);
        }
        return new Value(value, Value.Kind.String);
    }
    static fromProxy(value: Value.IProxy) {
        return new Value(value, Value.Kind.Proxy);
    }
    static fromRuntimeException(exception: RuntimeException) {
        return Value.fromProxy(new ProxyRuntimeException(exception));
    }
    static fromVanillaArray(elements: Array<Value>) {
        return Value.fromProxy(new ProxyVanillaArray(elements));
    }
    static fromVanillaObject(elements: ValueMap) {
        return Value.fromProxy(new ProxyVanillaObject(elements));
    }
    static fromVanillaFunction(definition: FunctionDefinition, elements?: ValueMap) {
        return Value.fromProxy(new ProxyVanillaFunction(definition, elements ?? new ValueMap()));
    }
    static unary(op: string, rhs_: Value): Value  {
        assert.fail("Unknown unary operator: '{op}'", {op, caller:Value.unary});
    }
    static binary(lhs: Value, op: string, rhs: Value): Value  {
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
                return Value.fromBool(lhs.equals(rhs));
            case "!=":
                return Value.fromBool(!lhs.equals(rhs));
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
    [inspect.custom]() {
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
            case Value.Kind.Proxy:
                return "<proxy>";
        }
    }
}

function unicodeStringAt(codepoints: Uint32Array, index: number): string {
    return String.fromCodePoint(codepoints[index]);
}

function unicodeStringAll(codepoints: Uint32Array): string {
    return String.fromCodePoint(...codepoints);
}

function unicodeCompareTo(lhs: Uint32Array, rhs: Uint32Array): Comparison {
    const count = Math.max(lhs.length, rhs.length);
    let comparison: Comparison = 0;
    for (let index = 0; comparison === 0 && index < count; ++index) {
        comparison = compareScalar(lhs[index], rhs[index]);
    }
    return comparison || compareScalar(lhs.length, rhs.length);
}

function unicodeStartsWith(haystack: Uint32Array, needle: Uint32Array): boolean {
    if (haystack.length < needle.length) {
        return false;
    }
    for (let index = 0; index < needle.length; ++index) {
        if (haystack[index] !== needle[index]) {
            return false;
        }
    }
    return true;
}

function unicodeEndsWith(haystack: Uint32Array, needle: Uint32Array): boolean {
    const offset = haystack.length - needle.length;
    if (offset < 0) {
        return false;
    }
    for (let index = 0; index < needle.length; ++index) {
        if (haystack[index + offset] !== needle[index]) {
            return false;
        }
    }
    return true;
}

function unicodeIndex(codepoints: Uint32Array, offset: number): number {
    if (offset <= 0) {
        return offset;
    }
    let index = 0;
    while (offset > 0) {
        offset -= (codepoints[index++] > 0xFFFF) ? 2 : 1;
    }
    assert.eq(offset, 0);
    return index;
}

function unicodeReplaceAll(haystack: string, needle: string, replacement: string): string {
    if (needle === "") {
        return [...haystack].join(replacement);
    }
    return haystack.split(needle).join(replacement);
}

function unicodeReplaceLeft(haystack: string, needle: string, replacement: string, limit: number): string {
    if (needle === "") {
        const elements = [...haystack];
        return elements.slice(0, limit + 1).join(replacement) + elements.slice(limit + 1).join("");
    }
    let head = "";
    let tail = haystack;
    while (limit--) {
        const found = tail.indexOf(needle);
        if (found < 0) {
            break;
        }
        head = head + tail.slice(0, found) + replacement;
        tail = tail.slice(found + needle.length);
    }
    return head + tail;
}

function unicodeReplaceRight(haystack: string, needle: string, replacement: string, limit: number): string {
    if (needle === "") {
        const elements = [...haystack];
        return elements.slice(0, -1 - limit).join("") + elements.slice(-1 - limit).join(replacement);
    }
    let head = haystack;
    let tail = "";
    while (limit--) {
        const found = head.lastIndexOf(needle);
        if (found < 0) {
            break;
        }
        tail = replacement + head.slice(found + needle.length) + tail;
        head = head.slice(0, found);
    }
    return head + tail;
}

export namespace Value {
    export class Bool {
        constructor(private underlying: boolean) {}
        static format(value: boolean): string {
            return value ? "true" : "false";
        }
        toBoolean() {
            return this.underlying;
        }
        toString(options_?: ToStringOptions) {
            return Bool.format(this.underlying);
        }
    }
    export class Int {
        constructor(private underlying: bigint) {}
        static format(value: bigint | number): string {
            return value.toString();
        }
        toBigint(): bigint {
            return this.underlying;
        }
        toNumber() {
            return Number(this.underlying);
        }
        toString(options_?: ToStringOptions) {
            return Int.format(this.underlying);
        }
        mutate(op: string, rhs_?: bigint) {
            switch (op) {
                case "++":
                    return this.underlying++;
                case "--":
                    return this.underlying--;
            }
            assert.fail("Unknown integer mutate operator: '{op}'", {op});
        }
    }
    export class Float {
        constructor(private underlying: number) {}
        static format(value: number, sigfigs: number = 12): string {
            const parts = value.toPrecision(sigfigs).split("e");
            parts[0] = parts[0].replace(/0+$/, "").replace(/\.$/, ".0");
            return parts.join("e");
        }
        toBigint() {
            return BigInt(this.underlying);
        }
        toNumber() {
            return this.underlying;
        }
        toString(options_?: ToStringOptions) {
            return Float.format(this.underlying);
        }
    }
    export class Unicode {
        constructor(private underlying: Uint32Array) {}
        get length(): bigint {
            return BigInt(this.underlying.length);
        }
        at(index: bigint): string {
            if (index < 0 || index >= this.length) {
                return "";
            }
            return unicodeStringAt(this.underlying, Number(index));
        }
        compareTo(that: Unicode): Comparison {
            return unicodeCompareTo(this.underlying, that.underlying);
        }
        contains(needle: Unicode): boolean {
            return this.toString().indexOf(needle.toString()) >= 0;
        }
        endsWith(needle: Unicode): boolean {
            return unicodeEndsWith(this.underlying, needle.underlying);
        }
        hash(): bigint {
            // See https://docs.oracle.com/javase/6/docs/api/java/lang/String.html#hashCode()
            const mask = BigInt("0xFFFFFFFFFFFFFFFF");
            const multiplier = BigInt(31);
            let hash = BigInt(0);
            for (const codepoint of this.underlying) {
                hash = (hash * multiplier + BigInt(codepoint)) & mask;
            }
            return hash;
        }
        indexOf(needle: Unicode): number {
            return unicodeIndex(this.underlying, this.toString().indexOf(needle.toString()));
        }
        join(args: Value[]): Unicode {
            return Unicode.fromString(args.map(arg => arg.toString()).join(this.toString()));
        }
        lastIndexOf(needle: Unicode): number {
            return unicodeIndex(this.underlying, this.toString().lastIndexOf(needle.toString()));
        }
        padStart(width: number, padding: Unicode): Unicode {
            return Unicode.fromString(this.toString().padStart(width, padding.toString()));
        }
        padEnd(width: number, padding: Unicode): Unicode {
            return Unicode.fromString(this.toString().padEnd(width, padding.toString()));
        }
        repeat(count: number): Unicode {
            return Unicode.fromString(this.toString().repeat(count));
        }
        replace(needle: Unicode, replacement: Unicode, count?: number): Unicode {
            if (count === undefined) {
                return Unicode.fromString(unicodeReplaceAll(this.toString(), needle.toString(), replacement.toString()));
            }
            if (count > 0) {
                return Unicode.fromString(unicodeReplaceLeft(this.toString(), needle.toString(), replacement.toString(), count));
            }
            if (count < 0) {
                return Unicode.fromString(unicodeReplaceRight(this.toString(), needle.toString(), replacement.toString(), -count));
            }
            return this;
        }
        slice(start?: number, end?: number): Unicode {
            return new Value.Unicode(this.underlying.slice(start, end));
        }
        startsWith(needle: Unicode): boolean {
            return unicodeStartsWith(this.underlying, needle.underlying);
        }
        toCodepoints(): Uint32Array {
            return this.underlying;
        }
        toString(options?: ToStringOptions): string {
            const quote = options?.quoteString ?? "";
            return quote + unicodeStringAll(this.underlying) + quote;
        }
        static fromString(value: string): Unicode {
            const unicode = Uint32Array.from([...value].map(ch => ch.codePointAt(0)));
            return new Value.Unicode(unicode);
        }
    }
    export interface IProxy {
        getProperty(property: string): Value;
        setProperty(property: string, value: Value): Value;
        mutProperty(property: string, op: string, lazy: () => Value): Value;
        delProperty(property: string): Value;
        getIndex(index: Value): Value;
        setIndex(index: Value, value: Value): Value;
        mutIndex(index: Value, op: string, lazy: () => Value): Value;
        delIndex(index: Value): Value;
        getIterator(): () => Value;
        invoke(runner: Program.IRunner, args: FunctionArguments): Value;
        toUnderlying(): unknown;
        toDebug(): string;
        toString(options_?: ToStringOptions): string;
        describe(): string;
    }
    export enum Kind {
        Void = "void",
        Null = "null",
        Bool = "bool",
        Int = "int",
        Float = "float",
        String = "string",
        Proxy = "proxy",
    }
    export const VOID = Value.fromVoid();
    export const NULL = Value.fromNull();
    export const FALSE = Value.fromBool(false);
    export const TRUE = Value.fromBool(true);
}
