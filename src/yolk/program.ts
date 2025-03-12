import { Compiler } from "./compiler";
import { Linker } from "./linker";
import { Logger, TestLogger } from "./logger";
import { Parser } from "./parser";

export class Module {
    constructor(public readonly root: Compiler.Node) {
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
    constructor(public input: string, public source: string = "<SOURCE>") {
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
}
