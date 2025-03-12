import { BaseException, ExceptionParameters } from "./exception";
import { Logger } from "./logger";
import { Parser } from "./parser";
import { Module } from "./program";

class Impl extends Logger {
    constructor(public input: Parser.Node, public logger: Logger) {
        super();
    }
    compileModule(): Module {
        return {} as Module;
    }
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
}

export class Compiler {
    parsed?: Parser.Node;
    constructor(public parser: Parser) {
    }
    compile(): Module {
        this.parsed ??= this.parser.parse();
        const impl = new Impl(this.parsed, this.logger);
        return impl.compileModule();
    }
    withLogger(logger: Logger): Compiler {
        this.parser.withLogger(logger);
        return this;
    }
    get logger() {
        return this.parser.logger;
    }
    static fromString(input: string, source?: string): Compiler {
        return new Compiler(Parser.fromString(input, source));
    }
}

export namespace Compiler {
    export class Exception extends BaseException {
        constructor(message: string, parameters?: ExceptionParameters) {
            super("CompilerException", message, parameters);
        }
    }
    export interface Node {
        children: Node[];
    }
}
