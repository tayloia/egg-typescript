import { assert } from "./assertion";
import { Logger } from "./logger";
import { Location } from "./location";
import { Parser } from "./parser";
import { Value } from "./value";

class Node implements Compiler.INode {
    constructor(public location: Location, public kind: Compiler.Kind, public children: Compiler.INode[] = [], public value: Value = Value.VOID) {}
}

class Module implements Compiler.IModule {
    constructor(public readonly root: Node) {}
    get source(): string {
        return this.root.location.source;
    }
}

class Impl extends Logger {
    constructor(public input: Parser.INode, public logger: Logger) {
        super();
    }
    compileModule(): Module {
        const stmts = this.input.children.map(child => this.compileStmt(child));
        const root = new Node(this.input.location, Compiler.Kind.Module, stmts);
        return new Module(root);
    }
    compileStmt(pnode: Parser.INode): Node {
        switch (pnode.kind) {
            case Parser.Kind.Variable:
                if (pnode.children.length === 1) {
                    return new Node(pnode.location, Compiler.Kind.StmtVariableDeclare, [this.compileType(pnode.children[0])], pnode.value)
                }
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Compiler.Kind.StmtVariableDefine, [this.compileType(pnode.children[0]), this.compileExpr(pnode.children[1])], pnode.value)
            case Parser.Kind.Function:
                assert.eq(pnode.children.length, 3);
                return new Node(pnode.location, Compiler.Kind.StmtFunctionDefine, [this.compileType(pnode.children[0]), this.compileStmtFunctionParameters(pnode.children[1]), this.compileStmt(pnode.children[2])], pnode.value)
            case Parser.Kind.FunctionCall:
                assert.eq(pnode.children.length, 2);
                return this.compileStmtFunctionCall(pnode.children[0], pnode.children[1]);
            case Parser.Kind.StatementBlock:
                return new Node(pnode.location, Compiler.Kind.StmtBlock, pnode.children.map(child => this.compileStmt(child)));
            case Parser.Kind.StatementIf:
                if (pnode.children.length === 2) {
                    return new Node(pnode.location, Compiler.Kind.StmtIf, [this.compileExpr(pnode.children[0]), this.compileStmt(pnode.children[1])]);
                }
                assert.eq(pnode.children.length, 3);
                return new Node(pnode.location, Compiler.Kind.StmtIf, [this.compileExpr(pnode.children[0]), this.compileStmt(pnode.children[1]), this.compileStmt(pnode.children[2])]);
            case Parser.Kind.StatementReturn:
                assert.eq(pnode.children.length, 1);
                return new Node(pnode.location, Compiler.Kind.StmtReturn, [this.compileExpr(pnode.children[0])]);
            case Parser.Kind.StatementTry:
                if (pnode.value.asBoolean()) {
                    assert.ge(pnode.children.length, 2);
                    return this.compileStmtTry(pnode.location, pnode.children[0], pnode.children.slice(1, -1), pnode.children[pnode.children.length - 1]);
                }
                assert.ge(pnode.children.length, 1);
                return this.compileStmtTry(pnode.location, pnode.children[0], pnode.children.slice(1), undefined);
            case Parser.Kind.StatementCatch:
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Compiler.Kind.StmtCatch, [this.compileType(pnode.children[0]), this.compileStmt(pnode.children[1])], pnode.value);
            case Parser.Kind.StatementAssign:
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Compiler.Kind.StmtAssign, [this.compileTarget(pnode.location, pnode.children[0]), this.compileExpr(pnode.children[1])]);
            case Parser.Kind.StatementMutate:
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Compiler.Kind.StmtMutate, [this.compileTarget(pnode.location, pnode.children[0]), this.compileExpr(pnode.children[1])], pnode.value);
            case Parser.Kind.StatementNudge:
                assert.eq(pnode.children.length, 1);
                return new Node(pnode.location, Compiler.Kind.StmtNudge, [this.compileTarget(pnode.location, pnode.children[0])], pnode.value);
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
    compileStmtFunctionParameters(parameters: Parser.INode): Node {
        assert.eq(parameters.kind, Parser.Kind.FunctionParameters);
        return new Node(parameters.location, Compiler.Kind.FunctionParameters, parameters.children.map(child => this.compileStmtFunctionParameter(child)), parameters.value);
    }
    compileStmtFunctionParameter(parameter: Parser.INode): Node {
        assert.eq(parameter.kind, Parser.Kind.FunctionParameter);
        assert.eq(parameter.children.length, 1);
        return new Node(parameter.location, Compiler.Kind.FunctionParameter, [this.compileType(parameter.children[0])], parameter.value);
    }
    compileStmtFunctionCall(callee: Parser.INode, args: Parser.INode): Node {
        if (callee.kind === Parser.Kind.Identifier && callee.value.asString() === "assert") {
            assert.eq(args.kind, Parser.Kind.FunctionArguments);
            assert.eq(args.children.length, 1);
            return this.compileStmtAssert(args.children[0]);
        }
        const children = [this.compileExpr(callee), ...this.compileExprArguments(args)];
        const location = children[0].location.span(children[children.length - 1].location);
        return new Node(location, Compiler.Kind.StmtCall, children);
    }
    compileStmtAssert(assertion: Parser.INode): Node {
        if (assertion.kind === Parser.Kind.OperatorUnary) {
            assert.eq(assertion.children.length, 1);
            const children = [this.compileExpr(assertion.children[0])];
            return new Node(assertion.location, Compiler.Kind.StmtAssert, children, assertion.value);    
        }
        if (assertion.kind === Parser.Kind.OperatorBinary) {
            assert.eq(assertion.children.length, 2);
            const children = [this.compileExpr(assertion.children[0]), this.compileExpr(assertion.children[1])];
            return new Node(assertion.location, Compiler.Kind.StmtAssert, children, assertion.value);    
        }
        return new Node(assertion.location, Compiler.Kind.StmtAssert, [this.compileExpr(assertion)]);
    }
    compileStmtTry(location: Location, tryBlock: Parser.INode, catchClauses: Parser.INode[], finallyClause: Parser.INode | undefined): Node {
        const children = [this.compileStmt(tryBlock)];
        for (const catchClause of catchClauses) {
            children.push(this.compileStmt(catchClause));
        }
        if (finallyClause) {
            children.push(this.compileStmt(finallyClause));
            return new Node(location, Compiler.Kind.StmtTry, children, Value.TRUE);
        }
        return new Node(location, Compiler.Kind.StmtTry, children, Value.FALSE);
    }
    compileType(pnode: Parser.INode): Node {
        switch (pnode.kind) {
            case Parser.Kind.TypeInfer:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Compiler.Kind.TypeInfer, [], pnode.value);
            case Parser.Kind.TypeKeyword:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Compiler.Kind.TypeKeyword, [], pnode.value);
            case Parser.Kind.TypeNullable:
                assert.eq(pnode.children.length, 1);
                return new Node(pnode.location, Compiler.Kind.TypeNullable, [this.compileType(pnode.children[0])]);
        }
        assert.fail("Unknown node kind in compileType: {kind}", {kind:pnode.kind});
    }
    compileTarget(location: Location, pnode: Parser.INode): Node {
        switch (pnode.kind) {
            case Parser.Kind.Identifier:
                assert.eq(pnode.children.length, 0);
                return new Node(location, Compiler.Kind.TargetVariable, [], pnode.value);
            case Parser.Kind.PropertyAccess:
                assert.eq(pnode.children.length, 2);
                return new Node(location, Compiler.Kind.TargetProperty, [this.compileExpr(pnode.children[0]), this.compilePropertyIdentifier(pnode.children[1])]);
            case Parser.Kind.IndexAccess:
                assert.eq(pnode.children.length, 2);
                return new Node(location, Compiler.Kind.TargetIndex, [this.compileExpr(pnode.children[0]), this.compileExpr(pnode.children[1])]);
        }
        assert.fail("Unknown node kind in compileTarget: {kind}", {kind:pnode.kind});
    }
    compilePropertyIdentifier(pnode: Parser.INode): Node {
        assert.eq(pnode.kind, Parser.Kind.Identifier);
        return new Node(pnode.location, Compiler.Kind.ValueScalar, [], pnode.value);
    }
    compileExpr(pnode: Parser.INode): Node {
        switch (pnode.kind) {
            case Parser.Kind.Identifier:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Compiler.Kind.ValueVariableGet, [], pnode.value);
            case Parser.Kind.Named:
                assert.eq(pnode.children.length, 1);
                return new Node(pnode.location, Compiler.Kind.ValueNamed, [this.compileExpr(pnode.children[0])], pnode.value);
            case Parser.Kind.LiteralScalar:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Compiler.Kind.ValueScalar, [], pnode.value);
            case Parser.Kind.LiteralArray:
                return new Node(pnode.location, Compiler.Kind.ValueArray, pnode.children.map(element => this.compileExpr(element)));
            case Parser.Kind.LiteralObject:
                return new Node(pnode.location, Compiler.Kind.ValueObject, pnode.children.map(element => this.compileExpr(element)));
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
            case Parser.Kind.OperatorTernary:
                assert.eq(pnode.children.length, 3);
                return this.compileExprTernary(pnode.children[0], pnode.children[1], pnode.children[2]);
        }
        assert.fail("Unknown node kind in compileExpr: {kind}", {kind:pnode.kind});
    }
    compileExprFunctionCall(callee: Parser.INode, args: Parser.INode): Node {
        const children = [this.compileExpr(callee), ...this.compileExprArguments(args)];
        const location = children[0].location.span(children[children.length - 1].location);
        return new Node(location, Compiler.Kind.ValueCall, children);
    }
    compileExprIndexGet(instance: Parser.INode, index: Parser.INode): Node {
        const children = [this.compileExpr(instance), this.compileExpr(index)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Compiler.Kind.ValueIndexGet, children);
    }
    compileExprPropertyGet(instance: Parser.INode, property: Parser.INode): Node {
        assert.eq(property.kind, Parser.Kind.Identifier);
        const children = [this.compileExpr(instance), this.compilePropertyIdentifier(property)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Compiler.Kind.ValuePropertyGet, children);
    }
    compileExprBinary(plhs: Parser.INode, op: string, prhs: Parser.INode): Node {
        const children = [this.compileExpr(plhs), this.compileExpr(prhs)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Compiler.Kind.ValueOperatorBinary, children, Value.fromString(op));
    }
    compileExprTernary(plhs: Parser.INode, pmid: Parser.INode, prhs: Parser.INode): Node {
        const children = [this.compileExpr(plhs), this.compileExpr(pmid), this.compileExpr(prhs)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Compiler.Kind.ValueOperatorTernary, children);
    }
    compileExprArguments(pnode: Parser.INode): Node[] {
        assert.eq(pnode.kind, Parser.Kind.FunctionArguments);
        return pnode.children.map(child => this.compileExpr(child));
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
        StmtAssert = "stmt-assert",
        StmtIf = "stmt-if",
        StmtReturn = "stmt-return",
        StmtTry = "stmt-try",
        StmtCatch = "stmt-catch",
        StmtCall = "stmt-call",
        StmtAssign = "stmt-assign",
        StmtMutate = "stmt-mutate",
        StmtNudge = "stmt-nudge",
        StmtForeach = "stmt-foreach",
        StmtForloop = "stmt-forloop",
        StmtVariableDeclare = "stmt-variable-declare",
        StmtVariableDefine = "stmt-variable-define",
        StmtFunctionDefine = "stmt-function-define",
        FunctionParameters = "function-parameters",
        FunctionParameter = "function-parameter",
        TargetVariable = "target-variable",
        TargetProperty = "target-property",
        TargetIndex = "target-index",
        TypeInfer = "type-infer",
        TypeKeyword = "type-keyword",
        TypeNullable = "type-nullable",
        ValueNamed = "value-named",
        ValueScalar = "value-scalar",
        ValueArray = "value-array",
        ValueObject = "value-object",
        ValueCall = "value-call",
        ValueVariableGet = "value-variable-get",
        ValuePropertyGet = "value-property-get",
        ValueIndexGet = "value-index-get",
        ValueOperatorUnary = "value-operator-unary",
        ValueOperatorBinary = "value-operator-binary",
        ValueOperatorTernary = "value-operator-ternary",
    }
    export interface INode {
        kind: Kind;
        children: INode[];
        value: Value;
        location: Location;
    }
    export interface IModule {
        root: INode;
        readonly source: string;
    }
}
