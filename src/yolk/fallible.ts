import { ExceptionParameters, RuntimeException } from "./exception";
import { Program } from "./program";

export class Fallible<T> {
    public constructor(private underlying: T | RuntimeException) {}
    get failed() {
        return this.underlying instanceof RuntimeException;
    }
    get succeeded() {
        return !this.failed;
    }
    unwrap(location: Program.Location): T {
        if (this.underlying instanceof RuntimeException) {
            this.underlying.parameters["location"] = location;
            throw this.underlying;
        }
        return this.underlying;
    }
}

export namespace Fallible {
    export function success<T>(value: T) {
        return new Fallible<T>(value);
    }
    export function failure<T>(message: string, parameters?: ExceptionParameters) {
        return new Fallible<T>(new RuntimeException(message, parameters));
    }
}
