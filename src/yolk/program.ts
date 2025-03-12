import * as fs from "fs";

import { Compiler } from "./compiler";
import { Linker } from "./linker";
import { Logger, TestLogger } from "./logger";
import { Parser } from "./parser";

export class Module {
    constructor(public readonly root: Compiler.Node, public readonly source: string) {
    }
}

export class Program {
    constructor(public readonly modules: Module[]) {
    }
    run(logger: Logger): void {
        logger.print("hello, world"); // WIBBLE
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
        const path = TestProgram.makePath(mocha, script, depth);
        return new TestProgram(fs.readFileSync(path, "utf8"), path);
    }
    static fromString(text: string, source: string = "<SOURCE>"): TestProgram {
        return new TestProgram(text, source);
    }
    static makePath(mocha: Mocha.Context, script: string, depth: number = 3): string {
        return mocha.test!.file!.split(/[/\\]/).slice(-1 - depth, -1).join("/") + "/" + script;
    }
}
