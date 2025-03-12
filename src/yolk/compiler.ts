import { BaseException, ExceptionParameters } from "./exception";
import { Logger } from "./logger";
import { Parser } from "./parser";

class Impl extends Logger {
    warnings = 0;
    errors = 0;
    constructor(public input: Parser.Node, public logger: Logger) {
        super();
    }
    compileModule(): Compiler.Node {
        return {} as Compiler.Node;
    }
    log(entry: Logger.Entry): void {
        switch (entry.severity) {
            case Logger.Severity.Error:
                this.errors++;
                break;
            case Logger.Severity.Warning:
                this.warnings++;
                break;
        }
        this.logger.log(entry);
    }
}

export class Compiler {
    parsed?: Parser.Node;
    constructor(public parser: Parser) {
    }
    compile(): Compiler.Node {
        this.parsed = this.parser.parse();
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
    export interface Output {
        warnings: number;
        errors: number;
        root: Node;
    }
}
