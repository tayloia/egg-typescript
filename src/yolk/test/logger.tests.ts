import { expect } from "chai";

import { TestLogger } from "../test/testing";

describe("TestLogger", function() {
    describe("logging", function() {
        it("should log errors", function() {
            const logger = new TestLogger();
            logger.error("hello, world");
            expect(logger.errors).deep.equals(["hello, world"]);
            expect(logger.logged.length).equals(1);
        });
        it("should log warnings", function() {
            const logger = new TestLogger();
            logger.warning("hello, world");
            expect(logger.warnings).deep.equals(["hello, world"]);
            expect(logger.logged.length).equals(1);
        });
        it("should log prints", function() {
            const logger = new TestLogger();
            logger.print("hello, world");
            expect(logger.prints).deep.equals(["hello, world"]);
            expect(logger.logged.length).equals(1);
        });
        it("should expand parameters", function() {
            const logger = new TestLogger();
            logger.print("{first} {family}", {family:"Chaplin", first:"Charlie"});
            expect(logger.prints).deep.equals(["Charlie Chaplin"]);
            expect(logger.logged.length).equals(1);
        });
        it("should not expand unknown parameters", function() {
            const logger = new TestLogger();
            logger.print("{first} {middle} {family}", {family:"Chaplin", first:"Charlie"});
            expect(logger.prints).deep.equals(["Charlie {middle} Chaplin"]);
        });
        it("should not expand without parameters", function() {
            const logger = new TestLogger();
            logger.print("{name}");
            expect(logger.prints).deep.equals(["{name}"]);
        });
    });
});
