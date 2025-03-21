import { Location } from "./location";
import { Message } from "./message";

// See https://egghead.io/blog/using-branded-types-in-typescript
const EXCEPTION_BRAND: unique symbol = Symbol();

export class Exception extends Message {
    [EXCEPTION_BRAND]: Exception = this;
    protected constructor(name: string, origin: Message.Origin, message: string, parameters?: Message.Parameters) {
        super(message, { ...parameters, name, origin });
    }
    unwrap(location?: Location): never {
        if (location) {
            this.parameters.location = location;
        }
        throw this;
    }
    static from(candidate: unknown): Exception | undefined {
        return (candidate as Exception)[EXCEPTION_BRAND];
    }
}

export class RuntimeException extends Exception {
    constructor(message: string, parameters?: Message.Parameters) {
        super(RuntimeException.name, Exception.Origin.Runtime, message, parameters);
    }
}
