import { expect } from "chai";

import { Testing, TestProgram } from "./testing";
import { Exception } from "../exception";

describe("Runner", function() {
    describe("fromString", function() {
        it("should accept minimal program", function() {
            const test = TestProgram.fromString("print(\"hello, world\");");
            test.run();
            expect(test.output).equals("hello, world");
        });
    });
    describe("fromScript", function() {
        [
            "scripts/hello-world.egg",
            ...Testing.findPath(this, "scripts/test-*.egg")
        ].forEach(script => it(`should accept '${script}'`, function() {
            const test = TestProgram.fromScript(this, script);
            const expected = test.expectedException();
            if (expected) {
                try {
                    test.run();
                    expect.fail(undefined, expected, `Expected exception '${expected}', but none was thrown`);
                }
                catch (exception) {
                    const actual = Exception.from(exception);
                    if (actual) {
                        expect(actual.format(false)).equals(expected);
                    } else {
                        throw actual;
                    }
                }
            } else {
                test.run();
            }
        }));
    });
});
