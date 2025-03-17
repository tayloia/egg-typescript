import { assert } from "./assertion";
import { BaseException, ExceptionOrigin, ExceptionParameters } from "./exception";
import { Logger } from "./logger";
import { Parser } from "./parser";
import { Program } from "./program";
import { Value } from "./value";

class Node implements Compiler.Node {
    constructor(public location: Program.Location, public kind: Compiler.Kind, public children: Compiler.Node[] = [], public value: Value = Value.VOID) {}
}

class Module implements Compiler.Module {
    constructor(public readonly root: Node) {}
    get source(): string {
        return this.root.location.source;
    }
}

class Impl extends Logger {
    constructor(public input: Parser.Node, public logger: Logger) {
        super();
    }
    compileModule(): Module {
        const statements = this.input.children.map(child => this.compileModuleStatement(child));
        const root = new Node(this.input.location, Compiler.Kind.Module, statements);
        return new Module(root);
    }
    compileModuleStatement(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.FunctionCall:
                return new Node(pnode.location, Compiler.Kind.StmtCall, [this.compileExpr(pnode.children[0]), ...this.compileExprArguments(pnode.children[1])])
            case Parser.Kind.Variable:
                switch (pnode.children.length) {
                    case 1:
                        return new Node(pnode.location, Compiler.Kind.StmtVariableDeclare, [this.compileType(pnode.children[0])], pnode.value)
                    case 2:
                        return new Node(pnode.location, Compiler.Kind.StmtVariableDefine, [this.compileType(pnode.children[0]), this.compileExpr(pnode.children[1])], pnode.value)
                }
                assert.fail("Invalid number of children for Parser.Kind.Variable: {length}", {length:pnode.children.length});
        }
        assert.fail("Unknown node kind in compileModuleStatement: {kind}", {kind:pnode.kind});
    }
    compileType(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.TypeInfer:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Compiler.Kind.TypeInfer, [], pnode.value);
            case Parser.Kind.TypeKeyword:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Compiler.Kind.TypeKeyword, [], pnode.value);
            case undefined:
                break;
        }
        assert.fail("Unknown node kind in compileType: {kind}", {kind:pnode.kind});
    }
    compileExpr(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.Identifier:
                return new Node(pnode.location, Compiler.Kind.Identifier, [], pnode.value);
            case Parser.Kind.Literal:
                return new Node(pnode.location, Compiler.Kind.ValueLiteral, [], pnode.value);
            case Parser.Kind.FunctionCall:
                return this.compileExprFunctionCall(pnode.children[0], pnode.children[1]);
            case Parser.Kind.OperatorBinary:
                return this.compileExprBinary(pnode.children[0], pnode.value.getString(), pnode.children[1]);
        }
        assert.fail("Unknown node kind in compileExpr: {kind}", {kind:pnode.kind});
    }
    compileExprFunctionCall(callee: Parser.Node, args: Parser.Node): Node {
        const children = [this.compileExpr(callee), ...this.compileExprArguments(args)];
        const location = children[0].location.span(children[children.length - 1].location);
        return new Node(location, Compiler.Kind.ValueCall, children);
    }
    compileExprBinary(plhs: Parser.Node, op: string, prhs: Parser.Node): Node {
        return new Node(plhs.location, Compiler.Kind.ValueOperatorBinary, [this.compileExpr(plhs), this.compileExpr(prhs)], Value.fromString(op));
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
        const impl = new Impl(parsed, this.logger);
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
            super("CompilerException", ExceptionOrigin.Compiler, message, parameters);
        }
    }
    export enum Kind {
        Module = "module",
        StmtCall = "stmt-call",
        StmtVariableDeclare = "stmt-variable-declare",
        StmtVariableDefine = "stmt-variable-define",
        Identifier = "identifier",
        TypeInfer = "type-infer",
        TypeKeyword = "type-keyword",
        ValueLiteral = "value-literal",
        ValueCall = "value-call",
        ValueOperatorBinary = "value-operator-binary",
    }
    export interface Node {
        kind: Kind;
        children: Node[];
        value: Value;
        location: Program.Location;
    }
    export interface Module {
        root: Node;
        readonly source: string;
    }
}
