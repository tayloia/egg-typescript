import { inspect } from "util";

import { assert } from "./assertion";
import { RuntimeException } from "./exception";
import { ToStringOptions, Value } from "./value";
import { Program } from "./program";
import { Message } from "./message";
import { ValueMap } from "./valuemap";
import { FunctionArguments, FunctionDefinition } from "./function";
import { Location } from "./location";

abstract class ProxyBase implements Value.IProxy {
    getProperty(property: string): Value {
        this.unsupported("Properties are", {property});
    }
    setProperty(property: string, value_: Value): Value {
        this.unsupported("Property modification is", {property});
    }
    mutProperty(property: string, op_: string, lazy_: () => Value): Value {
        this.unsupported("Property mutation is", {property});
    }
    delProperty(property: string): Value {
        this.unsupported("Property deletion is", {property});
    }
    getIndex(index: Value): Value {
        this.unsupported("Indexing is", {index});
    }
    setIndex(index: Value, value_: Value): Value {
        this.unsupported("Modification by index is", {index});
    }
    mutIndex(index: Value, op_: string, lazy_: () => Value): Value {
        this.unsupported("Mutation by index is", {index});
    }
    delIndex(index: Value): Value {
        this.unsupported("Deletion by index is", {index});
    }
    getIterator(): () => Value {
        this.unsupported("Iteration is");
    }
    invoke(runner_: Program.IRunner, args_: FunctionArguments): Value {
        this.unsupported("Function invocation '()' is");
    }
    [inspect.custom]() {
        return this.toDebug();
    }
    toUnderlying(): unknown {
        return this;
    }
    toDebug(): string {
        return this.toString();
    }
    abstract toString(): string;
    abstract describe(): string;
    protected unknown(property: string, parameters?: Message.Parameters): never {
        throw new RuntimeException(`Unknown property '{property}' for ${this.describe()}`, { ...parameters, property });
    }
    protected unsupported(message: string, parameters?: Message.Parameters): never {
        throw new RuntimeException(`${message} not supported by ${this.describe()}`, parameters);
    }
}

export class ProxyStringMethod extends ProxyBase {
    constructor(private method: string, public invoke: Program.Callsite) {
        super();
    }
    toString(): string {
        return "[" + this.method + "]";
    }
    describe(): string {
        return "[" + this.method + "]";
    }
}

abstract class ProxyImmutableObject extends ProxyBase {
    constructor(protected fields: [string, Value][]) {
        super();
    }
    protected map = new Map(this.fields);
    getProperty(property: string): Value {
        const value = this.map.get(property);
        if (value === undefined) {
            throw new RuntimeException(`Unknown property for ${this.describe()}: '{property}'`, {property});
        }
        return value;
    }
    getIterator(): () => Value {
        let index = 0;
        return () => {
            if (index < this.fields.length) {
                return ProxyImmutableObject.makePair(...this.fields[index++]);
            }
            return Value.VOID;
        };
    }
    toUnderlying(): unknown {
        return this;
    }
    toString(): string {
        const options: ToStringOptions = {
            quoteString: "\"",
        }
        return "{" + this.fields.map(([key, value]) => key.toString() + ":" + value.toString(options)).join(",") + "}";
    }
    describe(): string {
        return "a key-value pair";
    }
    private static makePair(key: string, value: Value) {
        return Value.fromProxy(new ProxyKeyValue(Value.fromString(key), value));
    }
}

class ProxyKeyValue extends ProxyImmutableObject {
    constructor(key: Value, value: Value) {
        super([["key", key], ["value", value]]);
    }
    describe(): string {
        return "a key-value pair";
    }
}

