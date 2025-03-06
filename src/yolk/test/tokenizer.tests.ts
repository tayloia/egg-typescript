import { expect } from "chai";

import { Tokenizer } from "../tokenizer";

describe("Tokenizer", function() {
    function tokenizeOne(input: string): Tokenizer.Token {
        const tokenizer = Tokenizer.fromString(input);
        const token = tokenizer.take();
        expect(token).not.undefined;
        expect(token?.raw).equal(input);
        expect(tokenizer.take()).undefined;
        return token!;
    }
    function tokenizeMany(input: string): string[] {
        const tokenizer = Tokenizer.fromString(input);
        const output: string[] = [];
        let token: Tokenizer.Token | undefined;
        let raw = "";
        while (token = tokenizer.take()) {
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
            raw += token.raw;
        }
        expect(raw).equal(input);
        return output;
    }
    describe("whitespace", function() {
        it("should parse empty input", function() {
            const tokenizer = Tokenizer.fromString("");
            const token = tokenizer.take();
            expect(token).undefined;
            expect(tokenizer.take()).undefined;
        });
        it("should parse ASCII whitespace", function() {
            const input = " \t\f\v\n\r";
            const token = tokenizeOne(input);
            expect(token.type).equal("whitespace");
            expect(token.value).equal("  \n\n\n\n");
        });
        it("should parse Unicode whitespace", function() {
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
        ].forEach(input => it(`should parse identifier "${input}"`, function() {
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
        cases.forEach(([input, expected]) => it(`should parse integer "${input}"`, function() {
            const token = tokenizeOne(input);
            expect(token.type).equal("integer");
            expect(token.value).equal(expected);
        }));
    });
    describe("floats", function() {
        const cases: [string, number][] = [
            ["0.0", 0.0],
            ["123.45", 123.45],
            ["1234567890.12345", 1234567890.12345],
        ];
        cases.forEach(([input, expected]) => it(`should parse float "${input}"`, function() {
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
        ].forEach(input => it(`should parse string ${JSON.stringify(input)}`, function() {
            const token = tokenizeOne(JSON.stringify(input));
            expect(token.type).equal("string");
            expect(token.value).equal(input);
        }));
        "0,1,12,123,1234,12345,F,FF,FFF,FFFF,FFFFF,10FFFF".split(",").forEach(hex => {
            const input = `"unicode=\\u+${hex};"`;
            it(`should parse string ${input}`, function() {
                const token = tokenizeOne(input);
                expect(token.type).equal("string");
                expect(token.value).equal("unicode=" + String.fromCodePoint(Number.parseInt(hex, 16)));
            });
        });
        it("should parse string with NUL", function() {
            const token = tokenizeOne(`"nul=\\0"`);
            expect(token.type).equal("string");
            expect(token.value).equal("nul=\0");
        });
        it("should parse string with VTAB", function() {
            const token = tokenizeOne(`"vtab=\\v"`);
            expect(token.type).equal("string");
            expect(token.value).equal("vtab=\u000B");
        });
        it("should parse string with ESCAPE", function() {
            const token = tokenizeOne(`"escape=\\e"`);
            expect(token.type).equal("string");
            expect(token.value).equal("escape=\u001B");
        });
        it("should parse multi-line strings", function() {
            const token = tokenizeOne(`"alpha\\\nbeta\\\rgamma\\\r\\\ndelta"`);
            expect(token.type).equal("string");
            expect(token.value).equal("alphabetagammadelta");
        });
    });
    describe("punctuation", function() {
        let s = "!#$%&'()*+,-./:;<=>?@[\\]^`{|}~";
        [...s].forEach(input => it(`should parse operator "${input}"`, function() {
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
        ].forEach(([input, expected]) => it(`should parse comment ${JSON.stringify(input)}`, function() {
            const token = tokenizeOne(input);
            expect(token.type).equal("comment");
            expect(token.value).equal(expected);
        }));
    });
    describe("statements", function() {
        [
            [
                `print("hello world", /* pi */ 3.14159, true)`,
                "print",
                "'('",
                "\"hello world\"",
                "','",
                "/* pi */",
                "3.14159",
                "','",
                "true",
                "')'"
            ],
        ].forEach(([input, ...expected]) => it(`should parse statement '${input}'`, function() {
            const actual = tokenizeMany(input);
            expect(actual).deep.equal(expected);
        }));
    });
});
