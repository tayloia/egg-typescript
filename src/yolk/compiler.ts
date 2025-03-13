import { BaseException, ExceptionParameters } from "./exception";
import { Logger } from "./logger";
import { Parser } from "./parser";
import { Module } from "./program";

enum Kind {
    Module = "module",
    StmtCall = "stmt-call",
    LiteralIdentifier = "literal-identifier",
    LiteralString = "literal-string",
}

class Node implements Compiler.Node {
    constructor(public readonly kind: Kind, public readonly children: Node[] = []) {}
    value?: string | number | boolean | null;
}

class Impl extends Logger {
    constructor(public input: Parser.Node, public source: string, public logger: Logger) {
        super();
    }
    compileModule(): Module {
        const root = new Node(Kind.Module);
        root.children.push(new Node(Kind.StmtCall));
        return new Module(root, this.source);
    }
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
}

export class Compiler {
    constructor(public parser: Parser) {
    }
    compile(): Module {
        const parsed = this.parser.parse();
        const impl = new Impl(parsed, this.parser.input.source, this.logger);
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
