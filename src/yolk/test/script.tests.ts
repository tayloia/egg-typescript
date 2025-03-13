import { expect } from "chai";

import { Testing, TestProgram } from "./testing";

describe("Scripts", function() {
    describe("fromScript", function() {
        Testing.findPath(this, "scripts/test-*.egg").forEach(script => it(script, function() {
            const test = TestProgram.fromScript(this, script);
            test.test();
            expect(test.errors).empty;
        }));
    });
});
