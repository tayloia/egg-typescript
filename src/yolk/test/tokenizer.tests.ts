import { expect } from "chai";

import { Tokenizer } from "../tokenizer";

describe("Tokenizer", function() {
    function tokenizeOne(input: string): Tokenizer.Token {
        const tokenizer = Tokenizer.fromString(input);
        const token = tokenizer.take()!;
        expect(token).not.undefined;
        expect(token.raw).equal(input);
        expect(tokenizer.take()).undefined;
        return token;
    }
    function tokenizeRaw(input: string): string[] {
        const tokenizer = Tokenizer.fromString(input);
        let output = [];
        let token;
        while (token = tokenizer.take()) {
            output.push(token.raw);
        }
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
            ["\"hello world\"", "hello world"],
            ["\"\"", ""],
        ].forEach(([input, expected]) => it(`should parse string "${input}"`, function() {
            const token = tokenizeOne(input);
            expect(token.type).equal("string");
            expect(token.value).equal(expected);
        }));
    });
    describe("operators", function() {
        let s = "!#$%&'()*+,-./:;<=>?@[\\]^`{|}~";
        [...s].forEach(input => it(`should parse operator "${input}"`, function() {
            const token = tokenizeOne(input);
            expect(token.type).equal("symbol");
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
});
