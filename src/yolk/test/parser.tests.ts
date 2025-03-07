import { expect } from "chai";

import { Parser } from "../parser";

describe("Parser", function() {
    describe("simple", function() {
        it("should reject empty input", function() {
            const parser = Parser.fromString("");
            expect(() => parser.parse()).throws("Empty input");
        });
        it("should accept comments", function() {
            const parser = Parser.fromString("/* comment */");
            const output = parser.parse();
            expect(output).includes({errors:0, warnings:0});
        });
    });
});
