import { inspect } from "util";
import { Exception } from "./exception";
import { Fallible } from "./fallible";
import { ToStringOptions, Value } from "./value";
import { assert } from "./assertion";

abstract class ProxyBase implements Value.Proxy {
    abstract getProperty(property: string): Fallible<Value>;
    abstract getIndex(index: Value): Fallible<Value>;
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
}

export class ProxyArray extends ProxyBase {
    constructor(private elements: Value[]) {
        super();
    }
    getProperty(property: string): Fallible<Value> {
        switch (property) {
            case "length":
                return Fallible.success(Value.fromInt(BigInt(this.elements.length)));
        }
        return Fallible.failure("Unknown property for type 'ProxyArray': '{property}'", {property});
    }
    getIndex(index: Value): Fallible<Value> {
        if (index.kind === Value.Kind.Int) {
            const i = index.getInt().toNumber();
            assert(i >= 0 && i < this.elements.length);
            return Fallible.success(this.elements[i]);
        }
        return Fallible.failure("Indexing is not supported by type 'ProxyArray'", {index});
    }
    toUnderlying(): unknown {
        return this;
    }
    toString(): string {
        const options: ToStringOptions = {
            quoteString: "\"",
        }
        return "[" + this.elements.map(element => element.toString(options)).join(",") + "]";
    }
}

export class ProxyPredicateBinary extends ProxyBase {
    constructor(private value: Value, private lhs: Value, private op: string, private rhs: Value, private location: Exception.Location) {
        super();
    }
    getProperty(property: string): Fallible<Value> {
        switch (property) {
            case "value":
                return Fallible.success(this.value);
            case "lhs":
                return Fallible.success(this.lhs);
            case "op":
                return Fallible.success(Value.fromString(this.op));
            case "rhs":
                return Fallible.success(this.rhs);
            case "location":
                return Fallible.success(this.rhs);
        }
        return Fallible.failure("Unknown property for type 'ProxyPredicateBinary': '{property}'", {property});
    }
    getIndex(index: Value): Fallible<Value> {
        return Fallible.failure("Indexing is not supported by type 'ProxyPredicateBinary'", {index});
    }
    toString(): string {
        return `<ProxyPredicateBinary ${this.value} ${this.lhs} ${this.op} ${this.rhs} ${this.location}]`;
    }
}