import { expect } from "chai";

import { TestProgram } from "../test/testing";

describe("Program", function() {
    describe("fromString", function() {
        it("should accept minimal program", function() {
            const test = TestProgram.fromString("print(\"hello, world\");");
            const program = test.link();
            expect(test.logged.length).equals(0);
            program.run(test);
            expect(test.logged.length).equals(1);
            expect(test.prints).deep.equals(["hello, world"]);
        });
    });
    describe("fromScript", function() {
        it("should accept minimal script", function() {
            const test = TestProgram.fromScript(this, "scripts/hello-world.egg");
            expect(test.logged.length).equals(0);
            test.run();
            expect(test.logged.length).equals(1);
            expect(test.prints).deep.equals(["hello, world"]);
        });
    });
});
