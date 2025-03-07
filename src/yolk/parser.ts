import { BaseException, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
import { Tokenizer } from "./tokenizer";

class Token {
    constructor(public underlying?: Tokenizer.Token, public previous?: Tokenizer.Kind) {}
    get kind() {
        return this.underlying?.kind;
    }
    get value() {
        return this.underlying?.value;
    }
    describe(): string {
        switch (this.underlying?.kind) {
            case Tokenizer.Kind.Identifier:
            case Tokenizer.Kind.Punctuation:
                return `'${this.underlying.value}'`;
            case Tokenizer.Kind.Integer:
                return `integer literal`;
            case Tokenizer.Kind.Float:
                return `float literal`;
            case Tokenizer.Kind.String:
                return `string literal`;
            case null:
                return `end-of-file`;
        }
        return JSON.stringify(this.underlying);
    }
}

class Input {
    private taken: Token[] = [];
    private previous?: Tokenizer.Kind;
    constructor(public tokenizer: Tokenizer) {}
    peek(lookahead: number = 0): Token {
        // Fill the taken array with enough tokens to satisfy the lookahead
        console.assert(lookahead >= 0);
        while (lookahead >= this.taken.length) {
            const incoming = this.tokenizer.take();
            if (incoming === undefined) {
                return new Token(undefined, this.previous);
            }
            if (incoming.kind !== Tokenizer.Kind.Whitespace && incoming.kind !== Tokenizer.Kind.Comment) {
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
    StringLiteral = "string-literal",
}

class Node implements Parser.Node {
    children: Node[] = [];
    constructor(public kind: Kind, public value: unknown) {}
    static createIdentifier(name: string): Node {
        return new Node(Kind.Identifier, name);
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
    warnings = 0;
    errors = 0;
    constructor(public input: Input, public logger: Logger) {
        super();
    }
    parseModule(): Parser.Output {
        let incoming = this.input.peek();
        if (incoming.underlying === undefined && incoming.previous === undefined) {
            this.fatal("Empty input");
        }
        const children = [];
        while (incoming.underlying !== undefined) {
            const node = this.parseModuleStatement();
            children.push(node);
            incoming = this.input.peek();
        }
        return {
            warnings: this.warnings,
            errors: this.errors,
            root: { children }
        } as Parser.Output;
    }
    private parseModuleStatement(): Node {
        let success;
        if ((success = this.parseFunctionCall(0))) {
            success = this.expectSemicolon(success);
            return this.commit(success);
        };
        this.unexpected("Expected module statement", 0);
    }
    private parseFunctionCall(lookahead: number): Success | undefined {
        let success;
        if ((success = this.parseIdentifier(lookahead))) {
            if (this.peekPunctuation(success.lookahead) === "(") {
                return this.parseFunctionArguments(success.lookahead);
            }
        }
        return undefined;
    }
    private parseFunctionArguments(lookahead: number): Success {
        console.assert(this.peekPunctuation(lookahead) === "(");
        const argument = this.parseStringLiteral(lookahead + 1) ?? this.unexpected("Expected string literal", lookahead + 1); // TODO
        this.expectPunctuation(argument.lookahead, ")");
        return this.success(argument.node, argument.lookahead + 1);
    }
    private parseIdentifier(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token?.kind === Tokenizer.Kind.Identifier) {
            const node = Node.createIdentifier(token.value as string);
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private parseStringLiteral(lookahead: number): Success | undefined {
        const token = this.input.peek(lookahead);
        if (token?.kind === Tokenizer.Kind.String) {
            const node = Node.createIdentifier(token.value as string);
            return this.success(node, lookahead + 1);
        }
        return undefined;
    }
    private expectSemicolon(success: Success): Success {
        if (this.peekPunctuation(success.lookahead) === ";") {
            return new Success(success.node, success.lookahead + 1);
        }
        this.unexpected("Expected semicolon", success.lookahead, ";");
    }
    private expectPunctuation(lookahead: number, expected: string): void {
        if (this.peekPunctuation(lookahead) !== expected) {
            this.unexpected("Expected '{expected}'", lookahead, expected);
        }
    }
    private peekPunctuation(lookahead: number): string {
        const token = this.input.peek(lookahead);
        return token?.kind === Tokenizer.Kind.Punctuation ? String(token.value) : "";
    }
    private unexpected(message: string, lookahead: number, expected?: string): never {
        const token = this.input.peek(lookahead);
        this.throw(new Failure(message + ", but got {unexpected} instead", { expected: expected, unexpected: token.describe() }));
    }
    private failure(message: string, parameters?: Logger.Parameters): Failure {
        return new Failure(message, parameters);
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
        const entry = failure.logs[0];
        throw new Parser.Exception(entry.message, entry.parameters);
    }
    log(entry: Logger.Entry): void {
        switch (entry.severity) {
            case Logger.Severity.Error:
                this.errors++;
                break;
            case Logger.Severity.Warning:
                this.warnings++;
                break;
        }
        this.logger.log(entry);
    }
    fatal(message: string, parameters?: Logger.Parameters): never {
        this.error(message, parameters);
        throw new Parser.Exception(message, parameters);
    }
}

export class Parser {
    private logger?: Logger;
    private constructor(private tokenizer: Tokenizer) {
    }
    parse(): Parser.Output {
        const input = new Input(this.tokenizer);
        const impl = new Impl(input, this.logger ?? new ConsoleLogger());
        return impl.parseModule();
    }
    withLogger(logger: Logger): Parser {
        this.logger = logger;
        return this;
    }
    static fromString(input: string): Parser {
        return new Parser(Tokenizer.fromString(input));
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
    export interface Output {
        warnings: number;
        errors: number;
        root: Node;
    }
}
