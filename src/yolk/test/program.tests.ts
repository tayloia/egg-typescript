import { expect } from "chai";

import { TestProgram } from "../program";

describe("Program", function() {
    describe("simple", function() {
        it("should accept minimal program", function() {
            const test = TestProgram.fromString("print(\"hello, world\");");
            const program = test.link();
            expect(test.logged.length).equals(0);
            program.run(test);
            expect(test.logged.length).equals(1);
            expect(test.prints).deep.equals(["hello, world"]);
        });
    });
});
