import { expect } from "chai";

import { TestProgram } from "../program";

describe("Parser", function() {
    describe("simple", function() {
        it("should reject empty input", function() {
            const test = new TestProgram("");
            expect(() => test.parse()).throws("<SOURCE>: Empty input");
            expect(test.errors).deep.equals(["<SOURCE>: Empty input"]);
            expect(test.logged.length).equals(1);
        });
        it("should accept comments", function() {
            const test = new TestProgram("/* comment */");
            const output = test.parse();
            expect(output.children.length).equals(0);
        });
        it("should accept minimal program", function() {
            const test = new TestProgram("print(\"hello world\");");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
    });
    describe("statement function call", function() {
        it("should reject unterminated function arguments", function() {
            const test = new TestProgram("print(");
            expect(() => test.parse()).throws("<SOURCE>(1,7): Expected function argument, but got end-of-file instead");
        });
        it("should reject missing semicolon", function() {
            const test = new TestProgram("print()");
            expect(() => test.parse()).throws("<SOURCE>(1,8): Expected semicolon, but got end-of-file instead");
        });
        it("should reject leading comma", function() {
            const test = new TestProgram("print(,)");
            expect(() => test.parse()).throws("<SOURCE>(1,7): Expected function argument, but got ',' instead");
        });
        it("should reject empty argument", function() {
            const test = new TestProgram("print(123,,456)");
            expect(() => test.parse()).throws("<SOURCE>(1,11): Expected function argument, but got ',' instead");
        });
        it("should reject trailing comma", function() {
            const test = new TestProgram("print(123,)");
            expect(() => test.parse()).throws("<SOURCE>(1,11): Expected function argument, but got ')' instead");
        });
        it("should accept zero arguments", function() {
            const test = new TestProgram("print();");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
        it("should accept one argument", function() {
            const test = new TestProgram("print(null);");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
        it("should accept two arguments", function() {
            const test = new TestProgram("print(null,false);");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
        it("should accept three arguments", function() {
            const test = new TestProgram("print(null,false,true);");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
    });
});
