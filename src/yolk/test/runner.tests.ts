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
            const match = test.input.match(/^\/\/\/<[A-Z]+><ERROR>(.*)$/m);
            const expected = match?.[1];
            if (expected) {
                try {
                    test.run();
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
                test.run();
            }
        }));
    });
});
