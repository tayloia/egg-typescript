import * as fs from "fs";

import { Compiler } from "../compiler";
import { Linker } from "../linker";
import { Logger } from "../logger";
import { Parser } from "../parser";
import { Module, Program } from "../program";

export namespace Test {
    export function path(mocha: Mocha.Context, script: string, depth: number = 3): string {
        return mocha.test!.file!.split(/[/\\]/).slice(-1 - depth, -1).join("/") + "/" + script;
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
    compile(): Module {
        return Compiler.fromString(this.input, this.source).withLogger(this).compile();
    }
    link(): Program {
        return new Linker().withModule(this.compile()).link();
    }
    run(): void {
        return this.link().run(this);
    }
    static fromFile(path: fs.PathLike): TestProgram {
        return new TestProgram(fs.readFileSync(path, "utf8"), path.toString());
    }
    static fromScript(mocha: Mocha.Context, script: string, depth: number = 3): TestProgram {
        const path = Test.path(mocha, script, depth);
        return new TestProgram(fs.readFileSync(path, "utf8"), path);
    }
    static fromString(text: string, source: string = "<SOURCE>"): TestProgram {
        return new TestProgram(text, source);
    }
}
