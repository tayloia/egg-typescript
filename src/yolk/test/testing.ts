import * as fs from "fs";

import { Compiler } from "../compiler";
import { Linker } from "../linker";
import { Logger } from "../logger";
import { Parser } from "../parser";
import { Program } from "../program";
import { AssertionError } from "assertion-error";
import { assert } from "../assertion";

export namespace Testing {
    function basePath(mocha: Mocha.Context | Mocha.Suite, depth: number): string {
        const path = ("test" in mocha) ? mocha.test!.file! : mocha.file!;
        return path.split(/[/\\]/).slice(-1 - depth, -1).join("/");
    }
    export function makePath(mocha: Mocha.Context | Mocha.Suite, name: string, depth: number = 3): string {
        return basePath(mocha, depth) + "/" + name;
    }
    export function findPath(mocha: Mocha.Context | Mocha.Suite, wildcard: string, depth: number = 3): string[] {
        const cwd = basePath(mocha, depth);
        return fs.globSync(wildcard, {cwd}).map(x => x.replace(/\\/g, "/"));
    }
    export function fail(message: string, actual?: unknown, expected?: unknown, stack?: string): never {
        // See https://github.com/chaijs/chai/blob/main/lib/chai/interface/expect.js
        const error = new AssertionError(message, { actual, expected }, Testing.fail);
        if (stack) {
            error.stack = error.stack.replace(/^ {4}at /m, stack + "\n    at ");
        }
        throw error;
    }
}

export class TestLogger extends Logger {
    logged: Logger.Entry[] = [];
    log(entry: Logger.Entry): void {
        this.logged.push(entry);
    }
    filter(severity: Logger.Severity): string[] {
        return this.logged.filter(log => log.severity === severity).map(log => log.format())
    }
    get errors() {
        return this.filter(Logger.Severity.Error);
    }
    get warnings() {
        return this.filter(Logger.Severity.Warning);
    }
    get prints() {
        return this.filter(Logger.Severity.Print);
    }
}

export class TestProgram extends TestLogger {
    private constructor(private input: string, private source: string) {
        super();
    }
    parse(): Parser.Node {
        return Parser.fromString(this.input, this.source).withLogger(this).parse();
    }
    compile(): Compiler.Module {
        return Compiler.fromString(this.input, this.source).withLogger(this).compile();
    }
    link(): Program {
        return new Linker().withModule(this.compile()).link();
    }
    run(): void {
        this.link().run(this);
    }
    test(): void {
        const makeExpected = (line: string) => {
            if (line.startsWith("///>")) {
                return line.slice(4);
            }
            if (line.startsWith("///<")) {
                return line.slice(3);
            }
            return undefined;
        };
        const makeActual = (index: number) => {
            const entry = this.logged[index];
            switch (entry?.severity) {
                case Logger.Severity.Error:
                    return "<ERROR>" + entry.format();
                case Logger.Severity.Warning:
                    return "<WARNING>" + entry.format();
                case Logger.Severity.Info:
                    return "<INFO>" + entry.format();
                case Logger.Severity.Debug:
                    return "<DEBUG>" + entry.format();
                case Logger.Severity.Trace:
                    return "<TRACE>" + entry.format();
                case Logger.Severity.Print:
                    return entry.message;
            }
        };
        const makeStack = (line: number) => {
            return `    at script (${this.source}:${line})`;
        }
        assert(this.logged.length === 0);
        this.run();
        let logged = 0;
        let line = 0;
        const matches = this.input.matchAll(/([^\r\n]*)\r?\n?/g);
        for (const match of matches) {
            ++line;
            const expected = makeExpected(match[1]);
            if (expected) {
                const actual = makeActual(logged++);
                if (actual === undefined) {
                    Testing.fail(`Missing script output: '${expected}'`, actual, expected, makeStack(line));
                }
                if (actual !== expected) {
                    Testing.fail(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`, actual, expected, makeStack(line));
                }
            }
        }
        if (logged !== this.logged.length) {
            const actual = makeActual(logged++);
            Testing.fail(`Extraneous script output: '${actual}'`, actual, undefined, makeStack(line));
        }
    }
    static fromFile(path: fs.PathLike): TestProgram {
        return new TestProgram(fs.readFileSync(path, "utf8"), path.toString());
    }
    static fromScript(mocha: Mocha.Context, script: string, depth: number = 3): TestProgram {
        const path = Testing.makePath(mocha, script, depth);
        return new TestProgram(fs.readFileSync(path, "utf8"), path);
    }
    static fromString(text: string, source: string = "<SOURCE>"): TestProgram {
        return new TestProgram(text, source);
    }
}
