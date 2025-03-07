import { BaseException, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
import { Tokenizer } from "./tokenizer";

class Token {
    constructor(public underlying?: Tokenizer.Token, public previous?: Tokenizer.Type) {}
}

class Input {
    private taken: Token[] = [];
    private previous?: Tokenizer.Type;
    constructor(public tokenizer: Tokenizer) {}
    peek(lookahead: number = 0): Token {
        // Fill the taken array with enough tokens to satisfy the lookahead
        console.assert(lookahead >= 0);
        while (lookahead >= this.taken.length) {
            const incoming = this.tokenizer.take();
            if (incoming === undefined) {
                return new Token(undefined, this.previous);
            }
            if (incoming.type !== Tokenizer.Type.Whitespace && incoming.type !== Tokenizer.Type.Comment) {
                this.taken.push(new Token(incoming, this.previous));
            }
            this.previous = incoming.type;
        }
        return this.taken[lookahead];
    }
    drop(count: number): void {
        console.assert(count > 0);
        console.assert(this.taken.length >= count);
        this.taken = this.taken.slice(count);
    }
}

class Node implements Parser.Node {
    type: unknown;
    children: Node[] = [];
}

class Impl extends Logger {
    warnings = 0;
    errors = 0;
    constructor(public input: Input, public logger: Logger) {
        super();
    }
    parseModule(): Parser.Output {
        if (this.input.peek().previous === undefined) {
            this.fatal("Empty input");
        }
        const children = [];
        for (let node; (node = this.parseModuleStatement()); ) {
            children.push(node);
        }
        return {
            warnings: this.warnings,
            errors: this.errors,
            root: { children }
        } as Parser.Output;
    }
    private parseModuleStatement(): Node | undefined {
        return;
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
