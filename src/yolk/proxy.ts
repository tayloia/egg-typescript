import { inspect } from "util";
import { Exception, RuntimeException } from "./exception";
import { ToStringOptions, Value } from "./value";
import { assert } from "./assertion";
import { Location } from "./location";

abstract class ProxyBase implements Value.Proxy {
    abstract getProperty(property: string): Value | Exception;
    abstract setProperty(property: string, value: Value): Value | Exception;
    abstract mutProperty(property: string, op: string, lazy: () => Value): Value | Exception;
    abstract getIndex(index: Value): Value | Exception;
    abstract setIndex(index: Value, value: Value): Value | Exception;
    abstract mutIndex(index: Value, op: string, lazy: () => Value): Value | Exception;
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

export class ProxyVanillaArray extends ProxyBase {
    constructor(private elements: Value[]) {
        super();
    }
    getProperty(property: string): Value | Exception {
        switch (property) {
            case "length":
                return Value.fromInt(BigInt(this.elements.length));
        }
        return new RuntimeException("Unknown property for type 'ProxyVanillaArray': '{property}'", {property});
    }
    setProperty(property: string, value: Value): Value | Exception {
        switch (property) {
            case "length":
                return this.setLength(value.getInt().toNumber());
        }
        return new RuntimeException("Property modification is not supported for type 'ProxyVanillaArray': '{property}'", {property, value});
    }
    mutProperty(property: string, op: string, lazy_: () => Value): Value | Exception {
        return new RuntimeException("Property mutation is not supported for type 'ProxyVanillaArray': '{property}'", {property, op});
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
    mutIndex(index: Value, op: string, lazy_: () => Value): Value | Exception {
        return new RuntimeException("Index mutation is not supported for type 'ProxyVanillaArray': '{property}'", {index, op});
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
    constructor(private elements: Map<Value, Value>) {
        super();
    }
    getProperty(property: string): Value | Exception {
        const key = Value.fromString(property);
        return this.elements.get(key) ?? new RuntimeException("Unknown property for type 'ProxyVanillaObject': '{property}'", {property});
    }
    setProperty(property: string, value: Value): Value | Exception {
        const key = Value.fromString(property);
        this.elements.set(key, value);
        return Value.VOID;
    }
    mutProperty(property: string, op: string, lazy_: () => Value): Value | Exception {
        return new RuntimeException("Property mutation is not supported for type 'ProxyVanillaObject': '{property}'", {property, op});
    }
    getIndex(index: Value): Value | Exception {
        return new RuntimeException("Indexing is not supported by type 'ProxyVanillaObject'", {index});
    }
    setIndex(index: Value, value_: Value): Value | Exception {
        return new RuntimeException("Index modification is not supported by type 'ProxyVanillaObject'", {index});
    }
    mutIndex(index: Value, op: string, lazy_: () => Value): Value | Exception {
        return new RuntimeException("Index mutation is not supported for type 'ProxyVanillaObject': '{property}'", {index, op});
    }
    toUnderlying(): unknown {
        return this.elements;
    }
    toString(): string {
        const options: ToStringOptions = {
            quoteString: "\"",
        }
        return "{" + [...this.elements].map(([key, value]) => key.toString() + ":" + value.toString(options)).join(",") + "}";
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
    setProperty(property: string, value: Value): Value | Exception {
        return new RuntimeException("Property modification is not supported by type 'ProxyPredicateBinary'", {property, value});
    }
    mutProperty(property: string, op: string, lazy_: () => Value): Value | Exception {
        return new RuntimeException("Property mutation is not supported by type 'ProxyPredicateBinary'", {property, op});
    }
    getIndex(index: Value): Value | Exception {
        return new RuntimeException("Indexing is not supported by type 'ProxyPredicateBinary'", {index});
    }
    setIndex(index: Value, value: Value): Value | Exception {
        return new RuntimeException("Index modification is not supported for type 'ProxyPredicateBinary': '{property}'", {index, value});
    }
    mutIndex(index: Value, op: string, lazy_: () => Value): Value | Exception {
        return new RuntimeException("Index mutation is not supported for type 'ProxyPredicateBinary': '{property}'", {index, op});
    }
    toString(): string {
        return `<ProxyPredicateBinary ${this.value} ${this.lhs} ${this.op} ${this.rhs} ${this.location}]`;
    }
}