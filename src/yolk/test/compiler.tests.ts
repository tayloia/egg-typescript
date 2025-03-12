import { expect } from "chai";

import { Compiler } from "../compiler";
import { TestLogger } from "../logger";

describe("Compiler", function() {
    describe("simple", function() {
        it("should reject empty input", function() {
            const logger = new TestLogger();
            const compiler = Compiler.fromString("", "source").withLogger(logger);
            expect(() => compiler.compile()).throws("source: Empty input");
            expect(logger.errors).deep.equals(["source: Empty input"]);
            expect(logger.logged.length).equals(1);
        });
        it("should accept minimal program", function() {
            const compiler = Compiler.fromString("print(\"hello world\");", "source");
            const output = compiler.compile();
            expect(output).not.undefined;
        });
        it("should reject malformed program", function() {
            const compiler = Compiler.fromString("print(", "source");
            expect(() => compiler.compile()).throws("source(1,7): Expected function argument, but got end-of-file instead");
        });
    });
});
