import { assert } from "./assertion";
import { Exception } from "./exception";
import { Location } from "./location";
import { ConsoleLogger, Logger } from "./logger";
import { Message } from "./message";
import { Tokenizer } from "./tokenizer";
import { Value } from "./value";

const binaryOperatorPrecedences = new Map<string, number>([
    // See syntax.html#binary-operator
    ["??", 1],
    ["||", 2],
    ["&&", 3],
    ["|", 4],
    ["^", 5],
    ["&", 6],
    ["==", 7], ["!=", 7],
    ["<", 8], [">", 8], ["<=", 8], [">=", 8],
    ["<<", 9], [">>", 9], [">>>", 9],
    ["+", 10], ["-", 10],
    ["*", 11], ["/", 11], ["%", 11],
]);

function binaryOperatorPrecedenceString(op: string) {
    return binaryOperatorPrecedences.get(op)
        ?? assert.fail("Unknown precedence for operator '{op}'", {op});
}

function binaryOperatorPrecedenceNode(pnode: Parser.INode) {
    return (pnode.kind === Parser.Kind.OperatorBinary) ? binaryOperatorPrecedenceString(pnode.value.asString()) : 99;
}

class Token {
    constructor(public underlying: Tokenizer.Token, public previous: Tokenizer.Kind) {}
    get line() {
        return this.underlying.line;
    }
    get column() {
        return this.underlying.column;
    }
    get kind() {
        return this.underlying.kind;
    }
    get value() {
        return this.underlying.value;
    }
    describe(): string {
        switch (this.underlying.kind) {
            case Tokenizer.Kind.Identifier:
            case Tokenizer.Kind.Punctuation:
                return `'${this.underlying.value}'`;
            case Tokenizer.Kind.Integer:
                return `integer literal`;
            case Tokenizer.Kind.Float:
                return `float literal`;
            case Tokenizer.Kind.String:
                return `string literal`;
            case Tokenizer.Kind.EOF:
                return `end-of-file`;
        }
        return JSON.stringify(this.underlying);
    }
}

class Input {
    private taken: Token[] = [];
    private previous = Tokenizer.Kind.EOF;
    constructor(public source: string, public tokenizer: Tokenizer) {}
    peek(lookahead: number = 0): Token {
        // Fill the taken array with enough tokens to satisfy the lookahead
        assert(lookahead >= 0);
        while (lookahead >= this.taken.length) {
            const incoming = this.tokenizer.take();
            if (incoming.kind === Tokenizer.Kind.EOF) {
                return new Token(incoming, this.previous);
            } else if (incoming.kind !== Tokenizer.Kind.Whitespace && incoming.kind !== Tokenizer.Kind.Comment) {
                this.taken.push(new Token(incoming, this.previous));
            }
            this.previous = incoming.kind;
        }
        return this.taken[lookahead];
    }
    drop(count: number): void {
        assert(count > 0);
        assert(this.taken.length >= count);
        this.taken = this.taken.slice(count);
    }
}

