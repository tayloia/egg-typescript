import { expect } from "chai";

import { Exception } from "../exception";
import { Location } from "../location";
import { Message } from "../message";

class CustomException extends Exception {
    constructor(message: string, parameters?: Message.Parameters) {
        super(CustomException.name, Message.Origin.Runtime, message, parameters);
    }
}

describe("Exception", function() {
    it("should support format helper", function() {
        expect(Exception.format("hello, world", {}, true)).equals("hello, world");
        expect(Exception.format("hello, {arg}", {arg:"world"}, true)).equals("hello, world");
        expect(Exception.format("{arg2}, {arg1}", {arg1:"world",arg2:"hello"}, true)).equals("hello, world");
        expect(Exception.format("hello, {world}", {}, true)).equals("hello, {world}");
    });
    it("should format message", function() {
        const exception = new CustomException("{h}, {w}", {h:"hello", w:"world"});
        expect(exception.message).equals("hello, world");
        exception.parameters.h = "goodbye";
        expect(exception.message).equals("goodbye, world");
    });
    it("should format name", function() {
        const exception = new CustomException("[{name}]");
        expect(exception.message).equals("[CustomException]");
        expect(exception.name).equals("CustomException");
        exception.parameters.name = "Overwritten";
        expect(exception.message).equals("[Overwritten]");
        expect(exception.name).equals("Overwritten");
    });
    it("should format origin", function() {
        const exception = new CustomException("[{origin}]");
        expect(exception.message).equals("[RUNTIME]");
        expect(exception.origin).equals(Exception.Origin.Runtime);
    });
    it("should format location", function() {
        const location = new Location("source", 1, 2);
        const exception = new CustomException("reason", {location});
        expect(exception.message).equals("source(1,2): reason");
        location.column0 = 0;
        expect(exception.message).equals("source(1): reason");
        location.line0 = 0;
        expect(exception.message).equals("source: reason");
        location.column0 = 3;
        expect(exception.message).equals("source(0,3): reason");
        location.source = "";
        expect(exception.message).equals("(0,3): reason");
        location.line0 = 1;
        expect(exception.message).equals("(1,3): reason");
        location.column0 = 0;
        expect(exception.message).equals("(1): reason");
        location.line0 = 0;
        expect(exception.message).equals("reason");
        location.line0 = 1;
        location.column0 = 2;
        location.line1 = 3;
        location.column1 = 4;
        expect(exception.message).equals("(1-3,2-4): reason");
    });
    it("should throw Error type", function() {
        expect(() => {
            throw new CustomException("{h}, {w}", {h:"hello", w:"world"});
        }).throws(Error).property("message").equals("hello, world");
    });
    it("should support custom exceptions", function() {
        expect(() => {
            throw new CustomException("{h}, {w}", {h:"hello", w:"world"});
        }).throws(CustomException).includes({message:"hello, world", name:"CustomException"});
    });
    it("should support runtime type checking", function() {
        expect(Exception.from(123)).undefined;
        expect(Exception.from(new Error())).undefined;
        expect(Exception.from({})).undefined;
        const custom = new CustomException("custom");
        expect(Exception.from(custom)).equals(custom);
    });
});
