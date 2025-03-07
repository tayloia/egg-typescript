import { expect } from "chai";

import { Tokenizer } from "../tokenizer";

describe("Tokenizer", function() {
    function* tokenize(input: string): Generator<Tokenizer.Token> {
        const tokenizer = Tokenizer.fromString(input);
        let raw = "";
        for (let token; token = tokenizer.take(); raw += token.raw) {
            yield token;
        }
        expect(raw).equal(input);
    }
    function tokenizeOne(input: string): Tokenizer.Token {
        const tokenizer = Tokenizer.fromString(input);
        const token = tokenizer.take();
        expect(token).not.undefined;
        expect(token?.raw).equal(input);
        expect(tokenizer.take()).undefined;
        return token!;
    }
    function tokenizeMany(input: string): string[] {
        const output: string[] = [];
        for (let token of tokenize(input)) {
            switch (token.type) {
                case "whitespace":
                    break;
                case "comment":
                    output.push(`${token.value}`);
                    break;
                case "identifier":
                    output.push(`${token.value}`);
                    break;
                case "integer":
                case "float":
                case "string":
                    output.push(JSON.stringify(token.value));
                    break;
                case "punctuation":
                    output.push(`'${token.value}'`);
                    break;
                default:
                    expect.fail(`Unexpected token type: ${JSON.stringify(token)}`);
            }
        }
        return output;
    }
    function tokenizeBad(input: string): () => unknown {
        return () => Tokenizer.fromString(input).take();
    }
    describe("whitespace", function() {
        it("should accept empty input", function() {
            const tokenizer = Tokenizer.fromString("");
            const token = tokenizer.take();
            expect(token).undefined;
            expect(tokenizer.take()).undefined;
        });
        it("should accept ASCII whitespace", function() {
            const input = " \t\f\v\n\r";
            const token = tokenizeOne(input);
            expect(token.type).equal("whitespace");
            expect(token.value).equal("  \n\n\n\n");
        });
        it("should accept Unicode whitespace", function() {
            const input = "\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u0085\u2028\u2029";
            const token = tokenizeOne(input);
            expect(token.type).equal("whitespace");
            expect(token.value).equal("                \n\n\n");
        });
        it("should translate CRLF whitespace", function() {
            const input = "\n \r \r\n \n\r";
            const token = tokenizeOne(input);
            expect(token.type).equal("whitespace");
            expect(token.value).equal("\n \n \n \n\n");
        });
    });
    describe("identifiers", function() {
        [
            "hello",
            "hello_123",
            "_",
        ].forEach(input => it(`should accept identifier "${input}"`, function() {
            const token = tokenizeOne(input);
            expect(token.type).equal("identifier");
            expect(token.value).equal(input);
        }));
    });
    describe("integers", function() {
        const cases: [string, number][] = [
            ["0", 0],
            ["123", 123],
            ["1234567890", 1234567890],
        ];
        cases.forEach(([input, expected]) => it(`should accept integer "${input}"`, function() {
            const token = tokenizeOne(input);
            expect(token.type).equal("integer");
            expect(token.value).equal(expected);
        }));
        it("should reject bad integers", function() {
            expect(tokenizeBad("1e6")).throws("(1,2): Invalid character in number literal: 'e'");
            expect(tokenizeBad("0x00")).throws("(1,2): Invalid character in number literal: 'x'");
            expect(tokenizeBad("012_345")).throws("(1,4): Invalid character in number literal: '_'");
        })
    });
    describe("floats", function() {
        const cases: [string, number][] = [
            ["0.0", 0.0],
            ["123.45", 123.45],
            ["1234567890.12345", 1234567890.12345],
        ];
        cases.forEach(([input, expected]) => it(`should accept float "${input}"`, function() {
            const token = tokenizeOne(input);
            expect(token.type).equal("float");
            expect(token.value).equal(expected);
        }));
    });
    describe("strings", function() {
        [
            "hello world",
            "quote=\"",
            "backslash=\\",
            "backspace=\b",
            "formfeed=\f",
            "newline=\n",
            "return=\r",
            "tab=\t",
            "",
        ].forEach(input => it(`should accept string ${JSON.stringify(input)}`, function() {
            const token = tokenizeOne(JSON.stringify(input));
            expect(token.type).equal("string");
            expect(token.value).equal(input);
        }));
        "0,1,12,123,1234,12345,F,FF,FFF,FFFF,FFFFF,10FFFF".split(",").forEach(hex => {
            const input = `"unicode=\\u+${hex};"`;
            it(`should accept string ${input}`, function() {
                const token = tokenizeOne(input);
                expect(token.type).equal("string");
                expect(token.value).equal("unicode=" + String.fromCodePoint(Number.parseInt(hex, 16)));
            });
        });
        it("should accept string with NUL", function() {
            const token = tokenizeOne(`"nul=\\0"`);
            expect(token.type).equal("string");
            expect(token.value).equal("nul=\0");
        });
        it("should accept string with VTAB", function() {
            const token = tokenizeOne(`"vtab=\\v"`);
            expect(token.type).equal("string");
            expect(token.value).equal("vtab=\u000B");
        });
        it("should accept string with ESCAPE", function() {
            const token = tokenizeOne(`"escape=\\e"`);
            expect(token.type).equal("string");
            expect(token.value).equal("escape=\u001B");
        });
        it("should accept multi-line strings", function() {
            const token = tokenizeOne(`"alpha\\\nbeta\\\rgamma\\\r\\\ndelta"`);
            expect(token.type).equal("string");
            expect(token.value).equal("alphabetagammadelta");
        });
        it("should reject unknown escape sequences", function() {
            expect(tokenizeBad(`"\\z`)).throws("(1,3): Invalid string escape sequence");
        });
        it("should reject bad Unicode escape sequences", function() {
            expect(tokenizeBad(`"\\u`)).throws("(1,2): Expected '+' after '\\u' in Unicode escape sequence");
            expect(tokenizeBad(`"\\u+`)).throws("(1,2): Unterminated Unicode escape sequence");
            expect(tokenizeBad(`"\\u+F`)).throws("(1,2): Unterminated Unicode escape sequence");
            expect(tokenizeBad(`"\\u+FF`)).throws("(1,2): Unterminated Unicode escape sequence");
            expect(tokenizeBad(`"\\u+FFF`)).throws("(1,2): Unterminated Unicode escape sequence");
            expect(tokenizeBad(`"\\u+FFFF`)).throws("(1,2): Unterminated Unicode escape sequence");
            expect(tokenizeBad(`"\\u+FFFFF`)).throws("(1,2): Unterminated Unicode escape sequence");
            expect(tokenizeBad(`"\\u+FFFFFF`)).throws("(1,2): Unterminated Unicode escape sequence");
            expect(tokenizeBad(`"\\u+FFFFFFF`)).throws("(1,11): Too many hexadecimal digits in Unicode escape sequence");
            expect(tokenizeBad(`"\\u+;`)).throws("(1,5): Empty Unicode escape sequence");
            expect(tokenizeBad(`"\\u+FFFFFF;`)).throws("(1,11): Unicode codepoint out of range");
            expect(tokenizeBad(`"\\u+Z;`)).throws("(1,5): Invalid hexadecimal digit in Unicode escape sequence");
        });
        it("should reject unterminated strings", function() {
            expect(tokenizeBad(`"`)).throws("(1,1): Unterminated string");
            expect(tokenizeBad(`"\\t\\t\\t`)).throws("(1,1): Unterminated string");
            expect(tokenizeBad(`"hello world`)).throws("(1,1): Unterminated string");
            expect(tokenizeBad(`"\\\r\n12345`)).throws("(1,1): Unterminated string");
        });
    });
    describe("punctuation", function() {
        let s = "!#$%&'()*+,-./:;<=>?@[\\]^`{|}~";
        [...s].forEach(input => it(`should accept operator "${input}"`, function() {
            const token = tokenizeOne(input);
            expect(token.type).equal("punctuation");
            expect(token.value).equal(input);
        }));
    });
    describe("comments", function() {
        [
            ["// hello world", "// hello world"],
            ["// hello world\r\n", "// hello world\n"],
            ["/* hello world */", "/* hello world */"],
            ["/* hello\r\nworld */", "/* hello\nworld */"],
        ].forEach(([input, expected]) => it(`should accept comment ${JSON.stringify(input)}`, function() {
            const token = tokenizeOne(input);
            expect(token.type).equal("comment");
            expect(token.value).equal(expected);
        }));
        it("should reject unterminated comments", function() {
            expect(tokenizeBad(`/* hello`)).throws("(1,1): Unterminated comment");
        });
    });
    describe("locations", function() {
        [
            //12345678901234567890123456789012345678901234567890
            [`print("hello world", /* pi */ 3.14159, true)`, "[[1,1],[1,6],[1,7],[1,20],[1,21],[1,22],[1,30],[1,31],[1,38],[1,39],[1,40],[1,44]]"],
        ].forEach(([input, expected]) => it(`should accept '${input}'`, function() {
            const actual = JSON.stringify([...tokenize(input)].map(token => [token.line, token.column]));
            expect(actual).equal(expected);
        }));
    });
    describe("values", function() {
        [
            [`print("hello world", /* pi */ 3.14159, true)`, "print ( hello_world , _ /*_pi_*/ _ 3.14159 , _ true )"],
        ].forEach(([input, expected]) => it(`should accept '${input}'`, function() {
            const actual = [...tokenize(input)].map(token => String(token.value).replace(/[^!-~]+/g, "_")).join(" ");
            expect(actual).equal(expected);
        }));
    });
    describe("statements", function() {
        [
            [`print("hello world", /* pi */ 3.14159, true)`, `print ( "hello world" , 3.14159 , true )`],
        ].forEach(([input, expected]) => it(`should accept '${input}'`, function() {
            const actual: string[] = [];
            for (let token of tokenize(input)) {
                switch (token.type) {
                    case "whitespace":
                    case "comment":
                        break;
                    case "identifier":
                    case "punctuation":
                        actual.push(`${token.value}`);
                        break;
                    case "integer":
                    case "float":
                    case "string":
                        actual.push(JSON.stringify(token.value));
                        break;
                    default:
                        expect.fail(`Unexpected token type: ${JSON.stringify(token)}`);
                }
            }
            expect(actual.join(" ")).equal(expected);
        }));
    });
});
