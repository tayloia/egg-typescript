import { inspect } from "util";

export type ExceptionParameters = Record<string, unknown>;

export enum ExceptionOrigin {
    Assertion = "ASSERTION",
    Compiler = "COMPILER",
    Linker = "LINKER",
    Parser = "PARSER",
    Runtime = "RUNTIME",
    Tokenizer = "TOKENIZER",
};

export abstract class BaseException extends Error {
    parameters: ExceptionParameters;
    protected constructor(name: string, origin: ExceptionOrigin, private _message: string, parameters?: ExceptionParameters) {
        super();
        this.parameters = parameters ? { ...parameters, name, origin } : { name, origin };
    }
    get message(): string {
        return Exception.format(this._message, this.parameters);
    }
    get name(): string {
        return this.parameters.name as string;
    }
    get origin(): ExceptionOrigin {
        return this.parameters.origin as ExceptionOrigin;
    }
}

export namespace Exception {
    export class Location {
        constructor(public source: string, public line0: number = 1, public column0: number = 1, public line1: number = 0, public column1: number = 0) {}
        span(that: Location): Location {
            this.line1 = that.line1;
            this.column1 = that.column1;
            return this;
        }
        format() {
            function range(lbound: number, ubound: number): string {
                return lbound < ubound ? `${lbound}-${ubound}` : `${lbound}`;
            }
            return `${this.source}(${range(this.line0, this.line1)},${range(this.column0, this.column1)})`;
        }
        [inspect.custom]() {
            return `[${this.format()}]`;
        } ;
    }
    export function location(source: unknown, line: unknown, column: unknown): string {
        if (column) {
            return `${source || ""}(${line},${column}): `;
        }
        if (line) {
            return `${source || ""}(${line}): `;
        }
        if (source) {
            return `${source}: `;
        }
        return "";
    }
    export function format(message: string, parameters: ExceptionParameters): string {
        function replacer(input: string, key: string): string {
            if (key === "location") {
                return Exception.location(parameters.source, parameters.line, parameters.column);
            }
            const output = parameters[key];
            if (output === undefined) {
                return input;
            }
            return String(output);
        }
        return message.replace(/\{([^}]+)\}/g, replacer);
    }
}

export class RuntimeException extends BaseException {
    constructor(message: string, parameters?: ExceptionParameters) {
        super("RuntimeException", ExceptionOrigin.Runtime, message, parameters);
    }
    static at(location: Exception.Location, message: string, parameters?: ExceptionParameters) {
        return new RuntimeException("{location}" + message, { ...parameters, location });
    }
}
