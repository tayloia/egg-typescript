import { expect } from "chai";

import { Linker } from "../linker";
import { TestProgram } from "../program";

describe("Linker", function() {
    describe("fromString", function() {
        it("should accept minimal program", function() {
            const test = TestProgram.fromString("print(\"hello, world\");");
            const module = test.compile();
            const linker = new Linker().withLogger(test);
            linker.withModule(module);
            const program = linker.link();
            expect(program.modules).deep.equals([module]);
            expect(test.logged.length).equals(0);
        });
    });
    describe("fromFile", function() {
        const folder = this.file!.split(/[/\\]/).slice(-4, -1).join("/");
        [
            "hello-world.egg",
        ].forEach(script => it(`should accept '${script}'`, function() {
            const path = folder + "/scripts/" + script;
            const program = TestProgram.fromFile(path).link();
            expect(program.modules.length).equals(1);
            expect(program.modules[0].source).equals(path);
        }));
    });
});
