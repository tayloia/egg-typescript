import { Testing, TestProgram } from "./testing";

describe("Scripts", function() {
    describe("fromScript", function() {
        Testing.findPath(this, "scripts/test-*.egg").forEach(script => it(script, function() {
            TestProgram.fromScript(this, script).test();
        }));
    });
});
