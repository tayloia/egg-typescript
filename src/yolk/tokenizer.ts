import { BaseException } from "./exception";

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
    private line: number = 1;
    private column: number = 1;
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
        const line = this.line;
        const column = this.column;
        const success = (type: Tokenizer.TokenType, raw: string, value: number | string) => {
            return new Tokenizer.Token(type, raw, value, line, column);
        }
        const fail = (message: string) => {
            throw new Tokenizer.Exception("{location}" + message, { line: this.line, column: this.column });
        }
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
            this.column += count;
            return success("whitespace", this.pop(count), value);
        }
        if (next === 0x002F) {
            // A slash
            if (this.peek(1) === 0x002A) {
                // A slash followed by an asterisk
                let previous = -1;
                let count = 2;
                let value = "/*";
                this.column += 2;
                next = this.peek(count);
                do {
                    if (next < 0) {
                        // Premature end of input (report the start of the comment)
                        this.line = line;
                        this.column = column;
                        fail("Unterminated comment");
                    } else if (previous === 0x000D && next === 0x000A) {
                        // Collapse "\r\n" to "\n"
                    } else if (isLineSeparator(next)) {
                        // Normalize all line separators to "\n"
                        this.line++;
                        this.column = 1;
                        value += "\n";
                    } else if (isSpaceSeparator(next)) {
                        // Normalize all spaces to " "
                        this.column++;
                        value += " ";
                    } else {
                        // Non-whitespace characters
                        this.column++;
                        value += String.fromCodePoint(next);
                    }
                    previous = next;
                    next = this.peek(++count);
                } while (previous != 0x002A || next !== 0x002F);
                this.column++;
                return success("comment", this.pop(count + 1), value + "/");
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
                this.column += count;
                return success("comment", this.pop(count), value);
            }
        }
        if (isIdentifierStart(next)) {
            let count = 0;
            do {
                next = this.peek(++count);
            } while (isIdentifierStart(next) || isDigit(next) || next === 0x005F);
            const identifier = this.pop(count);
            this.column += count;
            return success("identifier", identifier, identifier);
        }
        if (isDigit(next)) {
            let count = 0;
            do {
                next = this.peek(++count);
            } while (isDigit(next));
            if (isIdentifierStart(next) || next === 0x005F) {
                this.column += count;
                fail(`Invalid character in number literal: '${String.fromCodePoint(next)}'`);
            }
            if (next !== 0x002E) {
                // No decimal point
                const output = this.pop(count);
                this.column += count;
                return success("integer", output, Number(output));
            }
            next = this.peek(++count);
            while (isDigit(next)) {
                next = this.peek(++count);
            }
            const output = this.pop(count);
            this.column += count;
            return success("float", output, Number(output));
        }
        if (next === 0x0022) {
            // A double quote
            let value = "";
            let count = 1;
            this.column++;
            for (;;) {
                const previous = next;
                next = this.peek(count++);
                if (previous === 0x005C) {
                    // Backslash
                    this.column++;
                    switch (next) {
                        case 0x0022: // Double quote
                            value += "\"";
                            break;
                        case 0x0030: // Null
                            value += "\0";
                            break;
                        case 0x005C: // Backslash
                            value += "\\";
                            next = -1;
                            break;
                        case 0x0061: // Alert
                            value += "\u0007";
                            break;
                        case 0x0062: // Backspace
                            value += "\b";
                            break;
                        case 0x0065: // Escape
                            value += "\u001B";
                            break;
                        case 0x0066: // Form feed
                            value += "\f";
                            break;
                        case 0x006E: // New line
                            value += "\n";
                            break;
                        case 0x0072: // Carriage return
                            value += "\r";
                            break;
                        case 0x0074: // Horizontal tab
                            value += "\t";
                            break;
                        case 0x0075: // Unicode escape
                            // \u+hhhhhh;
                            if (this.peek(count) === 0x002B) { // Plus
                                let codepoint = 0;
                                let digits = 0;
                                next = this.peek(++count);
                                while (next !== 0x003B) { // Semicolon
                                    if (next < 0) {
                                        // Report the location of the backslash
                                        this.column -= digits + 2;
                                        fail("Unterminated Unicode escape sequence");
                                    }
                                    this.column++;
                                    if (next >= 0x0030 && next <= 0x0039) {
                                        codepoint = codepoint * 16 + next - 0x0030;
                                    } else if (next >= 0x0041 && next <= 0x0046) {
                                        codepoint = codepoint * 16 + next - 0x0041 + 10;
                                    } else if (next >= 0x0061 && next <= 0x0066) {
                                        codepoint = codepoint * 16 + next - 0x0061 + 10;
                                    } else {
                                        fail("Invalid hexadecimal digit in Unicode escape sequence");
                                    }
                                    if (++digits > 6) {
                                        fail("Too many hexadecimal digits in Unicode escape sequence");
                                    }
                                    next = this.peek(++count);
                                }
                                this.column++;
                                if (digits === 0) {
                                    fail("Empty Unicode escape sequence");
                                }
                                if (codepoint > 0x10FFFF) {
                                    fail("Unicode codepoint out of range");
                                }
                                value += String.fromCodePoint(codepoint);
                                count++;
                            } else {
                                // Report the position of the backslash
                                this.column -= 2;
                                fail("Expected '+' after '\\u' in Unicode escape sequence");
                            }
                            break;
                        case 0x0076: // Vertical tab
                            value += "\v";
                            break;
                        default:
                            if (isLineSeparator(next)) {
                                // Multi-line string
                                if (next === 0x000D && this.peek(count) === 0x000A) {
                                    // Collapse "\r\n" to "\n"
                                    count++;
                                }
                                this.line++;
                                this.column = 1;
                            } else {
                                // Report the position of the backslash
                                this.column--;
                                fail("Invalid string escape sequence");
                            }
                            break;
                    }
                } else if (next === 0x0022) {
                    // An unescaped double quote
                    break;
                } else if (next === 0x005C) {
                    // An unescaped backslash
                    this.column++;
                } else if (next < 0) {
                    // Premature end of input (report the location of the start)
                    this.line = line;
                    this.column = column;
                    fail("Unterminated string");
                } else if (isLineSeparator(next)) {
                    // Newline in string
                    this.column--;
                    fail("End of line within string literal");
                } else {
                    // Any other character
                    value += String.fromCodePoint(next);
                    this.column++;
                }
            }
            this.column++;
            return success("string", this.pop(count), value);
        }
        const output = this.pop(1);
        this.column++;
        return success("punctuation", output, output);
    }
    static fromString(input: string): Tokenizer {
        return new Tokenizer(new InputString(input));
    }
}

export namespace Tokenizer {
    export class Exception extends BaseException {
        constructor(message: string, parameters: Record<string, unknown> = {}) {
            super("TokenizerException", message, parameters);
        }
    }
    export type TokenType = "whitespace" | "comment" | "identifier" | "integer" | "float" | "string" | "punctuation";
    export class Token {
        constructor(
            public readonly type: TokenType,
            public readonly raw: string,
            public readonly value: string | number,
            public readonly line: number,
            public readonly column: number,
        ) {}
    }
    export interface Input {
        take(): number;
    }
}
