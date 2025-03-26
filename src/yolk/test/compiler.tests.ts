import { expect } from "chai";

import { Testing, TestProgram } from "./testing";
import { Exception } from "../exception";

describe("Compiler", function() {
    describe("fromString", function() {
        it("should accept minimal program", function() {
            const test = TestProgram.fromString("print(\"hello, world\");");
            const program = test.compile();
            expect(program.modules.length).equals(1);
            expect(test.logged.length).equals(0);
        });
    });
    describe("fromScript", function() {
        [
            "scripts/hello-world.egg",
            ...Testing.findPath(this, "scripts/test-*.egg")
        ].forEach(script => it(`should accept '${script}'`, function() {
            const test = TestProgram.fromScript(this, script);
            const match = test.input.match(/^\/\/\/<COMPILER><ERROR>(.*)$/m);
            const expected = match?.[1];
            if (expected) {
                try {
                    test.compile();
                    expect.fail(undefined, expected, `Expected exception '${expected}', but none was thrown`);
                }
                catch (error) {
                    const exception = Exception.from(error);
                    if (exception) {
                        const actual = exception.format(true).replace(test.source, "<RESOURCE>");
                        expect(actual).equals(expected);
                    } else {
                        throw error;
                    }
                }
            } else {
                const program = TestProgram.fromScript(this, script).compile();
                expect(program.modules.length).equals(1);
                expect(program.modules[0].source).equals(Testing.makePath(this, script));
            }
        }));
    });
});
