import { expect } from "chai";

import { TestProgram } from "../program";

describe("Parser", function() {
    describe("simple", function() {
        it("should reject empty input", function() {
            const test = TestProgram.fromString("");
            expect(() => test.parse()).throws("<SOURCE>: Empty input");
            expect(test.errors).deep.equals(["<SOURCE>: Empty input"]);
            expect(test.logged.length).equals(1);
        });
        it("should accept comments", function() {
            const test = TestProgram.fromString("/* comment */");
            const output = test.parse();
            expect(output.children.length).equals(0);
        });
        it("should accept minimal program", function() {
            const test = TestProgram.fromString("print(\"hello, world\");");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
    });
    describe("statement function call", function() {
        it("should reject unterminated function arguments", function() {
            const test = TestProgram.fromString("print(");
            expect(() => test.parse()).throws("<SOURCE>(1,7): Expected function argument, but got end-of-file instead");
        });
        it("should reject missing semicolon", function() {
            const test = TestProgram.fromString("print()");
            expect(() => test.parse()).throws("<SOURCE>(1,8): Expected semicolon, but got end-of-file instead");
        });
        it("should reject leading comma", function() {
            const test = TestProgram.fromString("print(,)");
            expect(() => test.parse()).throws("<SOURCE>(1,7): Expected function argument, but got ',' instead");
        });
        it("should reject empty argument", function() {
            const test = TestProgram.fromString("print(123,,456)");
            expect(() => test.parse()).throws("<SOURCE>(1,11): Expected function argument, but got ',' instead");
        });
        it("should reject trailing comma", function() {
            const test = TestProgram.fromString("print(123,)");
            expect(() => test.parse()).throws("<SOURCE>(1,11): Expected function argument, but got ')' instead");
        });
        it("should accept zero arguments", function() {
            const test = TestProgram.fromString("print();");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
        it("should accept one argument", function() {
            const test = TestProgram.fromString("print(null);");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
        it("should accept two arguments", function() {
            const test = TestProgram.fromString("print(null,false);");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
        it("should accept three arguments", function() {
            const test = TestProgram.fromString("print(null,false,true);");
            const output = test.parse();
            expect(output.children.length).equals(1);
        });
    });
    describe("scripts", function() {
        const folder = this.file!.split(/[/\\]/).slice(-4, -1).join("/");
        [
            "hello-world.egg",
        ].forEach(script => it(`should accept '${script}'`, function() {
            const path = folder + "/scripts/" + script;
            const output = TestProgram.fromFile(path).parse();
            expect(output.children.length).equals(1);
        }));
    });
});
