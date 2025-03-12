import { expect } from "chai";

import { Linker } from "../linker";
import { TestProgram } from "../program";

describe("Linker", function() {
    describe("simple", function() {
        it("should accept minimal program", function() {
            const test = new TestProgram("print(\"hello, world\");");
            const module = test.compile();
            const linker = new Linker().withLogger(test);
            linker.withModule(module);
            const program = linker.link();
            expect(program.modules).deep.equals([module]);
            expect(test.logged.length).equals(0);
        });
    });
});
