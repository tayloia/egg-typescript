import { assert } from "./assertion";
import { Logger } from "./logger";

export class Program {
    constructor(public readonly modules: Program.Module[]) {}
    run(logger: Logger): void {
        const runner = new Runner(this, logger);
        runner.run();
    }
}

export namespace Program {
    export abstract class Runner extends Logger {
        abstract unimplemented(): never;
    }
    export interface Node {
        execute(runner: Runner): void;
    }
    export interface Module {
        root: Node;
        source: string;
    }
}

class Runner extends Program.Runner {
    constructor(public program: Program, public logger: Logger) {
        super();
    }
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
    run(): void {
        assert.eq(this.program.modules.length, 1);
        this.program.modules[0].root.execute(this);
    }
    unimplemented(): never {
        assert.fail("Unimplemented: {caller}", {caller:this.unimplemented});
    }
}
