import { expect } from "chai";

import { TestLogger } from "../logger";

describe("TestLogger", function() {
    describe("logging", function() {
        it("should log errors", function() {
            const logger = new TestLogger();
            logger.error("hello world");
            expect(logger.errors).deep.equal(["hello world"]);
            expect(logger.logged.length).equal(1);
        });
        it("should log warnings", function() {
            const logger = new TestLogger();
            logger.warning("hello world");
            expect(logger.warnings).deep.equal(["hello world"]);
            expect(logger.logged.length).equal(1);
        });
        it("should log prints", function() {
            const logger = new TestLogger();
            logger.print("hello world");
            expect(logger.prints).deep.equal(["hello world"]);
            expect(logger.logged.length).equal(1);
        });
        it("should expand parameters", function() {
            const logger = new TestLogger();
            logger.print("{first} {family}", {family:"Chaplin", first:"Charlie"});
            expect(logger.prints).deep.equal(["Charlie Chaplin"]);
            expect(logger.logged.length).equal(1);
        });
        it("should not expand unknown parameters", function() {
            const logger = new TestLogger();
            logger.print("{first} {middle} {family}", {family:"Chaplin", first:"Charlie"});
            expect(logger.prints).deep.equal(["Charlie {middle} Chaplin"]);
        });
        it("should not expand without parameters", function() {
            const logger = new TestLogger();
            logger.print("{name}");
            expect(logger.prints).deep.equal(["{name}"]);
        });
    });
});
