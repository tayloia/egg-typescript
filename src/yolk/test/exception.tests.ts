import { expect } from "chai";

import { Exception, BaseException, ExceptionParameters } from "../exception";

describe("Exception", function() {
    it("should support format helper", function() {
        expect(Exception.format("hello world", {})).equals("hello world");
        expect(Exception.format("hello {arg}", {arg:"world"})).equals("hello world");
        expect(Exception.format("{arg2} {arg1}", {arg1:"world",arg2:"hello"})).equals("hello world");
        expect(Exception.format("hello {world}", {})).equals("hello {world}");
    });
    it("should support location helper", function() {
        expect(Exception.location(undefined, undefined, undefined)).equals("");
        expect(Exception.location(undefined, 0, 0)).equals("");
        expect(Exception.location(undefined, 0, 1)).equals("(0,1): ");
        expect(Exception.location(undefined, 1, 0)).equals("(1): ");
        expect(Exception.location(undefined, 1, 2)).equals("(1,2): ");
        expect(Exception.location("source", undefined, undefined)).equals("source: ");
        expect(Exception.location("source", 0, 0)).equals("source: ");
        expect(Exception.location("source", 0, 1)).equals("source(0,1): ");
        expect(Exception.location("source", 1, 0)).equals("source(1): ");
        expect(Exception.location("source", 1, 2)).equals("source(1,2): ");
    });
    it("should format message", function() {
        const exception = new Exception("{h} {w}", {h:"hello", w:"world"});
        expect(exception.message).equals("hello world");
        exception.parameters.h = "goodbye";
        expect(exception.message).equals("goodbye world");
    });
    it("should format name", function() {
        const exception = new Exception("[{name}]");
        expect(exception.message).equals("[Exception]");
        expect(exception.name).equals("Exception");
        exception.parameters.name = "Overwritten";
        expect(exception.message).equals("[Overwritten]");
        expect(exception.name).equals("Overwritten");
    });
    it("should format location", function() {
        const exception = new Exception("{location}reason", {source:"source", line:1, column:2});
        expect(exception.message).equals("source(1,2): reason");
        exception.parameters.column = 0;
        expect(exception.message).equals("source(1): reason");
        exception.parameters.line = 0;
        expect(exception.message).equals("source: reason");
        exception.parameters.column = 3;
        expect(exception.message).equals("source(0,3): reason");
        delete exception.parameters.source;
        expect(exception.message).equals("(0,3): reason");
        exception.parameters.line = 1;
        expect(exception.message).equals("(1,3): reason");
        exception.parameters.column = 0;
        expect(exception.message).equals("(1): reason");
        exception.parameters.line = 0;
        expect(exception.message).equals("reason");
    });
    it("should throw Error type", function() {
        expect(() => {
            throw new Exception("{h} {w}", {h:"hello", w:"world"});
        }).throws(Error).property("message").equals("hello world");
    });
    it("should support custom exceptions", function() {
        class CustomException extends BaseException {
            constructor(message: string, parameters?: ExceptionParameters) {
                super(CustomException.name, message, parameters);
            }
        }
        expect(() => {
            throw new CustomException("{h} {w}", {h:"hello", w:"world"});
        }).throws(CustomException).includes({message: "hello world", name: "CustomException"});
    });
});
