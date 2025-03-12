import { BaseException, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
import { Tokenizer } from "./tokenizer";

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
        console.assert(lookahead >= 0);
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
        console.assert(count > 0);
        console.assert(this.taken.length >= count);
        this.taken = this.taken.slice(count);
    }
}

enum Kind {
    Identifier = "identifier",
    NullLiteral = "null-literal",
    BooleanLiteral = "boolean-literal",
    IntegerLiteral = "integer-literal",
    StringLiteral = "string-literal",
    FunctionArguments = "function-arguments",
}

class Node implements Parser.Node {
    private constructor(public kind: Kind, public children: Node[], public value?: boolean | number | string) {}
    static createNullLiteral(): Node {
        return new Node(Kind.NullLiteral, []);
    }
    static createBooleanLiteral(value: boolean): Node {
        return new Node(Kind.NullLiteral, [], value);
    }
    static createIntegerLiteral(value: number): Node {
        return new Node(Kind.IntegerLiteral, [], value);
    }
    static createStringLiteral(value: string): Node {
        return new Node(Kind.StringLiteral, [], value);
    }
    static createIdentifier(name: string): Node {
        return new Node(Kind.Identifier, [], name);
    }
    static createFunctionArguments(nodes: Node[]): Node {
        return new Node(Kind.FunctionArguments, nodes);
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
    parseModule(): Parser.Node {
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
        return { children } as Parser.Node;
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
        let success;
        if ((success = this.parseIdentifier(lookahead))) {
            if (this.peekPunctuation(success.lookahead) === "(") {
                return this.expectFunctionArguments(success.lookahead);
            }
        }
        return undefined;
    }
    private expectFunctionArguments(lookahead: number): Success {
        console.assert(this.peekPunctuation(lookahead) === "(");
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
        console.assert(this.peekPunctuation(lookahead) === ")");
        return this.success(Node.createFunctionArguments(nodes), lookahead + 1);
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
            const node = Node.createNullLiteral();
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseBooleanLiteral(lookahead: number): Success | undefined {
        switch (this.peekKeyword(lookahead)) {
            case "false":
                return this.success(Node.createBooleanLiteral(false), lookahead + 1);
            case "true":
                return this.success(Node.createBooleanLiteral(true), lookahead + 1);
            }
        return undefined;
    }
    private parseIntegerLiteral(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.Integer) {
            const node = Node.createIntegerLiteral(token.value as number);
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseStringLiteral(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token.kind === Tokenizer.Kind.String) {
            const node = Node.createStringLiteral(token.value as string);
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private expectFunctionArgument(lookahead: number): Success {
        return this.parseNullLiteral(lookahead)
            ?? this.parseBooleanLiteral(lookahead)
            ?? this.parseIntegerLiteral(lookahead)
            ?? this.parseStringLiteral(lookahead)
            ?? this.throwUnexpected("Expected function argument", lookahead); // TODO
    }
    private expectSemicolon(success: Success): Success {
        if (this.peekPunctuation(success.lookahead) === ";") {
            return new Success(success.node, success.lookahead + 1);
        }
        this.throwUnexpected("Expected semicolon", success.lookahead, ";");
    }
    private expectPunctuation(lookahead: number, expected: string): void {
        if (this.peekPunctuation(lookahead) !== expected) {
            this.throwUnexpected("Expected '{expected}'", lookahead, expected);
        }
    }
    private peekKeyword(lookahead: number): string {
        const token = this.input.peek(lookahead);
        return token.kind === Tokenizer.Kind.Identifier ? String(token.value) : "";
    }
    private peekPunctuation(lookahead: number): string {
        const token = this.input.peek(lookahead);
        return token.kind === Tokenizer.Kind.Punctuation ? String(token.value) : "";
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
        console.assert(success.failed === false);
        this.input.drop(success.lookahead)
        return success.node;
    } 
    throw(failure: Failure): never {
        console.assert(failure.failed === true);
        console.assert(failure.logs.length > 0);
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
    constructor(private input: Input) {
    }
    parse(): Parser.Node {
        const impl = new Impl(this.input, this.logger);
        return impl.parseModule();
    }
    withLogger(logger: Logger): Parser {
        this._logger = logger;
        return this;
    }
    get logger() {
        return this._logger ??= new ConsoleLogger();
    }
    static fromString(input: string, source?: string): Parser {
        return new Parser(new Input(source ?? "", Tokenizer.fromString(input)));
    }
}

export namespace Parser {
    export class Exception extends BaseException {
        constructor(message: string, parameters?: ExceptionParameters) {
            super("ParserException", message, parameters);
        }
    }
    export interface Node {
        children: Node[];
    }
}