export class ProxyRuntimeException extends ProxyImmutableObject {
    // TODO Merge with RuntimeException
    constructor(private exception: RuntimeException) {
        super(ProxyRuntimeException.makeFields(exception));
        console.log(exception.parameters)
    }
    toUnderlying(): unknown {
        return this.exception;
    }
    toString(): string {
        return this.exception.format(true);
    }
    describe(): string {
        return "an exception";
    }
    static makeFields(exception: RuntimeException) {
        const fields: [string, Value][] = [
            ["message", Value.fromString(exception.format(false))],
        ];
        for (const [key, value] of Object.entries(exception.parameters)) {
            if (key === "location") {
                const location = value as Location;
                if (location.source) {
                    fields.push(["resource", Value.fromString(location.source)]);
                }
                if (location.line0 > 0) {
                    fields.push(["line", Value.fromInt(BigInt(location.line0))]);
                }
                if (location.column0 > 0) {
                    fields.push(["column", Value.fromInt(BigInt(location.column0))]);
                }
            } else if (key !== "name" && key !== "origin") {
                const extracted = Value.fromUnknown(value);
                if (!extracted.isVoid()) {
                    fields.push([key, extracted]);
                }
            }
        }
        return fields;
    }
}

export class ProxyVanillaArray extends ProxyBase {
    constructor(private elements: Value[]) {
        super();
    }
    getProperty(property: string): Value {
        switch (property) {
            case "length":
                return Value.fromInt(BigInt(this.elements.length));
        }
        return this.unknown(property);
    }
    setProperty(property: string, value: Value): Value {
        switch (property) {
            case "length":
                return this.setLength(value.getInt().toNumber());
        }
        this.unsupported("Modification of property '{property}' is", {property, value})
    }
    getIndex(index: Value): Value {
        if (index.kind === Value.Kind.Int) {
            const i = index.getInt().toNumber();
            assert(i >= 0 && i < this.elements.length);
            return this.elements[i];
        }
        throw new RuntimeException("Indexing is not supported by type 'ProxyVanillaArray'", {index});
    }
    setIndex(index: Value, value: Value): Value {
        this.elements[index.asNumber()] = value;
        return Value.VOID;
    }
    getIterator(): () => Value {
        let index = 0;
        return () => {
            if (index < this.elements.length) {
                return this.elements[index++];
            }
            return Value.VOID;
        };
    }
    toUnderlying(): unknown {
        return this.elements;
    }
    toString(): string {
        const options: ToStringOptions = {
            quoteString: "\"",
        }
        return "[" + this.elements.map(element => element.toString(options)).join(",") + "]";
    }
    describe(): string {
        return "an array value";
    }
    private setLength(length: number): Value {
        let fill = this.elements.length;
        this.elements.length = length;
        while (fill < length) {
            this.elements[fill++] = Value.fromNull();
        }
        return Value.VOID;
    }
}

export class ProxyVanillaObject extends ProxyBase {
    constructor(protected entries: ValueMap) {
        super();
    }
    getProperty(property: string): Value {
        const key = Value.fromString(property);
        const value = this.entries.get(key);
        if (value === undefined) {
            throw new RuntimeException("Unknown property for type 'ProxyVanillaObject': '{property}'", {property});
        }
        return value;
    }
    setProperty(property: string, value: Value): Value {
        const key = Value.fromString(property);
        this.entries.set(key, value);
        return Value.VOID;
    }
    delProperty(property: string): Value {
        const key = Value.fromString(property);
        const value = this.entries.get(key);
        if (value) {
            this.entries.delete(key);
            return value;
        }
        return Value.VOID;
    }
    getIterator(): () => Value {
        const snapshot = this.entries.chronological(kv => new ProxyKeyValue(kv.key, kv.value));
        let index = 0;
        return () => {
            if (index < snapshot.length) {
                return Value.fromProxy(snapshot[index++]);
            }
            return Value.VOID;
        };
    }
    toUnderlying(): unknown {
        return this.entries;
    }
    toString(): string {
        const options: ToStringOptions = {
            quoteString: "\"",
        }
        return "{" + this.entries.chronological(kv => kv.key.toString() + ":" + kv.value.toString(options)).join(",") + "}";
    }
    describe(): string {
        return "a value of type 'object'";
    }
}

export class ProxyVanillaFunction extends ProxyVanillaObject {
    constructor(private definition: FunctionDefinition, entries: ValueMap) {
        super(entries);
    }
    invoke(runner: Program.IRunner, args: FunctionArguments): Value {
        return this.definition.invoke(runner, args);
    }
    toUnderlying(): unknown {
        return this.definition;
    }
    toString(): string {
        return this.definition.toString();
    }
    describe(): string {
        return this.definition.describe();
    }
}
