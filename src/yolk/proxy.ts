import { inspect } from "util";
import { Exception, RuntimeException } from "./exception";
import { ToStringOptions, Value } from "./value";
import { assert } from "./assertion";
import { Location } from "./location";

abstract class ProxyBase implements Value.Proxy {
    abstract getProperty(property: string): Value | Exception;
    abstract getIndex(index: Value): Value | Exception;
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
    getProperty(property: string): Value | Exception {
        switch (property) {
            case "length":
                return Value.fromInt(BigInt(this.elements.length));
        }
        return new RuntimeException("Unknown property for type 'ProxyArray': '{property}'", {property});
    }
    getIndex(index: Value): Value | Exception {
        if (index.kind === Value.Kind.Int) {
            const i = index.getInt().toNumber();
            assert(i >= 0 && i < this.elements.length);
            return this.elements[i];
        }
        return new RuntimeException("Indexing is not supported by type 'ProxyArray'", {index});
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
    constructor(private value: Value, private lhs: Value, private op: string, private rhs: Value, private location: Location) {
        super();
    }
    getProperty(property: string): Value | Exception {
        switch (property) {
            case "value":
                return this.value;
            case "lhs":
                return this.lhs;
            case "op":
                return Value.fromString(this.op);
            case "rhs":
                return this.rhs;
        }
        return new RuntimeException("Unknown property for type 'ProxyPredicateBinary': '{property}'", {property});
    }
    getIndex(index: Value): Value | Exception {
        return new RuntimeException("Indexing is not supported by type 'ProxyPredicateBinary'", {index});
    }
    toString(): string {
        return `<ProxyPredicateBinary ${this.value} ${this.lhs} ${this.op} ${this.rhs} ${this.location}]`;
    }
}