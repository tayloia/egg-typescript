import { assert } from "./assertion";
import { Exception, RuntimeException } from "./exception";
import { FunctionArguments } from "./function";
import { Program } from "./program";
import { ToStringOptions, Value } from "./value";

export abstract class Manifestations {
    abstract readonly OBJECT: Value.Proxy;
    static createDefault(): Manifestations {
        return new ManifestationsImpl();
    }
}

class ManifestationsImpl implements Manifestations {
    OBJECT: Value.Proxy = new ManifestationObject();
}

class ManifestationBase implements Value.Proxy {
    constructor(public name: string, public proxies?: Map<string, Value.Proxy>) {}
    getProperty(property: string): Value | Exception {
        const found = this.proxies?.get(property);
        if (found) {
            return Value.fromProxy(found);
        }
        return new RuntimeException("Property not known: '{class}.{property}'", { class: this.name, property });
    }
    setProperty(property_: string, value_: Value): Value | Exception {
        this.unimplemented();
    }
    mutProperty(property_: string, op_: string, lazy_: () => Value): Value | Exception {
        this.unimplemented();
    }
    delProperty(property_: string): Value | Exception {
        this.unimplemented();
    }
    getIndex(index_: Value): Value | Exception {
        this.unimplemented();
    }
    setIndex(index_: Value, value_: Value): Value | Exception {
        this.unimplemented();
    }
    mutIndex(index_: Value, op_: string, lazy_: () => Value): Value | Exception {
        this.unimplemented();
    }
    delIndex(index_: Value): Value | Exception {
        this.unimplemented();
    }
    invoke(runner_: Program.Runner, args_: FunctionArguments): Value | Exception {
        this.unimplemented();
    }
    toUnderlying(): unknown {
        this.unimplemented();
    }
    toDebug(): string {
        this.unimplemented();
    }
    toString(options_?: ToStringOptions): string {
        this.unimplemented();
    }
    describe(): string {
        return `a value of type '${this.name}'`;
    }
    unimplemented(): never {
        assert.fail("Method not implemented: '{caller}'", { class: this.name, caller: this.unimplemented });
    }
}

class ManifestationObject extends ManifestationBase {
    constructor() {
        super("object", new Map([
            [ "property", new ManifestationObjectProperty() ]
        ]));
    }
}

class ManifestationObjectProperty extends ManifestationBase {
    constructor() {
        super("object.property", new Map([
            [ "get", new ManifestationObjectPropertyGet() ],
            [ "set", new ManifestationObjectPropertySet() ],
            [ "mut", new ManifestationObjectPropertyMut() ],
            [ "del", new ManifestationObjectPropertyDel() ],
        ]));
    }
}

class ManifestationObjectPropertyGet extends ManifestationBase {
    constructor() {
        super("object.property.get");
    }
}

class ManifestationObjectPropertySet extends ManifestationBase {
    constructor() {
        super("object.property.set");
    }
}

class ManifestationObjectPropertyMut extends ManifestationBase {
    constructor() {
        super("object.property.mut");
    }
}

class ManifestationObjectPropertyDel extends ManifestationBase {
    constructor() {
        super("object.property.del");
    }
    invoke(runner_: Program.Runner, args: FunctionArguments): Value | Exception {
        args.expect(2);
        const proxy = args.expectProxy(0);
        const property = args.expectString(1);
        return proxy.delProperty(property);
    }
}
