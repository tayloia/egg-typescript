import { assert } from "./assertion";
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
    constructor(public readonly kind: Kind, public readonly children: Node[] = [], public readonly value?: string | number | boolean) {}
}

class Impl extends Logger {
    constructor(public input: Parser.Node, public source: string, public logger: Logger) {
        super();
    }
    compileModule(): Module {
        const statements = this.input.children.map(child => this.compileModuleStatement(child));
        const root = new Node(Kind.Module, statements);
        return new Module(root, this.source);
    }
    compileModuleStatement(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.FunctionCall:
                return new Node(Kind.StmtCall, [this.compileExpr(pnode.children[0]), ...this.compileExprArguments(pnode.children[1])])
            case undefined:
                break;
        }
        assert.fail("Unknown node kind in compileModuleStatement: {kind}", {kind:pnode.kind});
    }
    compileExpr(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.Identifier:
                return new Node(Kind.LiteralIdentifier, [], pnode.value);
            case Parser.Kind.StringLiteral:
                return new Node(Kind.LiteralString, [], pnode.value);
            case undefined:
                break;
        }
        assert.fail("Unknown node kind in compileExpr: {kind}", {kind:pnode.kind});
    }
    compileExprArguments(pnode: Parser.Node): Node[] {
        assert.eq(pnode.kind, Parser.Kind.FunctionArguments);
        return pnode.children.map(child => this.compileExprArgument(child));
    }
    compileExprArgument(pnode: Parser.Node): Node {
        return this.compileExpr(pnode);
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
