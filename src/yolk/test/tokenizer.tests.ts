import { expect } from "chai";

import { Tokenizer } from "../tokenizer";

describe("Tokenizer", () => {
    function tokenizeRaw(input: string): string[] {
        const tokenizer = Tokenizer.fromString(input);
        let output = [];
        let token;
        while (token = tokenizer.take()) {
            output.push(token.raw);
        }
        return output;
    }
    it("should parse whitespace", () => {
        expect(tokenizeRaw(" \t\r\n")).deep.equal([" \t\r\n"]);
    });
    it("should parse identifiers", () => {
        expect(tokenizeRaw("hello_123")).deep.equal(["hello_123"]);
    });
    it("should parse integers", () => {
        expect(tokenizeRaw("123")).deep.equal(["123"]);
    });
    it("should parse floats", () => {
        expect(tokenizeRaw("123.45")).deep.equal(["123.45"]);
    });
    it("should parse strings", () => {
        expect(tokenizeRaw("\"hello\"")).deep.equal(["\"hello\""]);
    });
    it("should parse operators", () => {
        expect(tokenizeRaw("+-*/")).deep.equal(["+","-","*","/"]);
    });
    it("should parse comments", () => {
        expect(tokenizeRaw("/* comment */")).deep.equal(["/* comment */"]);
    });
});