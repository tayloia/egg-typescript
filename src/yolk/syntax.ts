import { assert } from "./assertion";
import { Logger } from "./logger";
import { Location } from "./location";
import { Parser } from "./parser";
import { Value } from "./value";

class Node implements Syntax.INode {
    constructor(public location: Location, public kind: Syntax.Kind, public children: Syntax.INode[] = [], public value: Value = Value.VOID) {}
}

class Module implements Syntax.IModule {
    constructor(public readonly root: Node) {}
    get source(): string {
        return this.root.location.source;
    }
}

class Impl extends Logger {
    constructor(public input: Parser.INode, public logger: Logger) {
        super();
    }
    syntaxModule(): Module {
        const stmts = this.input.children.map(child => this.syntaxStmt(child));
        const root = new Node(this.input.location, Syntax.Kind.Module, stmts);
        return new Module(root);
    }
    syntaxStmt(pnode: Parser.INode): Node {
        switch (pnode.kind) {
            case Parser.Kind.Variable:
                if (pnode.children.length === 1) {
                    return new Node(pnode.location, Syntax.Kind.StmtVariableDeclare, [this.syntaxType(pnode.children[0])], pnode.value)
                }
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Syntax.Kind.StmtVariableDefine, [this.syntaxType(pnode.children[0]), this.syntaxExpr(pnode.children[1])], pnode.value)
            case Parser.Kind.Function:
                assert.eq(pnode.children.length, 3);
                return new Node(pnode.location, Syntax.Kind.StmtFunctionDefine, [this.syntaxType(pnode.children[0]), this.syntaxStmtFunctionParameters(pnode.children[1]), this.syntaxStmt(pnode.children[2])], pnode.value)
            case Parser.Kind.FunctionCall:
                assert.eq(pnode.children.length, 2);
                return this.syntaxStmtFunctionCall(pnode.children[0], pnode.children[1]);
            case Parser.Kind.StatementBlock:
                return new Node(pnode.location, Syntax.Kind.StmtBlock, pnode.children.map(child => this.syntaxStmt(child)));
            case Parser.Kind.StatementIf:
                return this.syntaxStmtIf(pnode);
            case Parser.Kind.StatementReturn:
                assert.le(pnode.children.length, 1);
                return new Node(pnode.location, Syntax.Kind.StmtReturn, pnode.children.map(child => this.syntaxExpr(child)));
            case Parser.Kind.StatementTry:
                if (pnode.value.asBoolean()) {
                    assert.ge(pnode.children.length, 2);
                    return this.syntaxStmtTry(pnode.location, pnode.children[0], pnode.children.slice(1, -1), pnode.children[pnode.children.length - 1]);
                }
                assert.ge(pnode.children.length, 1);
                return this.syntaxStmtTry(pnode.location, pnode.children[0], pnode.children.slice(1), undefined);
            case Parser.Kind.StatementCatch:
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Syntax.Kind.StmtCatch, [this.syntaxType(pnode.children[0]), this.syntaxStmt(pnode.children[1])], pnode.value);
            case Parser.Kind.StatementAssign:
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Syntax.Kind.StmtAssign, [this.syntaxTarget(pnode.location, pnode.children[0]), this.syntaxExpr(pnode.children[1])]);
            case Parser.Kind.StatementMutate:
                assert.eq(pnode.children.length, 2);
                return new Node(pnode.location, Syntax.Kind.StmtMutate, [this.syntaxTarget(pnode.location, pnode.children[0]), this.syntaxExpr(pnode.children[1])], pnode.value);
            case Parser.Kind.StatementNudge:
                assert.eq(pnode.children.length, 1);
                return new Node(pnode.location, Syntax.Kind.StmtNudge, [this.syntaxTarget(pnode.location, pnode.children[0])], pnode.value);
            case Parser.Kind.StatementForeach:
                assert.eq(pnode.children.length, 3);
                return new Node(pnode.location, Syntax.Kind.StmtForeach, [
                    this.syntaxType(pnode.children[0]),
                    this.syntaxExpr(pnode.children[1]),
                    this.syntaxStmt(pnode.children[2]),
                ], pnode.value);
            case Parser.Kind.StatementForloop:
                assert.eq(pnode.children.length, 4);
                return new Node(pnode.location, Syntax.Kind.StmtForloop, [
                    this.syntaxStmt(pnode.children[0]),
                    this.syntaxExpr(pnode.children[1]),
                    this.syntaxStmt(pnode.children[2]),
                    this.syntaxStmt(pnode.children[3]),
                ]);
        }
        assert.fail("Unknown node kind in syntaxStmt: {kind}", {kind:pnode.kind});
    }
    syntaxStmtFunctionParameters(parameters: Parser.INode): Node {
        assert.eq(parameters.kind, Parser.Kind.FunctionParameters);
        return new Node(parameters.location, Syntax.Kind.FunctionParameters, parameters.children.map(child => this.syntaxStmtFunctionParameter(child)), parameters.value);
    }
    syntaxStmtFunctionParameter(parameter: Parser.INode): Node {
        assert.eq(parameter.kind, Parser.Kind.FunctionParameter);
        assert.eq(parameter.children.length, 1);
        return new Node(parameter.location, Syntax.Kind.FunctionParameter, [this.syntaxType(parameter.children[0])], parameter.value);
    }
    syntaxStmtFunctionCall(callee: Parser.INode, args: Parser.INode): Node {
        if (callee.kind === Parser.Kind.Identifier && callee.value.asString() === "assert") {
            assert.eq(args.kind, Parser.Kind.FunctionArguments);
            assert.eq(args.children.length, 1);
            return this.syntaxStmtAssert(args.children[0]);
        }
        const children = [this.syntaxExpr(callee), ...this.syntaxExprArguments(args)];
        const location = children[0].location.span(children[children.length - 1].location);
        return new Node(location, Syntax.Kind.StmtCall, children);
    }
    syntaxStmtAssert(assertion: Parser.INode): Node {
        if (assertion.kind === Parser.Kind.OperatorUnary) {
            assert.eq(assertion.children.length, 1);
            const children = [this.syntaxExpr(assertion.children[0])];
            return new Node(assertion.location, Syntax.Kind.StmtAssert, children, assertion.value);    
        }
        if (assertion.kind === Parser.Kind.OperatorBinary) {
            assert.eq(assertion.children.length, 2);
            const children = [this.syntaxExpr(assertion.children[0]), this.syntaxExpr(assertion.children[1])];
            return new Node(assertion.location, Syntax.Kind.StmtAssert, children, assertion.value);    
        }
        return new Node(assertion.location, Syntax.Kind.StmtAssert, [this.syntaxExpr(assertion)]);
    }
    syntaxStmtIf(pnode: Parser.INode): Node {
        assert.eq(pnode.kind, Parser.Kind.StatementIf);
        assert.ge(pnode.children.length, 2);
        assert.le(pnode.children.length, 3);
        let node;
        if (pnode.children[0].kind === Parser.Kind.Guard) {
            const guard = pnode.children[0];
            assert.eq(guard.children.length, 2);
            node = new Node(pnode.location, Syntax.Kind.StmtIfGuard, [this.syntaxType(guard.children[0]), this.syntaxExpr(guard.children[1])], guard.value);
        } else {
            node = new Node(pnode.location, Syntax.Kind.StmtIf, [this.syntaxExpr(pnode.children[0])]);
        }
        node.children.push(this.syntaxStmt(pnode.children[1]));
        if (pnode.children.length > 2) {
            node.children.push(this.syntaxStmt(pnode.children[2]));
        }
        return node;
    }
    syntaxStmtTry(location: Location, tryBlock: Parser.INode, catchClauses: Parser.INode[], finallyClause: Parser.INode | undefined): Node {
        const children = [this.syntaxStmt(tryBlock)];
        for (const catchClause of catchClauses) {
            children.push(this.syntaxStmt(catchClause));
        }
        if (finallyClause) {
            children.push(this.syntaxStmt(finallyClause));
            return new Node(location, Syntax.Kind.StmtTry, children, Value.TRUE);
        }
        return new Node(location, Syntax.Kind.StmtTry, children, Value.FALSE);
    }
    syntaxGuard(pnode: Parser.INode): Node {
        assert.eq(pnode.children.length, 2);
        return new Node(pnode.location, Syntax.Kind.StmtIfGuard, [this.syntaxType(pnode.children[0]), this.syntaxExpr(pnode.children[1])], pnode.value)
    }
    syntaxType(pnode: Parser.INode): Node {
        switch (pnode.kind) {
            case Parser.Kind.TypeInfer:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Syntax.Kind.TypeInfer, [], pnode.value);
            case Parser.Kind.TypeKeyword:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Syntax.Kind.TypeKeyword, [], pnode.value);
            case Parser.Kind.TypeNullable:
                assert.eq(pnode.children.length, 1);
                return new Node(pnode.location, Syntax.Kind.TypeNullable, [this.syntaxType(pnode.children[0])]);
        }
        assert.fail("Unknown node kind in syntaxType: {kind}", {kind:pnode.kind});
    }
    syntaxTarget(location: Location, pnode: Parser.INode): Node {
        switch (pnode.kind) {
            case Parser.Kind.Identifier:
                assert.eq(pnode.children.length, 0);
                return new Node(location, Syntax.Kind.TargetVariable, [], pnode.value);
            case Parser.Kind.PropertyAccess:
                assert.eq(pnode.children.length, 2);
                return new Node(location, Syntax.Kind.TargetProperty, [this.syntaxExpr(pnode.children[0]), this.syntaxPropertyIdentifier(pnode.children[1])]);
            case Parser.Kind.IndexAccess:
                assert.eq(pnode.children.length, 2);
                return new Node(location, Syntax.Kind.TargetIndex, [this.syntaxExpr(pnode.children[0]), this.syntaxExpr(pnode.children[1])]);
        }
        assert.fail("Unknown node kind in syntaxTarget: {kind}", {kind:pnode.kind});
    }
    syntaxPropertyIdentifier(pnode: Parser.INode): Node {
        assert.eq(pnode.kind, Parser.Kind.Identifier);
        return new Node(pnode.location, Syntax.Kind.ValueScalar, [], pnode.value);
    }
    syntaxExpr(pnode: Parser.INode): Node {
        switch (pnode.kind) {
            case Parser.Kind.Identifier:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Syntax.Kind.ValueVariableGet, [], pnode.value);
            case Parser.Kind.Named:
                assert.eq(pnode.children.length, 1);
                return new Node(pnode.location, Syntax.Kind.ValueNamed, [this.syntaxExpr(pnode.children[0])], pnode.value);
            case Parser.Kind.LiteralScalar:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Syntax.Kind.ValueScalar, [], pnode.value);
            case Parser.Kind.LiteralArray:
                return new Node(pnode.location, Syntax.Kind.ValueArray, pnode.children.map(element => this.syntaxExpr(element)));
            case Parser.Kind.LiteralObject:
                return new Node(pnode.location, Syntax.Kind.ValueObject, pnode.children.map(element => this.syntaxExpr(element)));
            case Parser.Kind.TypeKeyword:
                assert.eq(pnode.children.length, 0);
                return new Node(pnode.location, Syntax.Kind.TypeKeyword, [], pnode.value);
            case Parser.Kind.PropertyAccess:
                assert.eq(pnode.children.length, 2);
                return this.syntaxExprPropertyGet(pnode.children[0], pnode.children[1]);
            case Parser.Kind.IndexAccess:
                assert.eq(pnode.children.length, 2);
                return this.syntaxExprIndexGet(pnode.children[0], pnode.children[1]);
            case Parser.Kind.FunctionCall:
                assert.eq(pnode.children.length, 2);
                return this.syntaxExprFunctionCall(pnode.children[0], pnode.children[1]);
            case Parser.Kind.OperatorBinary:
                assert.eq(pnode.children.length, 2);
                return this.syntaxExprBinary(pnode.children[0], pnode.value.asString(), pnode.children[1]);
            case Parser.Kind.OperatorTernary:
                assert.eq(pnode.children.length, 3);
                return this.syntaxExprTernary(pnode.children[0], pnode.children[1], pnode.children[2]);
        }
        assert.fail("Unknown node kind in syntaxExpr: {kind}", {kind:pnode.kind});
    }
    syntaxExprFunctionCall(callee: Parser.INode, args: Parser.INode): Node {
        const children = [this.syntaxExpr(callee), ...this.syntaxExprArguments(args)];
        const location = children[0].location.span(children[children.length - 1].location);
        return new Node(location, Syntax.Kind.ValueCall, children);
    }
    syntaxExprIndexGet(instance: Parser.INode, index: Parser.INode): Node {
        const children = [this.syntaxExpr(instance), this.syntaxExpr(index)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Syntax.Kind.ValueIndexGet, children);
    }
    syntaxExprPropertyGet(instance: Parser.INode, property: Parser.INode): Node {
        assert.eq(property.kind, Parser.Kind.Identifier);
        const children = [this.syntaxExpr(instance), this.syntaxPropertyIdentifier(property)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Syntax.Kind.ValuePropertyGet, children);
    }
    syntaxExprBinary(plhs: Parser.INode, op: string, prhs: Parser.INode): Node {
        const children = [this.syntaxExpr(plhs), this.syntaxExpr(prhs)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Syntax.Kind.ValueOperatorBinary, children, Value.fromString(op));
    }
    syntaxExprTernary(plhs: Parser.INode, pmid: Parser.INode, prhs: Parser.INode): Node {
        const children = [this.syntaxExpr(plhs), this.syntaxExpr(pmid), this.syntaxExpr(prhs)];
        const location = children[0].location.span(children[1].location);
        return new Node(location, Syntax.Kind.ValueOperatorTernary, children);
    }
    syntaxExprArguments(pnode: Parser.INode): Node[] {
        assert.eq(pnode.kind, Parser.Kind.FunctionArguments);
        return pnode.children.map(child => this.syntaxExpr(child));
    }
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
}

export class Syntax {
    constructor(public parser: Parser) {
    }
    syntax(): Module {
        const parsed = this.parser.parse();
        const impl = new Impl(parsed, this.logger);
        return impl.syntaxModule();
    }
    withLogger(logger: Logger): Syntax {
        this.parser.withLogger(logger);
        return this;
    }
    get logger() {
        return this.parser.logger;
    }
    static fromString(input: string, source?: string): Syntax {
        return new Syntax(Parser.fromString(input, source));
    }
}

export namespace Syntax {
    export enum Kind {
        Module = "module",
        StmtBlock = "stmt-block",
        StmtAssert = "stmt-assert",
        StmtIf = "stmt-if",
        StmtIfGuard = "stmt-if-guard",
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
