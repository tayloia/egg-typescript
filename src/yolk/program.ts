import { assert } from "./assertion";
import { Compiler } from "./compiler";
import { Logger } from "./logger";

class Runner {
    constructor(public program: Program, public logger: Logger) {}
    run(): void {
        assert.eq(this.program.modules.length, 1);
        this.logger.print("hello, world");
    }
}

export class Module {
    constructor(public readonly root: Compiler.Node, public readonly source: string) {}
}

export class Program {
    constructor(public readonly modules: Module[]) {}
    run(logger: Logger): void {
        const runner = new Runner(this, logger);
        runner.run();
    }
}
