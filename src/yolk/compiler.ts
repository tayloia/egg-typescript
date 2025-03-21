import { assert } from "./assertion";
import { Logger } from "./logger";
import { Location } from "./location";
import { Parser } from "./parser";
import { Value } from "./value";

class Node implements Compiler.Node {
    constructor(public location: Location, public kind: Compiler.Kind, public children: Compiler.Node[] = [], public value: Value = Value.VOID) {}
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
        const stmts = this.input.children.map(child => this.compileStmt(child));
        const root = new Node(this.input.location, Compiler.Kind.Module, stmts);
        return new Module(root);
    }
    compileStmt(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.Variable:
                switch (pnode.children.length) {
                    case 1:
                        return new Node(pnode.location, Compiler.Kind.StmtVariableDeclare, [this.compileType(pnode.children[0])], pnode.value)
                    case 2:
                        return new Node(pnode.location, Compiler.Kind.StmtVariableDefine, [this.compileType(pnode.children[0]), this.compileExpr(pnode.children[1])], pnode.value)
                }
                assert.fail("Invalid number of children for Parser.Kind.Variable: {length}", {length:pnode.children.length});
                // eslint-disable-next-line no-fallthrough
            case Parser.Kind.FunctionCall:
                return this.compileStmtFunctionCall(pnode.children[0], pnode.children[1]);
            case Parser.Kind.StatementBlock:
                return new Node(pnode.location, Compiler.Kind.StmtBlock, pnode.children.map(child => this.compileStmt(child)));
            case Parser.Kind.StatementAssign:
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Compiler.Kind.StmtAssign, [this.compileTarget(pnode.children[0]), this.compileExpr(pnode.children[1])]);
            case Parser.Kind.StatementMutate:
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Compiler.Kind.StmtMutate, [this.compileTarget(pnode.children[0]), this.compileExpr(pnode.children[1])], pnode.value);
            case Parser.Kind.StatementNudge:
                assert.eq(pnode.children.length, 1);
                return new Node(pnode.location, Compiler.Kind.StmtNudge, [this.compileTarget(pnode.children[0])], pnode.value);
            case Parser.Kind.StatementForeach:
                assert.eq(pnode.children.length, 3);
                return new Node(pnode.location, Compiler.Kind.StmtForeach, [
                    this.compileType(pnode.children[0]),
                    this.compileExpr(pnode.children[1]),
                    this.compileStmt(pnode.children[2]),
                ], pnode.value);
            case Parser.Kind.StatementForloop:
                assert.eq(pnode.children.length, 4);
                return new Node(pnode.location, Compiler.Kind.StmtForloop, [
                    this.compileStmt(pnode.children[0]),
                    this.compileExpr(pnode.children[1]),
                    this.compileStmt(pnode.children[2]),
                    this.compileStmt(pnode.children[3]),
                ]);
        }
        assert.fail("Unknown node kind in compileStmt: {kind}", {kind:pnode.kind});
    }
    compileStmtFunctionCall(callee: Parser.Node, args: Parser.Node): Node {
        const predicate = callee.kind === Parser.Kind.Identifier && callee.value.asString() === "assert";
        const children = [this.compileExpr(callee), ...this.compileExprArguments(args, predicate)];
        const location = children[0].location.span(children[children.length - 1].location);
        return new Node(location, Compiler.Kind.StmtCall, children);
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
    compileTarget(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.Identifier:
                return new Node(pnode.location, Compiler.Kind.Identifier, [], pnode.value);
        }
        assert.fail("Unknown node kind in compileTarget: {kind}", {kind:pnode.kind});
    }
    compileExpr(pnode: Parser.Node): Node {
        switch (pnode.kind) {
            case Parser.Kind.Identifier:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Compiler.Kind.Identifier, [], pnode.value);
            case Parser.Kind.LiteralScalar:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Compiler.Kind.ValueScalar, [], pnode.value);
            case Parser.Kind.LiteralArray:
                return new Node(pnode.location, Compiler.Kind.ValueArray, pnode.children.map(element => this.compileExpr(element)));
            case Parser.Kind.TypeKeyword:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Compiler.Kind.TypeKeyword, [], pnode.value);
            case Parser.Kind.PropertyAccess:
                assert.eq(pnode.children.length, 2);
                return this.compileExprPropertyGet(pnode.children[0], pnode.children[1]);
            case Parser.Kind.IndexAccess:
                assert.eq(pnode.children.length, 2);
                return this.compileExprIndexGet(pnode.children[0], pnode.children[1]);
            case Parser.Kind.FunctionCall:
                assert.eq(pnode.children.length, 2);
                return this.compileExprFunctionCall(pnode.children[0], pnode.children[1]);
            case Parser.Kind.OperatorBinary:
                assert.eq(pnode.children.length, 2);
                return this.compileExprBinary(pnode.children[0], pnode.value.asString(), pnode.children[1]);
        }
        assert.fail("Unknown node kind in compileExpr: {kind}", {kind:pnode.kind});
    }
    compileExprFunctionCall(callee: Parser.Node, args: Parser.Node): Node {
        const children = [this.compileExpr(callee), ...this.compileExprArguments(args, false)];
        const location = children[0].location.span(children[children.length - 1].location);
        return new Node(location, Compiler.Kind.ValueCall, children);
    }
    compileExprIndexGet(instance: Parser.Node, index: Parser.Node): Node {
        const children = [this.compileExpr(instance), this.compileExpr(index)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Compiler.Kind.ValueIndexGet, children);
    }
    compileExprPropertyGet(instance: Parser.Node, property: Parser.Node): Node {
        const children = [this.compileExpr(instance), this.compileExpr(property)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Compiler.Kind.ValuePropertyGet, children);
    }
    compileExprBinary(plhs: Parser.Node, op: string, prhs: Parser.Node): Node {
        const children = [this.compileExpr(plhs), this.compileExpr(prhs)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Compiler.Kind.ValueOperatorBinary, children, Value.fromString(op));
    }
    compileExprArguments(pnode: Parser.Node, predicate: boolean): Node[] {
        assert.eq(pnode.kind, Parser.Kind.FunctionArguments);
        return pnode.children.map(child => this.compileExprArgument(child, predicate));
    }
    compileExprArgument(pnode: Parser.Node, predicate: boolean): Node {
        const expr = this.compileExpr(pnode);
        if (predicate) {
            return new Node(expr.location, Compiler.Kind.ValuePredicate, [expr]);
        }
        return expr;
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
    export enum Kind {
        Module = "module",
        StmtBlock = "stmt-block",
        StmtCall = "stmt-call",
        StmtAssign = "stmt-assign",
        StmtMutate = "stmt-mutate",
        StmtNudge = "stmt-nudge",
        StmtForeach = "stmt-foreach",
        StmtForloop = "stmt-forloop",
        StmtVariableDeclare = "stmt-variable-declare",
        StmtVariableDefine = "stmt-variable-define",
        Identifier = "identifier",
        TypeInfer = "type-infer",
        TypeKeyword = "type-keyword",
        ValueScalar = "value-scalar",
        ValueArray = "value-array",
        ValueCall = "value-call",
        ValuePropertyGet = "value-property-get",
        ValueIndexGet = "value-index-get",
        ValueOperatorBinary = "value-operator-binary",
        ValuePredicate = "value-predicate",
    }
    export interface Node {
        kind: Kind;
        children: Node[];
        value: Value;
        location: Location;
    }
    export interface Module {
        root: Node;
        readonly source: string;
    }
}
