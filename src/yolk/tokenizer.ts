import * as fs from "fs";

import { assert } from "./assertion";
import { Exception } from "./exception";
import { Location } from "./location";
import { Message } from "./message";

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

class InputFile implements Tokenizer.IInput {
    private input: string;
    constructor(path: fs.PathLike, private offset: number = 0) {
        this.input = fs.readFileSync(path, "utf8");
        this.source = path.toString();
    }
    source?: string;
    take(): number {
        const output = this.input.codePointAt(this.offset);
        if (this.input.charCodeAt(this.offset++) !== output) {
            this.offset++;
        }
        return output ?? -1;
    }
}

class InputString implements Tokenizer.IInput {
    constructor(private input: string, private offset: number = 0) {}
    source?: string;
    take(): number {
        const output = this.input.codePointAt(this.offset);
        if (this.input.charCodeAt(this.offset++) !== output) {
            this.offset++;
        }
        return output ?? -1;
    }
}

class Codepoint {
    constructor(public codepoint: number, public line: number, public column: number) {}
}

class Peeker {
    constructor(public input: Tokenizer.IInput) {}
    private previous: number = -1;
    private line: number = 1;
    private column: number = 1;
    private taken: Codepoint[] = [];
    private next(): Codepoint {
        const result = new Codepoint(this.input.take(), this.line, this.column);
        if (this.previous === 0x000D && result.codepoint === 0x000A) {
            // Collapse "\r\n" to "\n"
        } else if (isLineSeparator(result.codepoint)) {
            this.line++;
            this.column = 1;
        } else if (result.codepoint >= 0) {
            this.column++;
        }
        this.previous = result.codepoint;
        return result;
    }
    peek(lookahead: number) {
        // Fill the taken array with enough characters to satisfy the lookahead
        while (lookahead >= this.taken.length) {
            this.taken.push(this.next());
        }
        return this.taken[lookahead];
    }
    pop(count: number): string {
        assert(count > 0);
        assert(this.taken.length >= count);
        const output = String.fromCodePoint(...this.taken.slice(0, count).map(cp => cp.codepoint));
        this.taken = this.taken.slice(count);
        return output;
    }
}

class TokenizerException extends Exception {
    constructor(message: string, parameters?: Message.Parameters) {
        super(TokenizerException.name, Exception.Origin.Tokenizer, message, parameters);
    }
}

