import { assert } from "./assertion";
import { BaseException, ExceptionOrigin, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
import { Program } from "./program";
import { Tokenizer } from "./tokenizer";
import { Value } from "./value";

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

class Node implements Parser.Node {
    private constructor(public location: Program.Location, public kind: Parser.Kind, public children: Node[] = [], public value: Value = Value.VOID) {}
    static createModule(source: string, children: Node[]): Node {
        const location = new Program.Location(source);
        return new Node(location, Parser.Kind.Module, children);
    }
    static createIdentifier(location: Program.Location, name: string): Node {
        return new Node(location, Parser.Kind.Identifier, [], Value.fromString(name));
    }
    static createLiteral(location: Program.Location, value: Value): Node {
        return new Node(location, Parser.Kind.Literal, [], value);
    }
    static createTypeInfer(location: Program.Location, nullable: boolean): Node {
        return new Node(location, Parser.Kind.TypeInfer, [], Value.fromBool(nullable));
    }
    static createTypeKeyword(location: Program.Location, keyword: string): Node {
        return new Node(location, Parser.Kind.TypeKeyword, [], Value.fromString(keyword));
    }
    static createVariableDefinition(location: Program.Location, name: string, type: Node, initializer: Node): Node {
        return new Node(location, Parser.Kind.Variable, [type, initializer], Value.fromString(name));
    }
    static createVariableDeclaration(location: Program.Location, name: string, type: Node, initializer: Node): Node {
        return new Node(location, Parser.Kind.Variable, [type, initializer], Value.fromString(name));
    }
    static createFunctionCall(location: Program.Location, callee: Node, fnargs: Node): Node {
        assert.eq(fnargs.kind, Parser.Kind.FunctionArguments);
        return new Node(location, Parser.Kind.FunctionCall, [callee, fnargs]);
    }
    static createFunctionArguments(location: Program.Location, nodes: Node[]): Node {
        return new Node(location, Parser.Kind.FunctionArguments, nodes);
    }
    static createOperatorTernary(location: Program.Location, lhs: Node, mid: Node, rhs: Node, op: string): Node {
        return new Node(location, Parser.Kind.OperatorTernary, [lhs, mid, rhs], Value.fromString(op));
    }
    static createOperatorBinary(location: Program.Location, lhs: Node, rhs: Node, op: string): Node {
        return new Node(location, Parser.Kind.OperatorBinary, [lhs, rhs], Value.fromString(op));
    }
    static createOperatorUnary(location: Program.Location, rhs: Node, op: string): Node {
        return new Node(location, Parser.Kind.OperatorBinary, [rhs], Value.fromString(op));
    }
}

class Success {
    readonly failed = false;
    constructor(public node: Node, public lookahead: number) {}
}

class Failure {
    readonly failed = true;
    logs: Logger.Entry[];
    constructor(message: string, parameters?: Logger.Parameters) {
        this.logs = [new Logger.Entry(Logger.Severity.Error, message, parameters)];
    }
}

// TODO type Result = Success | Failure;

class Impl extends Logger {
    constructor(public input: Input, public logger: Logger) {
        super();
    }
    expectModule(): Node {
        let incoming = this.input.peek();
        if (incoming.underlying.kind === Tokenizer.Kind.EOF && incoming.previous === Tokenizer.Kind.EOF) {
            this.fatal("Empty input", { source: this.input.source });
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
        const statement = this.parseStatement(0);
        if (statement) {
            return this.commit(statement);
        };
        this.throwUnexpected("Expected module statement", 0);
    }
    private parseStatement(lookahead: number): Success | undefined {
        const success = this.parseStatementSimple(lookahead);
        return success && this.expectSemicolon(success);
    }
    private parseStatementSimple(lookahead: number): Success | undefined {
        // Excluding the trailing semicolon
        return this.parseVariableDefinition(lookahead)
            ?? this.parseFunctionCall(lookahead);
    }
    private parseVariableDefinition(lookahead: number): Success | undefined {
        const type = this.parseTypeExpressionOrVar(lookahead);
        if (type) {
            const identifier = this.parseIdentifier(type.lookahead);
            if (identifier && this.isPunctuation(identifier.lookahead, "=")) {
                const initializer = this.parseValueExpression(identifier.lookahead + 1);
                if (initializer) {
                    return this.success(Node.createVariableDefinition(identifier.node.location, identifier.node.value.getString(), type.node, initializer.node), initializer.lookahead);
                }
            }
        }
        return undefined;
    }
    private parseFunctionCall(lookahead: number): Success | undefined {
        const callee = this.parseIdentifier(lookahead);
        if (callee) {
            if (this.peekPunctuation(callee.lookahead) === "(") {
                const fnargs = this.expectFunctionArguments(callee.lookahead);
                return this.success(Node.createFunctionCall(callee.node.location, callee.node, fnargs.node), fnargs.lookahead);
            }
        }
        return undefined;
    }
    private expectFunctionArguments(lookahead: number): Success {
        const start = lookahead;
        assert(this.peekPunctuation(lookahead) === "(");
        lookahead++;
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
                    this.throwUnexpected("Expected ',' or ')' after function argument", lookahead);
                }
            }
        }
        assert(this.peekPunctuation(lookahead) === ")");
        return this.success(Node.createFunctionArguments(this.peekLocation(start, lookahead), nodes), lookahead + 1);
    }
    private expectFunctionArgument(lookahead: number): Success {
        return this.parseExpression(lookahead)
            ?? this.throwUnexpected("Expected function argument", lookahead);
    }
    private parseExpression(lookahead: number): Success | undefined {
        return this.parseValueExpression(lookahead)
            ?? this.parseTypeExpression(lookahead);
    }
    private parseTypeExpressionOrVar(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) === "var") {
            if (this.peekPunctuation(lookahead + 1) === "?") {
                return this.success(Node.createTypeInfer(this.peekLocation(lookahead, lookahead + 1), true), lookahead + 2);
            }
            return this.success(Node.createTypeInfer(this.peekLocation(lookahead), false), lookahead + 1);
        }
        return this.parseTypeKeyword(lookahead);
    }
    private parseTypeExpression(lookahead: number): Success | undefined {
        return this.parseTypeKeyword(lookahead);
    }
    private parseTypeKeyword(lookahead: number): Success | undefined {
        const keyword = this.peekKeyword(lookahead);
        switch (keyword) {
            case "bool":
            case "int":
            case "float":
            case "string":
                return this.success(Node.createTypeKeyword(this.peekLocation(lookahead), keyword), lookahead + 1);
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
            if (mid && this.isPunctuation(lhs.lookahead, ":")) {
                const rhs = this.parseValueExpression(mid.lookahead + 1);
                if (rhs) {
                    const location = lhs.node.location.span(rhs.node.location);
                    return this.success(Node.createOperatorTernary(location, lhs.node, mid.node, rhs.node, "?:"), rhs.lookahead);
                }
            }
        }
        return lhs;
    }
    private parseValueExpressionBinary(lookahead: number): Success | undefined {
        const lhs = this.parseValueExpressionUnary(lookahead);
        if (lhs) {
            for (const op of ["+","-","*","/"]) {
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
                const location = lhs.node.location.span(rhs.node.location);
                return this.success(Node.createOperatorBinary(location, lhs.node, rhs.node, op), rhs.lookahead);
            }
        }
        return undefined;
    }
    private parseValueExpressionUnary(lookahead: number): Success | undefined {
        return this.parseValueExpressionPrimary(lookahead);
    }
    private parseValueExpressionPrimary(lookahead: number): Success | undefined {
        const front = this.parseValueExpressionPrimaryFront(lookahead);
        if (front) {
            let back: Success;
            switch (this.peekPunctuation(front.lookahead)) {
                case "(":
                    back = this.expectFunctionArguments(front.lookahead);
                    return this.success(Node.createFunctionCall(front.node.location, front.node, back.node), back.lookahead);
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
            ?? this.parseIdentifier(lookahead);
    }
    private parseIdentifier(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.Identifier) {
            const node = Node.createIdentifier(this.peekLocation(token), token.value as string);
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseNullLiteral(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) === "null") {
            const node = Node.createLiteral(this.peekLocation(lookahead), Value.NULL);
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseBooleanLiteral(lookahead: number): Success | undefined {
        switch (this.peekKeyword(lookahead)) {
            case "false":
                return this.success(Node.createLiteral(this.peekLocation(lookahead), Value.FALSE), lookahead + 1);
            case "true":
                return this.success(Node.createLiteral(this.peekLocation(lookahead), Value.TRUE), lookahead + 1);
            }
        return undefined;
    }
    private parseIntegerLiteral(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.Integer) {
            const node = Node.createLiteral(this.peekLocation(token), Value.fromInt(token.value as bigint));
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseFloatLiteral(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.Float) {
            const node = Node.createLiteral(this.peekLocation(token), Value.fromFloat(token.value as number));
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseStringLiteral(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.String) {
            const node = Node.createLiteral(this.peekLocation(token), Value.fromString(token.value as string));
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private expectSemicolon(success: Success): Success {
        if (this.peekPunctuation(success.lookahead) === ";") {
            return this.success(success.node, success.lookahead + 1);
        }
        this.throwUnexpected("Expected semicolon", success.lookahead, ";");
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
    private peekLocation(lbound: Token | number, ubound?: Token | number): Program.Location {
        const start = (lookahead: Token | number): [number, number] => {
            const token = (typeof lookahead === "number") ? this.input.peek(lookahead) : lookahead;
            return [token.line, token.column];
        }
        const end = (lookahead: Token | number): [number, number] => {
            const token = (typeof lookahead === "number") ? this.input.peek(lookahead) : lookahead;
            return [token.line, token.column + token.underlying.raw.length - 1];
        }
        if (ubound === undefined) {
            return new Program.Location(this.input.source, ...start(lbound), ...end(lbound));
        }
        return new Program.Location(this.input.source, ...start(lbound), ...end(ubound));
    }
    private throwUnexpected(message: string, lookahead: number, expected?: string): never {
        this.throw(this.unexpected(message, lookahead, expected));
    }
    private unexpected(message: string, lookahead: number, expected?: string): Failure {
        const token = this.input.peek(lookahead);
        return this.failure(message + ", but got {unexpected} instead", {
            source: this.input.source,
            line: token.line,
            column: token.column,
            expected: expected,
            unexpected: token.describe(),
        });
    }
    private failure(message: string, parameters: Logger.Parameters): Failure {
        return new Failure("{location}" + message, parameters);
    }
    private success(node: Node, lookahead: number): Success {
        return new Success(node, lookahead);
    }
    commit(success: Success): Node {
        assert(success.failed === false);
        this.input.drop(success.lookahead)
        return success.node;
    } 
    throw(failure: Failure): never {
        assert(failure.failed === true);
        assert(failure.logs.length > 0);
        let severist = failure.logs[0];
        for (const log of failure.logs) {
            this.logger.log(log);
            if (log.severity > severist.severity) {
                severist = log;
            }
        }
        throw new Parser.Exception(severist.message, severist.parameters);
    }
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
    fatal(message: string, parameters: Logger.Parameters): never {
        this.throw(this.failure(message, parameters));
    }
}

export class Parser {
    private _logger?: Logger;
    constructor(public input: Input) {
    }
    parse(): Parser.Node {
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
    export class Exception extends BaseException {
        constructor(message: string, parameters?: ExceptionParameters) {
            super("ParserException", ExceptionOrigin.Parser, message, parameters);
        }
    }
    export enum Kind {
        Module = "module",
        Identifier = "identifier",
        Literal = "literal",
        Variable = "variable",
        TypeInfer = "type-infer",
        TypeKeyword = "type-keyword",
        FunctionCall = "function-call",
        FunctionArguments = "function-arguments",
        OperatorTernary = "operator-ternary",
        OperatorBinary = "operator-binary",
        OperatorUnary = "operator-unary",
    }
    export interface Node {
        location: Program.Location;
        kind: Kind;
        children: Node[];
        value: Value;
    }
}
