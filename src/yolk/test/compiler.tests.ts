import { expect } from "chai";

import { TestProgram } from "../program";

describe("Compiler", function() {
    describe("fromString", function() {
        it("should reject empty input", function() {
            const test = TestProgram.fromString("");
            expect(() => test.compile()).throws("<SOURCE>: Empty input");
            expect(test.errors).deep.equals(["<SOURCE>: Empty input"]);
            expect(test.logged.length).equals(1);
        });
        it("should accept minimal program", function() {
            const test = TestProgram.fromString("print(\"hello, world\");");
            const output = test.compile();
            expect(output).not.undefined;
            expect(test.logged.length).equals(0);
        });
        it("should reject malformed program", function() {
            const test = TestProgram.fromString("print(");
            expect(() => test.compile()).throws("<SOURCE>(1,7): Expected function argument, but got end-of-file instead");
            expect(test.logged.length).equals(1);
        });
    });
    describe("fromScript", function() {
        [
            "scripts/hello-world.egg",
        ].forEach(script => it(`should accept '${script}'`, function() {
            const module = TestProgram.fromScript(this, script).compile();
            expect(module.source).equals(TestProgram.makePath(this, script));
        }));
    });
});