class Node implements Parser.INode {
    private constructor(public location: Location, public kind: Parser.Kind, public children: Node[] = [], public value: Value = Value.VOID) {}
    static createModule(source: string, children: Node[]): Node {
        const location = new Location(source, 0, 0);
        return new Node(location, Parser.Kind.Module, children);
    }
    static createIdentifier(location: Location, name: string): Node {
        return new Node(location, Parser.Kind.Identifier, [], Value.fromString(name));
    }
    static createNamed(location: Location, key: string, value: Node): Node {
        return new Node(location, Parser.Kind.Named, [value], Value.fromString(key));
    }
    static createGuard(location: Location, identifier: string, type: Node, initializer: Node): Node {
        return new Node(location, Parser.Kind.Guard, [type, initializer], Value.fromString(identifier));
    }
    static createLiteralScalar(location: Location, value: Value): Node {
        return new Node(location, Parser.Kind.LiteralScalar, [], value);
    }
    static createLiteralArray(location: Location, elements: Node[]): Node {
        return new Node(location, Parser.Kind.LiteralArray, elements);
    }
    static createLiteralObject(location: Location, members: Node[]): Node {
        return new Node(location, Parser.Kind.LiteralObject, members);
    }
    static createTypeInfer(location: Location, nullable: boolean): Node {
        return new Node(location, Parser.Kind.TypeInfer, [], Value.fromBool(nullable));
    }
    static createTypeKeyword(location: Location, keyword: string): Node {
        return new Node(location, Parser.Kind.TypeKeyword, [], Value.fromString(keyword));
    }
    static createTypeManifestation(location: Location, keyword: string): Node {
        return new Node(location, Parser.Kind.TypeManifestation, [], Value.fromString(keyword));
    }
    static createTypeNullable(location: Location, type: Node): Node {
        return new Node(location, Parser.Kind.TypeNullable, [type]);
    }
    static createVariableDefinition(location: Location, identifier: string, type: Node, initializer: Node): Node {
        return new Node(location, Parser.Kind.Variable, [type, initializer], Value.fromString(identifier));
    }
    static createVariableDeclaration(location: Location, identifier: string, type: Node): Node {
        return new Node(location, Parser.Kind.Variable, [type], Value.fromString(identifier));
    }
    static createStatementBlock(location: Location, statements: Node[]): Node {
        return new Node(location, Parser.Kind.StatementBlock, statements);
    }
    static createStatementForeach(location: Location, identifier: string, type: Node, expression: Node, block: Node): Node {
        return new Node(location, Parser.Kind.StatementForeach, [type, expression, block], Value.fromString(identifier));
    }
    static createStatementForloop(location: Location, initialization: Node, condition: Node, advance: Node, block: Node): Node {
        return new Node(location, Parser.Kind.StatementForloop, [initialization, condition, advance, block]);
    }
    static createStatementIf(location: Location, condition: Node, ifBlock: Node, elseBlock?: Node): Node {
        if (elseBlock) {
            return new Node(location, Parser.Kind.StatementIf, [condition, ifBlock, elseBlock]);
        }
        return new Node(location, Parser.Kind.StatementIf, [condition, ifBlock]);
    }
    static createStatementWhile(location: Location, condition: Node, block: Node): Node {
        return new Node(location, Parser.Kind.StatementWhile, [condition, block]);
    }
    static createStatementReturn(location: Location, expr?: Node): Node {
        return new Node(location, Parser.Kind.StatementReturn, expr ? [expr] : []);
    }
    static createStatementTry(location: Location, tryBlock: Node, catchClauses: Node[], finallyBlock?: Node): Node {
        if (finallyBlock) {
            return new Node(location, Parser.Kind.StatementIf, [tryBlock, ...catchClauses, finallyBlock], Value.TRUE);
        }
        return new Node(location, Parser.Kind.StatementTry, [tryBlock, ...catchClauses], Value.FALSE);
    }
    static createStatementCatch(location: Location, identifier: string, type: Node, block: Node): Node {
        return new Node(location, Parser.Kind.StatementCatch, [type, block], Value.fromString(identifier));
    }
    static createStatementAssign(location: Location, lhs: Node, rhs: Node): Node {
        return new Node(location, Parser.Kind.StatementAssign, [lhs, rhs]);
    }
    static createStatementMutate(location: Location, lhs: Node, op: string, rhs: Node): Node {
        return new Node(location, Parser.Kind.StatementMutate, [lhs, rhs], Value.fromString(op));
    }
    static createStatementNudge(location: Location, op: string, target: Node): Node {
        return new Node(location, Parser.Kind.StatementNudge, [target], Value.fromString(op));
    }
    static createPropertyAccess(instance: Node, property: Node): Node {
        assert.eq(property.kind, Parser.Kind.Identifier);
        const location = instance.location.span(property.location);
        return new Node(location, Parser.Kind.PropertyAccess, [instance, property]);
    }
    static createIndexAccess(instance: Node, index: Node): Node {
        const location = instance.location.span(index.location);
        return new Node(location, Parser.Kind.IndexAccess, [instance, index]);
    }
    static createFunctionDefinition(location: Location, identifier: string, type: Node, parameters: Node, block: Node): Node {
        return new Node(location, Parser.Kind.Function, [type, parameters, block], Value.fromString(identifier));
    }
    static createFunctionParameters(location: Location, parameters: Node[]): Node {
        return new Node(location, Parser.Kind.FunctionParameters, parameters);
    }
    static createFunctionParameter(location: Location, identifier: string, type: Node): Node {
        return new Node(location, Parser.Kind.FunctionParameter, [type], Value.fromString(identifier));
    }
    static createFunctionCall(callee: Node, fnargs: Node): Node {
        assert.eq(fnargs.kind, Parser.Kind.FunctionArguments);
        const location = callee.location.span(fnargs.location);
        return new Node(location, Parser.Kind.FunctionCall, [callee, fnargs]);
    }
    static createFunctionArguments(location: Location, nodes: Node[]): Node {
        return new Node(location, Parser.Kind.FunctionArguments, nodes);
    }
    static createOperatorTernary(lhs: Node, mid: Node, rhs: Node, op: string): Node {
        const location = lhs.location.span(rhs.location);
        return new Node(location, Parser.Kind.OperatorTernary, [lhs, mid, rhs], Value.fromString(op));
    }
    static createOperatorBinary(lhs: Node, rhs: Node, op: string): Node {
        if (binaryOperatorPrecedenceString(op) > binaryOperatorPrecedenceNode(lhs)) {
            return Node.createOperatorBinary(lhs.children[0], Node.createOperatorBinary(lhs.children[1], rhs, op), lhs.value.asString());
        }
        if (binaryOperatorPrecedenceString(op) > binaryOperatorPrecedenceNode(rhs)) {
            return Node.createOperatorBinary(Node.createOperatorBinary(lhs, rhs.children[0], op), rhs.children[1], rhs.value.asString());
        }
        const location = lhs.location.span(rhs.location);
        return new Node(location, Parser.Kind.OperatorBinary, [lhs, rhs], Value.fromString(op));
    }
    static createOperatorUnary(location: Location, rhs: Node, op: string): Node {
        return new Node(location, Parser.Kind.OperatorBinary, [rhs], Value.fromString(op));
    }
    dump(indent: number = 0) {
        console.debug(">".repeat(++indent), this.kind, this.value);
        for (const child of this.children) {
            child.dump(indent);
        }
    }
}

class Success {
    constructor(public node: Node, public lookahead: number) {}
}

class ParserException extends Exception {
    constructor(message: string, parameters?: Message.Parameters) {
        super(ParserException.name, Exception.Origin.Parser, message, parameters);
    }
}