export class Tokenizer {
    private constructor(public peeker: Peeker) {}
    take(): Tokenizer.Token {
        const initial = this.peeker.peek(0);
        const success = (kind: Tokenizer.Kind, raw: string, value: bigint | number | string) => {
            return new Tokenizer.Token(kind, raw, value, initial.line, initial.column);
        }
        const fail = (message: string, line: number, column: number) => {
            const location = new Location(this.peeker.input.source ?? "", line, column);
            throw new TokenizerException(message, {location});
        }
        if (initial.codepoint < 0) {
            return success(Tokenizer.Kind.EOF, "", -1);
        }
        if (isLineSeparator(initial.codepoint) || isSpaceSeparator(initial.codepoint)) {
            let previous = -1;
            let count = 0;
            let value = "";
            let next = initial;
            for (;;) {
                if (previous === 0x000D && next.codepoint === 0x000A) {
                    // Collapse "\r\n" to "\n"
                } else if (isLineSeparator(next.codepoint)) {
                    // Normalize all line separators to "\n"
                    value += "\n";
                } else if (isSpaceSeparator(next.codepoint)) {
                    // Normalize all spaces to " "
                    value += " ";
                } else {
                    break;
                }
                previous = next.codepoint;
                next = this.peeker.peek(++count);
            }
            return success(Tokenizer.Kind.Whitespace, this.peeker.pop(count), value);
        }
        if (initial.codepoint === 0x002F) {
            // A slash
            if (this.peeker.peek(1).codepoint === 0x002A) {
                // A slash followed by an asterisk
                let previous = -1;
                let count = 2;
                let value = "/*";
                let next = this.peeker.peek(count);
                do {
                    if (next.codepoint < 0) {
                        // Premature end of input (report the start of the comment)
                        fail("Unterminated comment", next.line, next.column);
                    } else if (previous === 0x000D && next.codepoint === 0x000A) {
                        // Collapse "\r\n" to "\n"
                    } else if (isLineSeparator(next.codepoint)) {
                        // Normalize all line separators to "\n"
                        value += "\n";
                    } else if (isSpaceSeparator(next.codepoint)) {
                        // Normalize all spaces to " "
                        value += " ";
                    } else {
                        // Non-whitespace characters
                        value += String.fromCodePoint(next.codepoint);
                    }
                    previous = next.codepoint;
                    next = this.peeker.peek(++count);
                } while (previous != 0x002A || next.codepoint !== 0x002F);
                return success(Tokenizer.Kind.Comment, this.peeker.pop(count + 1), value + "/");
            }
            if (this.peeker.peek(1).codepoint === 0x002F) {
                // Two slashes
                let count = 2;
                let value = "//";
                let next = this.peeker.peek(count);
                while (next.codepoint >= 0) {
                    if (isLineSeparator(next.codepoint)) {
                        // Normalize all line separators to "\n"
                        value += "\n";
                        count++;
                        break;
                    } else if (isSpaceSeparator(next.codepoint)) {
                        // Normalize all spaces to " "
                        value += " ";
                    } else {
                        // Non-whitespace characters
                        value += String.fromCodePoint(next.codepoint);
                    }
                    next = this.peeker.peek(++count);
                }
                if (next.codepoint === 0x000D && this.peeker.peek(count).codepoint === 0x000A) {
                    // Collapse "\r\n" to "\n"
                    count++;
                }
                return success(Tokenizer.Kind.Comment, this.peeker.pop(count), value);
            }
        }
        if (isIdentifierStart(initial.codepoint)) {
            let count = 0;
            let next;
            do {
                next = this.peeker.peek(++count);
            } while (isIdentifierStart(next.codepoint) || isDigit(next.codepoint) || next.codepoint === 0x005F);
            const identifier = this.peeker.pop(count);
            return success(Tokenizer.Kind.Identifier, identifier, identifier);
        }
        if (isDigit(initial.codepoint)) {
            let count = 0;
            let next;
            do {
                next = this.peeker.peek(++count);
            } while (isDigit(next.codepoint));
            if (isIdentifierStart(next.codepoint) || next.codepoint === 0x005F) {
                fail(`Invalid character in number literal: '${String.fromCodePoint(next.codepoint)}'`, next.line, next.column);
            }
            if (next.codepoint !== 0x002E) {
                // No decimal point
                const output = this.peeker.pop(count);
                return success(Tokenizer.Kind.Integer, output, BigInt(output));
            }
            next = this.peeker.peek(++count);
            while (isDigit(next.codepoint)) {
                next = this.peeker.peek(++count);
            }
            const output = this.peeker.pop(count);
            return success(Tokenizer.Kind.Float, output, Number(output));
        }
        if (initial.codepoint === 0x0022) {
            // A double quote
            let value = "";
            let count = 1;
            let previous = initial.codepoint;
            let next;
            for (;;) {
                next = this.peeker.peek(count++);
                if (previous === 0x005C) {
                    // Backslash
                    switch (next.codepoint) {
                        case 0x0022: // Double quote
                            value += "\"";
                            break;
                        case 0x0030: // Null
                            value += "\0";
                            break;
                        case 0x005C: // Backslash
                            value += "\\";
                            previous = -1;
                            continue;
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
                            next = this.peeker.peek(count);
                            if (next.codepoint === 0x002B) { // Plus
                                let codepoint = 0;
                                let digits = 0;
                                let nybble = this.peeker.peek(++count);
                                while (nybble.codepoint !== 0x003B) { // Semicolon
                                    if (nybble.codepoint < 0) {
                                        // Report the location of the backslash
                                        fail("Unterminated Unicode escape sequence", next.line, next.column - 2);
                                    }
                                    if (nybble.codepoint >= 0x0030 && nybble.codepoint <= 0x0039) {
                                        codepoint = codepoint * 16 + nybble.codepoint - 0x0030;
                                    } else if (nybble.codepoint >= 0x0041 && nybble.codepoint <= 0x0046) {
                                        codepoint = codepoint * 16 + nybble.codepoint - 0x0041 + 10;
                                    } else if (nybble.codepoint >= 0x0061 && nybble.codepoint <= 0x0066) {
                                        codepoint = codepoint * 16 + nybble.codepoint - 0x0061 + 10;
                                    } else {
                                        fail("Invalid hexadecimal digit in Unicode escape sequence", nybble.line, nybble.column);
                                    }
                                    if (++digits > 6) {
                                        fail("Too many hexadecimal digits in Unicode escape sequence", nybble.line, nybble.column);
                                    }
                                    nybble = this.peeker.peek(++count);
                                }
                                if (digits === 0) {
                                    fail("Empty Unicode escape sequence", nybble.line, nybble.column);
                                }
                                if (codepoint > 0x10FFFF) {
                                    fail("Unicode codepoint out of range", nybble.line, nybble.column);
                                }
                                value += String.fromCodePoint(codepoint);
                                count++;
                            } else {
                                // Report the position of the backslash
                                fail("Expected '+' after '\\u' in Unicode escape sequence", next.line, next.column - 2);
                            }
                            break;
                        case 0x0076: // Vertical tab
                            value += "\v";
                            break;
                        default:
                            if (isLineSeparator(next.codepoint)) {
                                // Multi-line string
                                if (next.codepoint === 0x000D && this.peeker.peek(count).codepoint === 0x000A) {
                                    // Collapse "\r\n" to "\n"
                                    count++;
                                }
                            } else {
                                // Report the position after the backslash
                                fail("Invalid string escape sequence", next.line, next.column);
                            }
                            break;
                    }
                } else if (next.codepoint === 0x0022) {
                    // An unescaped double quote
                    break;
                } else if (next.codepoint === 0x005C) {
                    // An unescaped backslash
                } else if (next.codepoint < 0) {
                    // Premature end of input (report the location of the start)
                    fail("Unterminated string", next.line, next.column);
                } else if (isLineSeparator(next.codepoint)) {
                    // Newline in string
                    fail("End of line within string literal", next.line, next.column);
                } else {
                    // Any other character
                    value += String.fromCodePoint(next.codepoint);
                }
                previous = next.codepoint;
            }
            return success(Tokenizer.Kind.String, this.peeker.pop(count), value);
        }
        const output = this.peeker.pop(1);
        return success(Tokenizer.Kind.Punctuation, output, output);
    }
    static fromFile(path: fs.PathLike): Tokenizer {
        return new Tokenizer(new Peeker(new InputFile(path)));
    }
    static fromString(text: string): Tokenizer {
        return new Tokenizer(new Peeker(new InputString(text)));
    }
}

export namespace Tokenizer {
    export enum Kind {
        Whitespace,
        Comment,
        Identifier,
        Integer,
        Float,
        String,
        Punctuation,
        EOF
    };
    export class Token {
        constructor(
            public readonly kind: Kind,
            public readonly raw: string,
            public readonly value: bigint | number | string,
            public readonly line: number,
            public readonly column: number,
        ) {}
    }
    export interface IInput {
        readonly source?: string;
        take(): number;
    }
}
