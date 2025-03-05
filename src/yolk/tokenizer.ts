function isLineSeparator(codepoint: number): boolean {
    switch (codepoint) {
        case 0x000A: // Line feed
        case 0x000B: // Vertical tab
        case 0x000C: // Form feed
        case 0x000D: // Carriage return
        case 0x0085: // Next line
        case 0x2028: // Line separator
        case 0x2029: // Paragraph separator
            return true;
    }
    return false;
}

function isSpaceSeparator(codepoint: number): boolean {
    switch (codepoint) {
        case 0x0009: // Horizontal tab '\t'
        case 0x0020: // Space
        case 0x00A0: // No-break space
        case 0x1680: // Ogham space mark
        case 0x2000: // En quad
        case 0x2001: // Em quad
        case 0x2002: // En space
        case 0x2003: // Em space
        case 0x2004: // Three-per-em space
        case 0x2005: // Four-per-em space
        case 0x2006: // Six-per-em space
        case 0x2007: // Figure space
        case 0x2008: // Punctuation space
        case 0x2009: // Thin space
        case 0x200A: // Hair space
        case 0x202F: // Narrow no-break space
        case 0x205F: // Medium mathematical space
        case 0x3000: // Ideographic space
            return true;
    }
    return false;
}

function isDigit(codepoint: number): boolean {
    return codepoint >= 0x0030 && codepoint <= 0x0039;
}

function isIdentifierStart(codepoint: number): boolean {
    return (codepoint >= 0x0041 && codepoint <= 0x005A) || (codepoint >= 0x0061 && codepoint <= 0x007A) || (codepoint === 0x005F);
}

class InputString implements Tokenizer.Input {
    constructor(private input: string, private offset: number = 0) {}
    take(): number {
        const output = this.input.codePointAt(this.offset);
        if (this.input.charCodeAt(this.offset++) !== output) {
            this.offset++;
        }
        return output ?? -1;
    }
}

export class Tokenizer {
    private taken: number[] = [];
    private constructor(private input: Tokenizer.Input) {}
    private peek(lookahead: number = 0) {
        // Fill the taken array with enough characters to satisfy the lookahead
        while (lookahead >= this.taken.length) {
            this.taken.push(this.input.take());
        }
        return this.taken[lookahead];
    }
    private pop(count: number = 1): string {
        console.assert(count > 0);
        console.assert(this.taken.length >= count);
        const output = String.fromCodePoint(...this.taken.slice(0, count));
        this.taken = this.taken.slice(count);
        return output;
    }
    take(): Tokenizer.Token | undefined {
        let next = this.peek();
        if (next < 0) {
            return undefined;
        }
        if (isLineSeparator(next) || isSpaceSeparator(next)) {
            let previous = -1;
            let count = 0;
            let value = "";
            do {
                if (previous === 0x000D && next === 0x000A) {
                    // Collapse "\r\n" to "\n"
                } else if (isLineSeparator(next)) {
                    // Normalize all line separators to "\n"
                    value += "\n";
                } else {
                    // Normalize all spaces to " "
                    value += " ";
                }
                previous = next;
                next = this.peek(++count);
            } while (isLineSeparator(next) || isSpaceSeparator(next));
            return new Tokenizer.Token("whitespace", this.pop(count), value);
        }
        if (next === 0x002F) {
            // A slash
            if (this.peek(1) === 0x002A) {
                // A slash followed by an asterisk
                let previous = -1;
                let count = 2;
                let value = "/*";
                next = this.peek(count);
                do {
                    if (previous === 0x000D && next === 0x000A) {
                        // Collapse "\r\n" to "\n"
                    } else if (isLineSeparator(next)) {
                        // Normalize all line separators to "\n"
                        value += "\n";
                    } else if (isSpaceSeparator(next)) {
                        // Normalize all spaces to " "
                        value += " ";
                    } else {
                        // Non-whitespace characters
                        value += String.fromCodePoint(next);
                    }
                    previous = next;
                    next = this.peek(++count);
                } while (previous != 0x002A || next !== 0x002F);
                return new Tokenizer.Token("comment", this.pop(count + 1), value + "/");
            }
            if (this.peek(1) === 0x002F) {
                // Two slashes
                let count = 2;
                let value = "//";
                next = this.peek(count);
                while (next >= 0) {
                    if (isLineSeparator(next)) {
                        // Normalize all line separators to "\n"
                        value += "\n";
                        count++;
                        break;
                    } else if (isSpaceSeparator(next)) {
                        // Normalize all spaces to " "
                        value += " ";
                    } else {
                        // Non-whitespace characters
                        value += String.fromCodePoint(next);
                    }
                    next = this.peek(++count);
                }
                if (next === 0x000D && this.peek(count) === 0x000A) {
                    // Collapse "\r\n" to "\n"
                    count++;
                }
                return new Tokenizer.Token("comment", this.pop(count), value);
            }
        }
        if (isIdentifierStart(next)) {
            let count = 0;
            do {
                next = this.peek(++count);
            } while (isIdentifierStart(next) || isDigit(next));
            const identifier = this.pop(count);
            return new Tokenizer.Token("identifier", identifier, identifier);
        }
        if (isDigit(next)) {
            let count = 0;
            do {
                next = this.peek(++count);
            } while (isDigit(next));
            if (next !== 0x002E) {
                // No decimal point
                const output = this.pop(count);
                return new Tokenizer.Token("integer", output, Number(output));
            }
            next = this.peek(++count);
            while (isDigit(next)) {
                next = this.peek(++count);
            }
            const output = this.pop(count);
            return new Tokenizer.Token("float", output, Number(output));
        }
        if (next === 0x0022) {
            // A double quote
            let count = 1;
            do {
                next = this.peek(count++);
            } while (next !== 0x0022);
            const output = this.pop(count);
            return new Tokenizer.Token("string", output, output.slice(1, -1));
        }
        const output = this.pop(1);
        return new Tokenizer.Token("symbol", output, output);
    }
    static fromString(input: string): Tokenizer {
        return new Tokenizer(new InputString(input));
    }
}

export namespace Tokenizer {
    export class TokenizerError extends Error {
        constructor(message: string) {
            super(message);
            this.name = "TokenizerError";
        }
    }
    export type TokenType = "whitespace" | "comment" | "identifier" | "integer" | "float" | "string" | "symbol";
    export class Token {
        constructor(
            public readonly type: TokenType,
            public readonly raw: string,
            public readonly value: string | number,
        ) {}
    }
    export interface Input {
        take(): number;
    }
}