class Impl extends Logger {
    constructor(public input: Input, public logger: Logger) {
        super();
    }
    expectModule(): Node {
        let incoming = this.input.peek();
        if (incoming.underlying.kind === Tokenizer.Kind.EOF && incoming.previous === Tokenizer.Kind.EOF) {
            this.raise("Empty input", {location: new Location(this.input.source, 0, 0)});
        }
        const children = [];
        while (incoming.underlying.kind !== Tokenizer.Kind.EOF) {
            const node = this.expectModuleStatement();
            children.push(node);
            incoming = this.input.peek();
        }
        return Node.createModule(this.input.source, children);
    }
    private expectModuleStatement(): Node {
        const statement = this.parseStatement(0)
                       ?? this.unexpected("Expected module statement", 0);
        return this.commit(statement);
    }
    private parseStatement(lookahead: number): Success | undefined {
        let success = this.parseFunctionDefinition(lookahead)
                   ?? this.parseStatementFor(lookahead)
                   ?? this.parseStatementIf(lookahead)
                   ?? this.parseStatementWhile(lookahead)
                   ?? this.parseStatementReturn(lookahead)
                   ?? this.parseStatementTry(lookahead);
        if (success) {
            return success;
        }
        success = this.parseStatementSimple(lookahead);
        return success && this.expectSemicolon(success);
    }
    private parseStatementSimple(lookahead: number): Success | undefined {
        // Excluding the trailing semicolon
        return this.parseVariableDefinition(lookahead)
            ?? this.parseStatementAction(lookahead);
    }
    private parseStatementAction(lookahead: number): Success | undefined {
        // Excluding the trailing semicolon
        return this.parseStatementAssignOrMutate(lookahead)
            ?? this.parseStatementNudge(lookahead, "++")
            ?? this.parseStatementNudge(lookahead, "--")
            ?? this.parseFunctionCall(lookahead);
    }
    private parseStatementAssignOrMutate(lookahead: number): Success | undefined {
        // Excluding the trailing semicolon
        const target = this.parseAssignmentTarget(lookahead);
        if (target) {
            if (this.isPunctuation(target.lookahead, "==")) {
                this.unexpected("Expected assignment operator like '='", target.lookahead);
            }
            if (this.isPunctuation(target.lookahead, "=")) {
                const expr = this.parseExpression(target.lookahead + 1)
                          ?? this.unexpected("Expected expression after assignment operator '='", target.lookahead + 1);
                return new Success(Node.createStatementAssign(this.peekLocation(lookahead, expr.lookahead - 1), target.node, expr.node), expr.lookahead);
            }
            for (const op of ["+=","-=","/=","%=","<<=",">>=",">>>=","&=","|=","^=","&&=","||=","??="]) {
                if (this.isPunctuation(target.lookahead, op)) {
                    const next = target.lookahead + op.length;
                    const expr = this.parseValueExpression(next)
                              ?? this.unexpected(`Expected expression after mutation operator '${op}'`, next);
                    return new Success(Node.createStatementMutate(this.peekLocation(lookahead, expr.lookahead - 1), target.node, op, expr.node), expr.lookahead);
                }
            }
        }
        return undefined;
    }
    private parseStatementNudge(lookahead: number, op: string): Success | undefined {
        // Excluding the trailing semicolon
        if (this.isPunctuation(lookahead, op)) {
            const target = this.parseAssignmentTarget(lookahead + 2)
                        ?? this.unexpected(`Expected assignment target after '${op}`, lookahead + 2);
            return new Success(Node.createStatementNudge(this.peekLocation(lookahead, target.lookahead), op, target.node), target.lookahead);
        }
        return undefined;
    }
    private parseAssignmentTarget(lookahead: number): Success | undefined {
        return this.parseValueExpressionPrimary(lookahead);
    }
    private parseVariableDefinition(lookahead: number): Success | undefined {
        const type = this.parseTypeExpressionOrVar(lookahead);
        if (type) {
            const identifier = this.parseIdentifier(type.lookahead);
            if (identifier && this.isPunctuation(identifier.lookahead, "=")) {
                const initializer = this.parseValueExpression(identifier.lookahead + 1)
                                 ?? this.unexpected("Expected variable initializer after '='", identifier.lookahead + 1);
                return new Success(Node.createVariableDefinition(identifier.node.location.span(initializer.node.location), identifier.node.value.asString(), type.node, initializer.node), initializer.lookahead);
            }
        }
        return undefined;
    }
    private parseFunctionDefinition(lookahead: number): Success | undefined {
        const type = this.parseTypeExpression(lookahead);
        if (type) {
            const identifier = this.parseIdentifier(type.lookahead);
            if (identifier && this.isPunctuation(identifier.lookahead, "(")) {
                const parameters = this.expectFunctionParameters(identifier.lookahead);
                if (!this.isPunctuation(parameters.lookahead, "{")) {
                    this.unexpected("Expected '{' after parameter list in definition of function '{function}'", parameters.lookahead, "{");
                }
                const block = this.expectStatementBlock(parameters.lookahead, "Expected statement within function definition block");
                return new Success(Node.createFunctionDefinition(identifier.node.location.span(parameters.node.location), identifier.node.value.asString(), type.node, parameters.node, block.node), block.lookahead);
            }
        }
        return undefined;
    }
    private parseFunctionCall(lookahead: number): Success | undefined {
        const call = this.parseValueExpressionPrimary(lookahead);
        if (call && call.node && call.node.kind === Parser.Kind.FunctionCall) {
            return call;
        }
        return undefined;
    }
    private parseStatementFor(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) !== "for" || this.peekPunctuation(lookahead + 1) !== "(") {
            return undefined;
        }
        const type = this.parseTypeExpressionOrVar(lookahead + 2);
        if (type) {
            // for ( type
            // for ( var[?]
            const identifier = this.parseIdentifier(type.lookahead);
            if (identifier && this.isPunctuation(identifier.lookahead, ":")) {
                // for ( type identifier :
                const expression = this.parseValueExpression(identifier.lookahead + 1);
                if (expression) {
                    // for ( type identifier : expression
                    if (this.peekPunctuation(expression.lookahead) !== ")") {
                        this.unexpected("Expected ')' after expression in 'foreach' statement", expression.lookahead, ")");
                    }
                    if (this.peekPunctuation(expression.lookahead + 1) !== "{") {
                        this.unexpected("Expected '{' after ')' in 'foreach' statement", expression.lookahead + 1, "{");
                    }
                    const block = this.expectStatementBlock(expression.lookahead + 1, "Expected statement within 'foreach' block");
                    const location = this.peekLocation(lookahead, block.lookahead);
                    return new Success(Node.createStatementForeach(location, identifier.node.value.asString(), type.node, expression.node, block.node), block.lookahead);
                }
            }
        }
        const initialization = this.parseVariableDefinition(lookahead + 2)
                            ?? this.unexpected("Expected variable definition in first clause of 'for' statement", lookahead + 2);
        let next = this.expectSemicolon(initialization).lookahead;
        const condition = this.parseValueExpression(next)
                       ?? this.unexpected("Expected condition in second clause of 'for' statement", next);
        next = this.expectSemicolon(condition).lookahead;
        const advance = this.parseStatementAction(next)
                     ?? this.unexpected("Expected statement in third clause of 'for' statement", next);
        if (this.peekPunctuation(advance.lookahead) !== ")") {
            this.unexpected("Expected ')' after third clause in 'for' statement", advance.lookahead, ")");
        }
        if (this.peekPunctuation(advance.lookahead + 1) !== "{") {
            this.unexpected("Expected '{' after ')' in 'for' statement", advance.lookahead + 1, "{");
        }
        const block = this.expectStatementBlock(advance.lookahead + 1, "Expected statement within 'for' block");
        const location = this.peekLocation(lookahead, block.lookahead);
        return new Success(Node.createStatementForloop(location, initialization.node, condition.node, advance.node, block.node), block.lookahead);
    }
    private parseStatementIf(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) !== "if" || this.peekPunctuation(lookahead + 1) !== "(") {
            return undefined;
        }
        return this.expectStatementIf(lookahead);
    }
    private parseStatementWhile(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) !== "while" || this.peekPunctuation(lookahead + 1) !== "(") {
            return undefined;
        }
        const condition = this.parseGuardExpression(lookahead + 2, "guard in 'while' statement")
                       ?? this.parseValueExpression(lookahead + 2)
                       ?? this.unexpected("Expected condition or guard after '(' in 'while' statement", lookahead + 2);
        if (this.peekPunctuation(condition.lookahead) !== ")") {
            this.unexpected("Expected ')' after condition in 'while' statement", condition.lookahead, ")");
        }
        if (this.peekPunctuation(condition.lookahead + 1) !== "{") {
            this.unexpected("Expected '{' after ')' in 'while' statement", condition.lookahead + 1, "{");
        }
        const block = this.expectStatementBlock(condition.lookahead + 1, "Expected statement within 'while' block");
        const location = this.peekLocation(lookahead, block.lookahead);
        return new Success(Node.createStatementWhile(location, condition.node, block.node), block.lookahead);
    }
    private parseStatementReturn(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) !== "return") {
            return undefined;
        }
        if (this.peekPunctuation(lookahead + 1) === ";") {
            return new Success(Node.createStatementReturn(this.peekLocation(lookahead)), lookahead + 2);
        }
        const expr = this.parseValueExpression(lookahead + 1)
                  ?? this.unexpected("Expected semicolon or expression after 'return'", lookahead + 1);
        this.expectSemicolon(expr);
        const location = this.peekLocation(lookahead, expr.lookahead);
        return new Success(Node.createStatementReturn(location, expr.node), expr.lookahead + 1);
    }
    private parseStatementTry(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) !== "try" || this.peekPunctuation(lookahead + 1) !== "{") {
            return undefined;
        }
        const block = this.expectStatementBlock(lookahead + 1, "Expected statement within 'try' block");
        const catches = [];
        let next = block.lookahead;
        if (this.peekKeyword(next) !== "catch") {
            this.unexpected("Expected 'catch' after 'try' block", next, "catch");
        }
        do {
            const success = this.expectStatementCatch(next);
            catches.push(success.node);
            next = success.lookahead;
        } while (this.peekKeyword(next) === "catch");
        const location = this.peekLocation(lookahead, next);
        return new Success(Node.createStatementTry(location, block.node, catches), next);
    }
    private expectStatementCatch(lookahead: number): Success {
        assert.eq(this.peekKeyword(lookahead), "catch");
        if (this.peekPunctuation(lookahead + 1) !== "(") {
            this.unexpected("Expected '(' after 'catch' in 'try' statement", lookahead + 1, "(");
        }
        const type = this.parseTypeExpression(lookahead + 2)
                  ?? this.unexpected("Expected 'catch' clause type", lookahead + 2);
        const identifier = this.parseIdentifier(type.lookahead)
                        ?? this.unexpected("Expected 'catch' clause identifier after type", type.lookahead);
        if (this.peekPunctuation(identifier.lookahead) !== ")") {
            this.unexpected("Expected ')' after 'catch' identifier in 'try' statement", identifier.lookahead, ")");
        }
        if (this.peekPunctuation(identifier.lookahead + 1) !== "{") {
            this.unexpected("Expected '{' in 'catch' clause of 'try' statement", identifier.lookahead + 1, "}");
        }
        const block = this.expectStatementBlock(identifier.lookahead + 1, "Expected statement within 'catch' clause of 'try' statement");
        return new Success(Node.createStatementCatch(this.peekLocation(lookahead, block.lookahead), identifier.node.value.asString(), type.node, block.node), block.lookahead);
    }
    private expectStatementIf(lookahead: number): Success {
        assert(this.peekKeyword(lookahead) === "if" && this.peekPunctuation(lookahead + 1) === "(");
        const condition = this.parseGuardExpression(lookahead + 2, "guard in 'if' statement")
                       ?? this.parseValueExpression(lookahead + 2)
                       ?? this.unexpected("Expected condition or guard after '(' in 'if' statement", lookahead + 2);
        if (this.peekPunctuation(condition.lookahead) !== ")") {
            this.unexpected("Expected ')' after condition in 'if' statement", condition.lookahead, ")");
        }
        if (this.peekPunctuation(condition.lookahead + 1) !== "{") {
            this.unexpected("Expected '{' after ')' in 'if' statement", condition.lookahead + 1, "{");
        }
        const ifBlock = this.expectStatementBlock(condition.lookahead + 1, "Expected statement within 'if' block");
        if (this.peekKeyword(ifBlock.lookahead) !== "else") {
            const location = this.peekLocation(lookahead, ifBlock.lookahead);
            return new Success(Node.createStatementIf(location, condition.node, ifBlock.node), ifBlock.lookahead);
        }
        const elseBlock = this.expectStatementElse(ifBlock.lookahead);
        const location = this.peekLocation(lookahead, elseBlock.lookahead);
        return new Success(Node.createStatementIf(location, condition.node, ifBlock.node, elseBlock.node), elseBlock.lookahead);
    }
    private expectStatementElse(lookahead: number): Success {
        assert.eq(this.peekKeyword(lookahead), "else");
        if (this.peekKeyword(lookahead + 1) === "if") {
            if (this.peekPunctuation(lookahead + 2) !== "(") {
                this.unexpected("Expected '(' after 'if' in 'else' clause of 'if' statement", lookahead + 2, "(");
            }
            return this.expectStatementIf(lookahead + 1);
        }
        if (this.peekPunctuation(lookahead + 1) !== "{") {
            this.unexpected("Expected '{' after 'else' in 'if' statement", lookahead + 1, "{");
        }
        return this.expectStatementBlock(lookahead + 1, "Expected statement within 'else' block");
    }
    private expectStatementBlock(lookahead: number, expectation: string): Success {
        assert.eq(this.peekPunctuation(lookahead), "{");
        let next = lookahead + 1;
        const children = [];
        while (this.peekPunctuation(next) !== "}") {
            const child = this.parseStatement(next)
                       ?? this.unexpected(expectation, next);
            children.push(child.node);
            next = child.lookahead;
        }
        const location = this.peekLocation(lookahead, next);
        return new Success(Node.createStatementBlock(location, children), next + 1);
    }
    private expectFunctionParameters(lookahead: number): Success {
        assert(this.peekPunctuation(lookahead) === "(");
        const start = lookahead++;
        const nodes = [];
        if (this.peekPunctuation(lookahead) !== ")") {
            for (;;) {
                const parameter = this.expectFunctionParameter(lookahead);
                nodes.push(parameter.node);
                lookahead = parameter.lookahead;
                const punctuation = this.peekPunctuation(lookahead);
                if (punctuation === ",") {
                    lookahead++;
                } else if (punctuation === ")") {
                    break;
                } else {
                    this.unexpected("Expected ',' or ')' after function parameter", lookahead);
                }
            }
        }
        assert(this.peekPunctuation(lookahead) === ")");
        return new Success(Node.createFunctionParameters(this.peekLocation(start, lookahead), nodes), lookahead + 1);
    }
    private expectFunctionParameter(lookahead: number): Success {
        const type = this.parseTypeExpression(lookahead)
                  ?? this.unexpected("Expected function parameter type", lookahead);
        const identifier = this.parseIdentifier(type.lookahead)
                        ?? this.unexpected("Expected function parameter name after type", type.lookahead);
        return new Success(Node.createFunctionParameter(type.node.location.span(identifier.node.location), identifier.node.value.asString(), type.node), identifier.lookahead);
    }
    private expectFunctionArguments(lookahead: number): Success {
        assert(this.peekPunctuation(lookahead) === "(");
        const start = lookahead++;
        const nodes = [];
        if (this.peekPunctuation(lookahead) !== ")") {
            for (;;) {
                const argument = this.expectFunctionArgument(lookahead);
                nodes.push(argument.node);
                lookahead = argument.lookahead;
                const punctuation = this.peekPunctuation(lookahead);
                if (punctuation === ",") {
                    lookahead++;
                } else if (punctuation === ")") {
                    break;
                } else {
                    this.unexpected("Expected ',' or ')' after function argument", lookahead);
                }
            }
        }
        assert(this.peekPunctuation(lookahead) === ")");
        return new Success(Node.createFunctionArguments(this.peekLocation(start, lookahead), nodes), lookahead + 1);
    }
    private expectFunctionArgument(lookahead: number): Success {
        return this.parseValueExpression(lookahead)
            ?? this.unexpected("Expected function argument", lookahead);
    }
    private expectIndexArgument(lookahead: number): Success {
        assert(this.peekPunctuation(lookahead) === "[");
        const argument = this.parseValueExpression(lookahead + 1)
                      ?? this.unexpected("Expected index expression", lookahead + 1);
        if (this.peekPunctuation(argument.lookahead) !== "]") {
            this.unexpected("Expected ']' after index expression", argument.lookahead, "]");
        }
        argument.node.location = this.peekLocation(lookahead, argument.lookahead);
        return new Success(argument.node, argument.lookahead + 1);
    }
    private parseExpression(lookahead: number): Success | undefined {
        return this.parseValueExpression(lookahead)
            ?? this.parseTypeExpression(lookahead);
    }
    private parseTypeExpressionOrVar(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) === "var") {
            if (this.peekPunctuation(lookahead + 1) === "?") {
                return new Success(Node.createTypeInfer(this.peekLocation(lookahead, lookahead + 1), true), lookahead + 2);
            }
            return new Success(Node.createTypeInfer(this.peekLocation(lookahead), false), lookahead + 1);
        }
        return this.parseTypeKeyword(lookahead);
    }
    private parseTypeExpression(lookahead: number): Success | undefined {
        return this.parseTypeExpressionBinary(lookahead);
    }
    private parseTypeExpressionBinary(lookahead: number): Success | undefined {
        const lhs = this.parseTypeExpressionUnary(lookahead);
        if (lhs) {
            for (const op of ["|"]) {
                const expr = this.parseTypeExpressionBinaryOperator(lhs, op);
                if (expr) {
                    return expr;
                }
            }
        }
        return lhs;
    }
    private parseTypeExpressionBinaryOperator(lhs: Success, op: string): Success | undefined {
        if (this.isPunctuation(lhs.lookahead, op)) {
            const rhs = this.parseTypeExpression(lhs.lookahead + op.length);
            if (rhs) {
                return new Success(Node.createOperatorBinary(lhs.node, rhs.node, op), rhs.lookahead);
            }
        }
        return undefined;
    }
    private parseTypeExpressionUnary(lookahead: number): Success | undefined {
        return this.parseTypeExpressionPrimary(lookahead);
    }
    private parseTypeExpressionPrimary(lookahead: number): Success | undefined {
        let front = this.parseTypeExpressionPrimaryFront(lookahead);
        if (front) {
            let back = this.parseTypeExpressionPrimaryBack(front);
            while (back) {
                front = back;
                back = this.parseTypeExpressionPrimaryBack(front);
            }
        }
        return front;
    }
    private parseTypeExpressionPrimaryFront(lookahead: number): Success | undefined {
        return this.parseTypeKeyword(lookahead);
    }
    private parseTypeExpressionPrimaryBack(front: Success): Success | undefined {
        let back: Success;
        switch (this.peekPunctuation(front.lookahead)) {
            case ".":
                back = this.parseIdentifier(front.lookahead + 1)
                    ?? this.unexpected("Expected property name after '.'", front.lookahead + 1);
                return new Success(Node.createPropertyAccess(front.node, back.node), back.lookahead);
            case "?":
                if (this.isPunctuation(front.lookahead, "??")) {
                    return undefined;
                }
                return new Success(Node.createTypeNullable(front.node.location.span(this.peekLocation(front.lookahead + 1)), front.node), front.lookahead + 1);
        }
        return undefined;
    }
    private parseTypeKeyword(lookahead: number): Success | undefined {
        const keyword = this.peekKeyword(lookahead);
        switch (keyword) {
            case "void":
            case "bool":
            case "int":
            case "float":
            case "string":
            case "object":
            case "any":
                return new Success(Node.createTypeKeyword(this.peekLocation(lookahead), keyword), lookahead + 1);
        }
        return undefined;
    }
    private parseTypeManifestation(lookahead: number): Success | undefined {
        const keyword = this.peekKeyword(lookahead);
        switch (keyword) {
            case "void":
            case "bool":
            case "int":
            case "float":
            case "string":
            case "object":
            case "any":
            case "type":
                return new Success(Node.createTypeManifestation(this.peekLocation(lookahead), keyword), lookahead + 1);
        }
        return undefined;
    }
    private parseGuardExpression(lookahead: number, guard: string): Success | undefined {
        const type = this.parseTypeExpressionOrVar(lookahead);
        if (type) {
            const identifier = this.parseIdentifier(type.lookahead);
            if (identifier && this.isPunctuation(identifier.lookahead, "=")) {
                const initializer = this.parseValueExpression(identifier.lookahead + 1)
                                 ?? this.unexpected("Expected expression after '=' in " + guard, identifier.lookahead + 1);
                const location = this.peekLocation(lookahead, initializer.lookahead);
                return new Success(Node.createGuard(location, identifier.node.value.asString(), type.node, initializer.node), initializer.lookahead);
            }
        }
        return undefined;
    }
    private parseValueExpression(lookahead: number): Success | undefined {
        return this.parseValueExpressionTernary(lookahead);
    }
    private parseValueExpressionTernary(lookahead: number): Success | undefined {
        const lhs = this.parseValueExpressionBinary(lookahead);
        if (lhs && this.isPunctuation(lhs.lookahead, "?") && !this.isPunctuation(lhs.lookahead, "??")) {
            const mid = this.parseValueExpression(lhs.lookahead + 1);
            if (mid && this.isPunctuation(mid.lookahead, ":")) {
                const rhs = this.parseValueExpression(mid.lookahead + 1);
                if (rhs) {
                    return new Success(Node.createOperatorTernary(lhs.node, mid.node, rhs.node, "?:"), rhs.lookahead);
                }
            }
        }
        return lhs;
    }
    private parseValueExpressionBinary(lookahead: number): Success | undefined {
        const lhs = this.parseValueExpressionUnary(lookahead);
        if (lhs) {
            for (const op of ["+","-","*","/","!=","==","<=","<",">=",">","&&","||","??","&","|","^"]) {
                const expr = this.parseValueExpressionBinaryOperator(lhs, op);
                if (expr) {
                    return expr;
                }
            }
        }
        return lhs;
    }
    private parseValueExpressionBinaryOperator(lhs: Success, op: string): Success | undefined {
        if (this.isPunctuation(lhs.lookahead, op)) {
            const rhs = this.parseValueExpression(lhs.lookahead + op.length);
            if (rhs) {
                return new Success(Node.createOperatorBinary(lhs.node, rhs.node, op), rhs.lookahead);
            }
        }
        return undefined;
    }
    private parseValueExpressionUnary(lookahead: number): Success | undefined {
        return this.parseValueExpressionPrimary(lookahead);
    }
    private parseValueExpressionPrimary(lookahead: number): Success | undefined {
        let front = this.parseValueExpressionPrimaryFront(lookahead);
        if (front) {
            let back = this.parseValueExpressionPrimaryBack(front);
            while (back) {
                front = back;
                back = this.parseValueExpressionPrimaryBack(front);
            }
        }
        return front;
    }
    private parseValueExpressionPrimaryFront(lookahead: number): Success | undefined {
        return this.parseNullLiteral(lookahead)
            ?? this.parseBooleanLiteral(lookahead)
            ?? this.parseIntegerLiteral(lookahead)
            ?? this.parseFloatLiteral(lookahead)
            ?? this.parseStringLiteral(lookahead)
            ?? this.parseArrayLiteral(lookahead)
            ?? this.parseObjectLiteral(lookahead)
            ?? this.parseTypeManifestation(lookahead)
            ?? this.parseIdentifier(lookahead);
    }
    private parseValueExpressionPrimaryBack(front: Success): Success | undefined {
        let back: Success;
        switch (this.peekPunctuation(front.lookahead)) {
            case ".":
                back = this.parseIdentifier(front.lookahead + 1)
                    ?? this.unexpected("Expected property name after '.'", front.lookahead + 1);
                return new Success(Node.createPropertyAccess(front.node, back.node), back.lookahead);
            case "[":
                back = this.expectIndexArgument(front.lookahead);
                return new Success(Node.createIndexAccess(front.node, back.node), back.lookahead);
            case "(":
                back = this.expectFunctionArguments(front.lookahead);
                return new Success(Node.createFunctionCall(front.node, back.node), back.lookahead);
        }
        return undefined;
    }
    private parseIdentifier(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.Identifier) {
            const node = Node.createIdentifier(this.peekLocation(token), token.value as string);
            return new Success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseNullLiteral(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) === "null") {
            const node = Node.createLiteralScalar(this.peekLocation(lookahead), Value.NULL);
            return new Success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseBooleanLiteral(lookahead: number): Success | undefined {
        switch (this.peekKeyword(lookahead)) {
            case "false":
                return new Success(Node.createLiteralScalar(this.peekLocation(lookahead), Value.FALSE), lookahead + 1);
            case "true":
                return new Success(Node.createLiteralScalar(this.peekLocation(lookahead), Value.TRUE), lookahead + 1);
            }
        return undefined;
    }
    private parseIntegerLiteral(lookahead: number): Success | undefined {
        let token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.Integer) {
            const node = Node.createLiteralScalar(this.peekLocation(token), Value.fromInt(token.value as bigint));
            return new Success(node, lookahead + 1);
        }
        if (token.kind === Tokenizer.Kind.Punctuation && token.value === "-") {
            token = this.input.peek(lookahead + 1);
            if (token.kind === Tokenizer.Kind.Integer && token.previous === Tokenizer.Kind.Punctuation) {
                const location = this.peekLocation(token);
                location.column0--;
                const node = Node.createLiteralScalar(location, Value.fromInt(-token.value as bigint));
                return new Success(node, lookahead + 2);
            }
        }
        return undefined;
    }
    private parseFloatLiteral(lookahead: number): Success | undefined {
        let token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.Float) {
            const node = Node.createLiteralScalar(this.peekLocation(token), Value.fromFloat(token.value as number));
            return new Success(node, lookahead + 1);
        }
        if (token.kind === Tokenizer.Kind.Punctuation && token.value === "-") {
            token = this.input.peek(lookahead + 1);
            if (token.kind === Tokenizer.Kind.Float && token.previous === Tokenizer.Kind.Punctuation) {
                const location = this.peekLocation(token);
                location.column0--;
                const node = Node.createLiteralScalar(location, Value.fromFloat(-token.value as number));
                return new Success(node, lookahead + 2);
            }
        }
        return undefined;
    }
    private parseStringLiteral(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.String) {
            const node = Node.createLiteralScalar(this.peekLocation(token), Value.fromString(token.value as string));
            return new Success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseArrayLiteral(lookahead: number): Success | undefined {
        if (this.peekPunctuation(lookahead) !== "[") {
            return undefined;
        }
        const start = lookahead++;
        const nodes = [];
        if (this.peekPunctuation(lookahead) !== "]") {
            for (;;) {
                const element = this.parseValueExpression(lookahead)
                             ?? this.unexpected("Expected array element expression", lookahead);
                nodes.push(element.node);
                lookahead = element.lookahead;
                const punctuation = this.peekPunctuation(lookahead);
                if (punctuation === ",") {
                    ++lookahead;
                } else if (punctuation === "]") {
                    break;
                } else {
                    this.unexpected("Expected ',' or ']' after array element", lookahead);
                }
            }
        }
        assert(this.peekPunctuation(lookahead) === "]");
        return new Success(Node.createLiteralArray(this.peekLocation(start, lookahead), nodes), lookahead + 1);
    }
    private parseObjectLiteral(lookahead: number): Success | undefined {
        if (this.peekPunctuation(lookahead) !== "{") {
            return undefined;
        }
        const start = lookahead++;
        const nodes = [];
        if (this.peekPunctuation(lookahead) !== "}") {
            for (;;) {
                const token = this.input.peek(lookahead);
                if (token.kind !== Tokenizer.Kind.Identifier && token.kind != Tokenizer.Kind.String) {
                    this.unexpected("Expected object element label", lookahead);
                }
                const key = String(token.value);
                if (this.peekPunctuation(lookahead + 1) !== ":") {
                    this.unexpected("Expected ':' after object element key", lookahead + 1, ":");
                }
                const value = this.parseValueExpression(lookahead + 2)
                           ?? this.unexpected("Expected object element value expression", lookahead + 2);
                nodes.push(Node.createNamed(this.peekLocation(token, value.lookahead), key, value.node));
                lookahead = value.lookahead;
                const punctuation = this.peekPunctuation(lookahead);
                if (punctuation === ",") {
                    ++lookahead;
                } else if (punctuation === "}") {
                    break;
                } else {
                    this.unexpected("Expected ',' or '}' after object element", lookahead);
                }
            }
        }
        assert(this.peekPunctuation(lookahead) === "}");
        return new Success(Node.createLiteralObject(this.peekLocation(start, lookahead), nodes), lookahead + 1);
    }
    private expectSemicolon(success: Success): Success {
        if (this.peekPunctuation(success.lookahead) === ";") {
            return new Success(success.node, success.lookahead + 1);
        }
        this.unexpected("Expected semicolon", success.lookahead, ";");
    }
    private peekKeyword(lookahead: number): string {
        const token = this.input.peek(lookahead);
        return token.kind === Tokenizer.Kind.Identifier ? String(token.value) : "";
    }
    private peekPunctuation(lookahead: number): string {
        const token = this.input.peek(lookahead);
        return token.kind === Tokenizer.Kind.Punctuation ? String(token.value) : "";
    }
    private isPunctuation(lookahead: number, punctuation: string): boolean {
        let token = this.input.peek(lookahead);
        if (token.kind !== Tokenizer.Kind.Punctuation || token.value !== punctuation[0]) {
            return false;
        }
        for (let index = 1; index < punctuation.length; ++index) {
            token = this.input.peek(lookahead + index);
            if (token.kind !== Tokenizer.Kind.Punctuation || token.previous !== Tokenizer.Kind.Punctuation || token.value !== punctuation[index]) {
                return false;
            }
        }
        return true;
    }
    private peekLocation(lbound: Token | number, ubound?: Token | number): Location {
        const start = (lookahead: Token | number): [number, number] => {
            const token = (typeof lookahead === "number") ? this.input.peek(lookahead) : lookahead;
            return [token.line, token.column];
        }
        const end = (lookahead: Token | number): [number, number] => {
            const token = (typeof lookahead === "number") ? this.input.peek(lookahead) : lookahead;
            return [token.line, token.column + token.underlying.raw.length - 1];
        }
        if (ubound === undefined) {
            return new Location(this.input.source, ...start(lbound), ...end(lbound));
        }
        return new Location(this.input.source, ...start(lbound), ...end(ubound));
    }
    private unexpected(message: string, lookahead: number, expected?: string): never {
        const token = this.input.peek(lookahead);
        this.raise(message + ", but got {unexpected} instead", {
            location: new Location(this.input.source, token.line, token.column),
            expected: expected,
            unexpected: token.describe(),
        });
    }
    private raise(message: string, parameters: Message.Parameters): never {
        throw this.logger.trap(new ParserException(message, parameters));
    }
    commit(success: Success): Node {
        this.input.drop(success.lookahead)
        return success.node;
    } 
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
}

