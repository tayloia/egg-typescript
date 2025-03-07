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
        it("should accept print", function() {
            const parser = Parser.fromString(" print(\"hello world\");"); // WIBBLE
            const output = parser.parse();
            expect(output).includes({errors:0, warnings:0});
        });
    });
});
