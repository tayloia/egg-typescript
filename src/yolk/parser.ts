import { assert } from "./assertion";
import { BaseException, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
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
    private constructor(public kind: Parser.Kind, public children: Node[] = [], public value: Value = Value.VOID) {}
    static createModule(children: Node[]): Node {
        return new Node(Parser.Kind.Module, children);
    }
    static createIdentifier(name: string): Node {
        return new Node(Parser.Kind.Identifier, [], Value.fromString(name));
    }
    static createLiteral(value: Value): Node {
        return new Node(Parser.Kind.Literal, [], value);
    }
    static createFunctionCall(callee: Node, fnargs: Node): Node {
        assert.eq(fnargs.kind, Parser.Kind.FunctionArguments);
        return new Node(Parser.Kind.FunctionCall, [callee, fnargs]);
    }
    static createFunctionArguments(nodes: Node[]): Node {
        return new Node(Parser.Kind.FunctionArguments, nodes);
    }
    static createOperatorTernary(lhs: Node, mid: Node, rhs: Node, op: string): Node {
        return new Node(Parser.Kind.OperatorTernary, [lhs, mid, rhs], Value.fromString(op));
    }
    static createOperatorBinary(lhs: Node, rhs: Node, op: string): Node {
        return new Node(Parser.Kind.OperatorBinary, [lhs, rhs], Value.fromString(op));
    }
    static createOperatorUnary(rhs: Node, op: string): Node {
        return new Node(Parser.Kind.OperatorBinary, [rhs], Value.fromString(op));
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
        return Node.createModule(children);
    }
    private expectModuleStatement(): Node {
        let success;
        if ((success = this.parseFunctionCall(0))) {
            success = this.expectSemicolon(success);
            return this.commit(success);
        };
        this.throwUnexpected("Expected module statement", 0);
    }
    private parseFunctionCall(lookahead: number): Success | undefined {
        let callee;
        if ((callee = this.parseIdentifier(lookahead))) {
            if (this.peekPunctuation(callee.lookahead) === "(") {
                const fnargs = this.expectFunctionArguments(callee.lookahead);
                return new Success(Node.createFunctionCall(callee.node, fnargs.node), fnargs.lookahead);
            }
        }
        return undefined;
    }
    private expectFunctionArguments(lookahead: number): Success {
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
        return this.success(Node.createFunctionArguments(nodes), lookahead + 1);
    }
    private expectFunctionArgument(lookahead: number): Success {
        return this.parseExpression(lookahead)
            ?? this.throwUnexpected("Expected function argument", lookahead);
    }
    private parseExpression(lookahead: number): Success | undefined {
        return this.parseValueExpression(lookahead)
            ?? this.parseTypeExpression(lookahead);
    }
    private parseTypeExpression(lookahead_: number): Success | undefined {
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
                    return this.success(Node.createOperatorTernary(lhs.node, mid.node, rhs.node, "?:"), rhs.lookahead);
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
                return this.success(Node.createOperatorBinary(lhs.node, rhs.node, op), rhs.lookahead);
            }
        }
        return undefined;
    }
    private parseValueExpressionUnary(lookahead: number): Success | undefined {
        return this.parseValueExpressionPrimary(lookahead);
    }
    private parseValueExpressionPrimary(lookahead: number): Success | undefined {
        return this.parseNullLiteral(lookahead)
            ?? this.parseBooleanLiteral(lookahead)
            ?? this.parseIntegerLiteral(lookahead)
            ?? this.parseStringLiteral(lookahead);
    }
    private parseIdentifier(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.Identifier) {
            const node = Node.createIdentifier(token.value as string);
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseNullLiteral(lookahead: number): Success | undefined {
        if (this.peekKeyword(lookahead) === "null") {
            const node = Node.createLiteral(Value.NULL);
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseBooleanLiteral(lookahead: number): Success | undefined {
        switch (this.peekKeyword(lookahead)) {
            case "false":
                return this.success(Node.createLiteral(Value.FALSE), lookahead + 1);
            case "true":
                return this.success(Node.createLiteral(Value.TRUE), lookahead + 1);
            }
        return undefined;
    }
    private parseIntegerLiteral(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.Integer) {
            const node = Node.createLiteral(Value.fromInt(token.value as bigint));
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseStringLiteral(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.String) {
            const node = Node.createLiteral(Value.fromString(token.value as string));
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private expectSemicolon(success: Success): Success {
        if (this.peekPunctuation(success.lookahead) === ";") {
            return new Success(success.node, success.lookahead + 1);
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
            super("ParserException", message, parameters);
        }
    }
    export enum Kind {
        Module = "module",
        Identifier = "identifier",
        Literal = "literal",
        FunctionCall = "function-call",
        FunctionArguments = "function-arguments",
        OperatorTernary = "operator-ternary",
        OperatorBinary = "operator-binary",
        OperatorUnary = "operator-unary",
    }
    export interface Node {
        kind: Kind;
        children: Node[];
        value: Value;
    }
}
