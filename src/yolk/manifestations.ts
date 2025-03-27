import { assert } from "./assertion";
import { RuntimeException } from "./exception";
import { FunctionArguments } from "./function";
import { Program } from "./program";
import { Type } from "./type";
import { ToStringOptions, Value } from "./value";

export interface IManifestation {
    getRuntimeType(): Type;
    getProxy(): Value.IProxy;
}

export abstract class Manifestations {
    abstract readonly STRING: IManifestation;
    abstract readonly OBJECT: IManifestation;
    abstract readonly TYPE: IManifestation;
    static createDefault(): Manifestations {
        return new ManifestationsImpl();
    }
}

class ManifestationsImpl implements Manifestations {
    STRING = new ManifestationString();
    OBJECT = new ManifestationObject();
    TYPE = new ManifestationType();
}

abstract class ManifestationBase implements IManifestation, Value.IProxy {
    constructor(public name: string, public proxies?: Map<string, Value.IProxy>) {}
    abstract getRuntimeType(): Type;
    getProxy(): Value.IProxy {
        return this;
    }
    getProperty(property: string): Value {
        const found = this.proxies?.get(property);
        if (found) {
            return Value.fromProxy(found);
        }
        throw new RuntimeException("Type '{type}' does not have a static property named '{property}'", { type: this.name, property });
    }
    setProperty(property_: string, value_: Value): Value {
        this.unimplemented();
    }
    mutProperty(property_: string, op_: string, lazy_: () => Value): Value {
        this.unimplemented();
    }
    delProperty(property_: string): Value {
        this.unimplemented();
    }
    getIndex(index_: Value): Value {
        this.unimplemented();
    }
    setIndex(index_: Value, value_: Value): Value {
        this.unimplemented();
    }
    mutIndex(index_: Value, op_: string, lazy_: () => Value): Value {
        this.unimplemented();
    }
    delIndex(index_: Value): Value {
        this.unimplemented();
    }
    getIterator(): () => Value {
        this.unimplemented();
    }
    invoke(runner_: Program.IRunner, args_: FunctionArguments): Value {
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

class ManifestationString extends ManifestationBase {
    constructor() {
        super("string", new Map([
        ]));
    }
    getRuntimeType(): Type {
        return Type.OBJECT;
    }
    invoke(runner_: Program.IRunner, args: FunctionArguments): Value {
        const text = args.arguments.map(arg => arg.toString()).join("");
        return Value.fromString(text);
    }
}

class ManifestationObject extends ManifestationBase {
    constructor() {
        super("object", new Map([
            [ "property", new ManifestationObjectProperty() ]
        ]));
    }
    getRuntimeType(): Type {
        return Type.OBJECT;
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
    getRuntimeType(): Type {
        return Type.OBJECT;
    }
}

class ManifestationObjectPropertyGet extends ManifestationBase {
    constructor() {
        super("object.property.get");
    }
    getRuntimeType(): Type {
        return Type.OBJECT;
    }
}

class ManifestationObjectPropertySet extends ManifestationBase {
    constructor() {
        super("object.property.set");
    }
    getRuntimeType(): Type {
        return Type.OBJECT;
    }
}

class ManifestationObjectPropertyMut extends ManifestationBase {
    constructor() {
        super("object.property.mut");
    }
    getRuntimeType(): Type {
        return Type.OBJECT;
    }
}

class ManifestationObjectPropertyDel extends ManifestationBase {
    constructor() {
        super("object.property.del");
    }
    getRuntimeType(): Type {
        return Type.OBJECT;
    }
    invoke(runner_: Program.IRunner, args: FunctionArguments): Value {
        args.expect(2);
        const proxy = args.expectProxy(0);
        const property = args.expectString(1);
        return proxy.delProperty(property);
    }
}

class ManifestationType extends ManifestationBase {
    constructor() {
        super("type", new Map([
            [ "of", new ManifestationTypeOf() ]
        ]));
    }
    getRuntimeType(): Type {
        return Type.OBJECT;
    }
}

class ManifestationTypeOf extends ManifestationBase {
    constructor() {
        super("type.of");
    }
    getRuntimeType(): Type {
        return Type.OBJECT;
    }
    invoke(runner_: Program.IRunner, args: FunctionArguments): Value {
        args.expect(1);
        const value = args.arguments[0];
        return Value.fromString(value.getRuntimeType().toString());
    }
}
