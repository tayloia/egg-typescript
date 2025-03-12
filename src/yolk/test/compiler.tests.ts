import { expect } from "chai";

import { TestProgram } from "../program";

describe("Compiler", function() {
    describe("simple", function() {
        it("should reject empty input", function() {
            const test = new TestProgram("");
            expect(() => test.compile()).throws("<SOURCE>: Empty input");
            expect(test.errors).deep.equals(["<SOURCE>: Empty input"]);
            expect(test.logged.length).equals(1);
        });
        it("should accept minimal program", function() {
            const test = new TestProgram("print(\"hello world\");");
            const output = test.compile();
            expect(output).not.undefined;
        });
        it("should reject malformed program", function() {
            const test = new TestProgram("print(");
            expect(() => test.compile()).throws("<SOURCE>(1,7): Expected function argument, but got end-of-file instead");
        });
    });
});
