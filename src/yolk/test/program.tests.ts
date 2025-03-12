import { expect } from "chai";

import { TestProgram } from "../program";

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
    describe("fromFile", function() {
        const folder = this.file!.split(/[/\\]/).slice(-4, -1).join("/");
        [
            "hello-world.egg",
        ].forEach(script => it(`should accept '${script}'`, function() {
            const path = folder + "/scripts/" + script;
            const test = TestProgram.fromFile(path);
            expect(test.logged.length).equals(0);
            test.run();
            expect(test.logged.length).equals(1);
            expect(test.prints).deep.equals(["hello, world"]);
        }));
    });
});
