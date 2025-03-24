import { inspect } from "util";

import { assert } from "./assertion";
import { Exception, RuntimeException } from "./exception";
import { ToStringOptions, Value } from "./value";
import { Program } from "./program";
import { Message } from "./message";
import { ValueMap } from "./valuemap";
import { FunctionArguments, FunctionDefinition } from "./function";

abstract class ProxyBase implements Value.Proxy {
    getProperty(property: string): Value | Exception {
        return this.unsupported("Properties are", {property});
    }
    setProperty(property: string, value_: Value): Value | Exception {
        return this.unsupported("Property modification is", {property});
    }
    mutProperty(property: string, op_: string, lazy_: () => Value): Value | Exception {
        return this.unsupported("Property mutation is", {property});
    }
    delProperty(property: string): Value | Exception {
        return this.unsupported("Property deletion is", {property});
    }
    getIndex(index: Value): Value | Exception {
        return this.unsupported("Indexing is", {index});
    }
    setIndex(index: Value, value_: Value): Value | Exception {
        return this.unsupported("Modification by index is", {index});
    }
    mutIndex(index: Value, op_: string, lazy_: () => Value): Value | Exception {
        return this.unsupported("Mutation by index is", {index});
    }
    delIndex(index: Value): Value | Exception {
        return this.unsupported("Deletion by index is", {index});
    }
    invoke(runner_: Program.Runner, args_: FunctionArguments): Value | Exception {
        return this.unsupported("Function invocation '()' is");
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
    protected unknown(property: string, parameters?: Message.Parameters): Exception {
        return new RuntimeException(`Unknown property '{property}' for ${this.describe()}`, { ...parameters, property });
    }
    protected unsupported(message: string, parameters?: Message.Parameters): Exception {
        return new RuntimeException(`${message} not supported by ${this.describe()}`, parameters);
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

export class ProxyVanillaArray extends ProxyBase {
    constructor(private elements: Value[]) {
        super();
    }
    getProperty(property: string): Value | Exception {
        switch (property) {
            case "length":
                return Value.fromInt(BigInt(this.elements.length));
        }
        return this.unknown(property);
    }
    setProperty(property: string, value: Value): Value | Exception {
        switch (property) {
            case "length":
                return this.setLength(value.getInt().toNumber());
        }
        return this.unsupported("Modification of property '{property}' is", {property, value})
    }
    getIndex(index: Value): Value | Exception {
        if (index.kind === Value.Kind.Int) {
            const i = index.getInt().toNumber();
            assert(i >= 0 && i < this.elements.length);
            return this.elements[i];
        }
        return new RuntimeException("Indexing is not supported by type 'ProxyVanillaArray'", {index});
    }
    setIndex(index: Value, value: Value): Value | Exception {
        this.elements[index.asNumber()] = value;
        return Value.VOID;
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
    private setLength(length: number): Value | Exception {
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
    getProperty(property: string): Value | Exception {
        const key = Value.fromString(property);
        return this.entries.get(key) ?? new RuntimeException("Unknown property for type 'ProxyVanillaObject': '{property}'", {property});
    }
    setProperty(property: string, value: Value): Value | Exception {
        const key = Value.fromString(property);
        this.entries.set(key, value);
        return Value.VOID;
    }
    delProperty(property: string): Value | Exception {
        const key = Value.fromString(property);
        const value = this.entries.get(key);
        if (value) {
            this.entries.delete(key);
            return value;
        }
        return Value.VOID;
    }
    toUnderlying(): unknown {
        return this.entries;
    }
    toString(): string {
        const options: ToStringOptions = {
            quoteString: "\"",
        }
        return "{" + this.entries.unordered(kv => kv.key.toString() + ":" + kv.value.toString(options)).join(",") + "}";
    }
    describe(): string {
        return "a value of type 'object'";
    }
}

export class ProxyVanillaFunction extends ProxyVanillaObject {
    constructor(private definition: FunctionDefinition, entries: ValueMap) {
        super(entries);
    }
    invoke(runner: Program.Runner, args: FunctionArguments): Value {
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
