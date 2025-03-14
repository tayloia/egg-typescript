import { expect } from "chai";

import { Testing, TestProgram } from "./testing";

describe("Linker", function() {
    describe("fromString", function() {
        it("should accept minimal program", function() {
            const test = TestProgram.fromString("print(\"hello, world\");");
            const program = test.link();
            expect(program.modules.length).equals(1);
            expect(test.logged.length).equals(0);
        });
    });
    describe("fromScript", function() {
        [
            "scripts/hello-world.egg",
            ...Testing.findPath(this, "scripts/test-*.egg")
        ].forEach(script => it(`should accept '${script}'`, function() {
            const program = TestProgram.fromScript(this, script).link();
            expect(program.modules.length).equals(1);
            expect(program.modules[0].source).equals(Testing.makePath(this, script));
        }));
    });
});
