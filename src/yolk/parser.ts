import { BaseException, ExceptionParameters } from "./exception";
import { Tokenizer } from "./tokenizer";

class Impl {
    warnings = 0;
    errors = 0;
    constructor(public tokenizer: Tokenizer) {}
    parse(): Parser.Output {
        if (!this.tokenizer.take()) {
            this.fatal("Empty input");
        }
        return {
            warnings: this.warnings,
            errors: this.errors
        } as Parser.Output;
    }
    fatal(message: string): never {
        throw new Parser.Exception(message);
    }
}

export class Parser {
    private constructor(private tokenizer: Tokenizer) {
    }
    parse(): Parser.Output {
        const impl = new Impl(this.tokenizer);
        return impl.parse();
    }
    static fromString(input: string): Parser {
        return new Parser(Tokenizer.fromString(input));
    }
}

export namespace Parser {
    export class Exception extends BaseException {
        constructor(message: string, parameters?: ExceptionParameters) {
            super("ParserException", message, parameters);
        }
    }
    export interface Output {
        readonly warnings: number;
        readonly errors: number;
    }
}
