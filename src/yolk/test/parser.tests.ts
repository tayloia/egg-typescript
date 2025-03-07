import { expect } from "chai";

import { Parser } from "../parser";
import { TestLogger } from "../logger";

describe("Parser", function() {
    describe("simple", function() {
        it("should reject empty input", function() {
            const logger = new TestLogger();
            const parser = Parser.fromString("").withLogger(logger);
            expect(() => parser.parse()).throws("Empty input");
            expect(logger.errors).deep.equals(["Empty input"]);
            expect(logger.logged.length).equals(1);
        });
        it("should accept comments", function() {
            const parser = Parser.fromString("/* comment */");
            const output = parser.parse();
            expect(output).includes({errors:0, warnings:0});
        });
        it("should accept minimal program", function() {
            const parser = Parser.fromString("print(\"hello world\");");
            const output = parser.parse();
            expect(output).includes({errors:0, warnings:0});
        });
    });
    describe("statement function call", function() {
        it("should reject unterminated function arguments", function() {
            const parser = Parser.fromString("print(");
            expect(() => parser.parse()).throws("Expected function argument, but got end-of-file instead");
        });
        it("should reject missing semicolon", function() {
            const parser = Parser.fromString("print()");
            expect(() => parser.parse()).throws("Expected semicolon, but got end-of-file instead");
        });
        it("should reject leading comma", function() {
            const parser = Parser.fromString("print(,)");
            expect(() => parser.parse()).throws("Expected function argument, but got ',' instead");
        });
        it("should reject trailing comma", function() {
            const parser = Parser.fromString("print(123,)");
            expect(() => parser.parse()).throws("Expected function argument, but got ')' instead");
        });
        it("should accept zero arguments", function() {
            const parser = Parser.fromString("print();");
            const output = parser.parse();
            expect(output).includes({errors:0, warnings:0});
        });
        it("should accept one argument", function() {
            const parser = Parser.fromString("print(null);");
            const output = parser.parse();
            expect(output).includes({errors:0, warnings:0});
        });
        it("should accept two arguments", function() {
            const parser = Parser.fromString("print(null,false);");
            const output = parser.parse();
            expect(output).includes({errors:0, warnings:0});
        });
        it("should accept three arguments", function() {
            const parser = Parser.fromString("print(null,false,true);");
            const output = parser.parse();
            expect(output).includes({errors:0, warnings:0});
        });
    });
});
