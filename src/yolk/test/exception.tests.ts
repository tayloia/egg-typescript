import { expect } from "chai";

import { Exception } from "../exception";

describe("Exception", function() {
    it("should support format helper", function() {
        expect(Exception.format("hello world", {})).equal("hello world");
        expect(Exception.format("hello {arg}", {arg:"world"})).equal("hello world");
        expect(Exception.format("{arg2} {arg1}", {arg1:"world",arg2:"hello"})).equal("hello world");
        expect(Exception.format("hello {world}", {})).equal("hello {world}");
    });
    it("should support location helper", function() {
        expect(Exception.location(undefined, undefined, undefined)).equal("");
        expect(Exception.location(undefined, 0, 0)).equal("");
        expect(Exception.location(undefined, 0, 1)).equal("(0,1): ");
        expect(Exception.location(undefined, 1, 0)).equal("(1): ");
        expect(Exception.location(undefined, 1, 2)).equal("(1,2): ");
        expect(Exception.location("source", undefined, undefined)).equal("source: ");
        expect(Exception.location("source", 0, 0)).equal("source: ");
        expect(Exception.location("source", 0, 1)).equal("source(0,1): ");
        expect(Exception.location("source", 1, 0)).equal("source(1): ");
        expect(Exception.location("source", 1, 2)).equal("source(1,2): ");
    });
    it("should format message", function() {
        const exception = new Exception("{h} {w}", {h:"hello", w:"world"});
        expect(exception.message).equal("hello world");
        exception.parameters.h = "goodbye";
        expect(exception.message).equal("goodbye world");
    });
    it("should format location", function() {
        const exception = new Exception("{location}error", {source:"source", line:1, column:2});
        expect(exception.message).equal("source(1,2): error");
        exception.parameters.column = 0;
        expect(exception.message).equal("source(1): error");
    });
    it("should throw Error type", function() {
        expect(() => {
            throw new Exception("{h} {w}", {h:"hello", w:"world"});
        }).throw(Error).property("message").equal("hello world");
    });
});
