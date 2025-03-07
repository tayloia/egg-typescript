import { BaseException, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
import { Tokenizer } from "./tokenizer";

class Impl {
    warnings = 0;
    errors = 0;
    constructor(public tokenizer: Tokenizer, public logger: Logger) {}
    parseModule(): Parser.Output {
        if (!this.tokenizer.take()) {
            this.fatal("Empty input");
        }
        return {
            warnings: this.warnings,
            errors: this.errors
        } as Parser.Output;
    }
    log(severity: Logger.Severity, message: string, parameters?: Logger.Parameters): void {
        this.logger.log(new Logger.Entry(severity, message, parameters));
    }
    fatal(message: string, parameters?: Logger.Parameters): never {
        this.log(Logger.Severity.Error, message, parameters);
        throw new Parser.Exception(message, parameters);
    }
}

export class Parser {
    private logger?: Logger;
    private constructor(private tokenizer: Tokenizer) {
    }
    parse(): Parser.Output {
        const impl = new Impl(this.tokenizer, this.logger ?? new ConsoleLogger());
        return impl.parseModule();
    }
    withLogger(logger: Logger): Parser {
        this.logger = logger;
        return this;
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
