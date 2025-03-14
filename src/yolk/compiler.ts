import { assert } from "./assertion";
import { BaseException, ExceptionParameters } from "./exception";
import { Logger } from "./logger";
import { Parser } from "./parser";

class Node implements Compiler.Node {
    constructor(public kind: Compiler.Kind, public children: Compiler.Node[] = [], public value: string | number | boolean | undefined = undefined) {}
}

class Module implements Compiler.Module {
    constructor(public readonly root: Node, public readonly source: string) {}
}

class Impl extends Logger {
    constructor(public input: Parser.Node, public source: string, public logger: Logger) {
        super();
    }
    compileModule(): Module {
        const statements = this.input.children.map(child => this.compileModuleStatement(child));
        const root = new Node(Compiler.Kind.Module, statements);
        return new Module(root, this.source);
    }
    compileModuleStatement(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.FunctionCall:
                return new Node(Compiler.Kind.StmtCall, [this.compileExpr(pnode.children[0]), ...this.compileExprArguments(pnode.children[1])])
            case undefined:
                break;
        }
        assert.fail("Unknown node kind in compileModuleStatement: {kind}", {kind:pnode.kind});
    }
    compileExpr(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.Identifier:
                return new Node(Compiler.Kind.LiteralIdentifier, [], pnode.value);
            case Parser.Kind.LiteralBoolean:
                return new Node(Compiler.Kind.LiteralBoolean, [], pnode.value);
            case Parser.Kind.LiteralInteger:
                return new Node(Compiler.Kind.LiteralInteger, [], pnode.value);
            case Parser.Kind.LiteralFloat:
                return new Node(Compiler.Kind.LiteralFloat, [], pnode.value);
            case Parser.Kind.LiteralString:
                return new Node(Compiler.Kind.LiteralString, [], pnode.value);
            case Parser.Kind.OperatorBinary:
                return this.compileExprBinary(pnode.children[0], pnode.value as string, pnode.children[1]);
            case undefined:
                break;
        }
        assert.fail("Unknown node kind in compileExpr: {kind}", {kind:pnode.kind});
    }
    compileExprBinary(plhs: Parser.Node, op: string, prhs: Parser.Node): Node {
        return new Node(Compiler.Kind.ValueOperatorBinary, [this.compileExpr(plhs), this.compileExpr(prhs)], op);
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
    export enum Kind {
        Module = "module",
        StmtCall = "stmt-call",
        LiteralIdentifier = "literal-identifier",
        LiteralBoolean = "literal-boolean",
        LiteralInteger = "literal-integer",
        LiteralFloat = "literal-float",
        LiteralString = "literal-string",
        ValueOperatorBinary = "value-operator-binary",
    }
    export interface Node {
        kind: Kind;
        children: Node[];
        value: string | number | boolean | undefined;
    }
    export interface Module {
        root: Node;
        source: string;
    }
}