export class Parser {
    private _logger?: Logger;
    constructor(public input: Input) {
    }
    parse(): Parser.INode {
        const impl = new Impl(this.input, this.logger);
        return impl.expectModule();
    }
    withLogger(logger: Logger): Parser {
        this._logger = logger;
        return this;
    }
    get logger() {
        return this._logger ??= new ConsoleLogger();
    }
    static fromFile(path: string): Parser {
        return new Parser(new Input(path, Tokenizer.fromFile(path)));
    }
    static fromString(text: string, source?: string): Parser {
        return new Parser(new Input(source ?? "", Tokenizer.fromString(text)));
    }
}

export namespace Parser {
    export enum Kind {
        Module = "module",
        Identifier = "identifier",
        Named = "named",
        Guard = "guard",
        LiteralScalar = "literal-scalar",
        LiteralArray = "literal-array",
        LiteralObject = "literal-object",
        Variable = "variable",
        Function = "function",
        TypeInfer = "type-infer",
        TypeKeyword = "type-keyword",
        TypeManifestation = "type-manifestation",
        TypeNullable = "type-nullable",
        StatementBlock = "stmt-block",
        StatementForeach = "stmt-foreach",
        StatementForloop = "stmt-forloop",
        StatementIf = "stmt-if",
        StatementWhile = "stmt-while",
        StatementTry = "stmt-try",
        StatementCatch = "stmt-catch",
        StatementReturn = "stmt-return",
        StatementAssign = "stmt-assign",
        StatementMutate = "stmt-mutate",
        StatementNudge = "stmt-nudge",
        PropertyAccess = "property-access",
        IndexAccess = "index-access",
        FunctionCall = "function-call",
        FunctionArguments = "function-arguments",
        FunctionParameters = "function-parameters",
        FunctionParameter = "function-parameter",
        OperatorTernary = "operator-ternary",
        OperatorBinary = "operator-binary",
        OperatorUnary = "operator-unary",
    }
    export interface INode {
        location: Location;
        kind: Kind;
        children: INode[];
        value: Value;
    }
}
