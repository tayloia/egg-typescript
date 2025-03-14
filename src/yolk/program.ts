import { assert } from "./assertion";
import { Logger } from "./logger";
import { SymbolTable } from "./symboltable";
import { Type } from "./type";
import { Value } from "./value";

export class Program {
    constructor(public readonly modules: Program.Module[]) {}
    run(logger: Logger): void {
        const runner = new Runner(this, logger);
        runner.run();
    }
}

export namespace Program {
    export abstract class Runner extends Logger {
        abstract variableDeclare(name: string, type: Type): void;
        abstract variableDefine(name: string, type: Type, initializer: Value): void;
        abstract variableSet(name: string, value: Value): void;
        abstract variableGet(name: string): Value;
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
        this.variables = new SymbolTable();
    }
    variables: SymbolTable;
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
    run(): void {
        assert.eq(this.program.modules.length, 1);
        this.program.modules[0].root.execute(this);
    }
    variableDeclare(name: string, type: Type): void {
        this.variables.declare(name, type);
    }
    variableDefine(name: string, type: Type, initializer: Value): void {
        this.variables.define(name, type, initializer);
    }
    variableSet(name: string, value: Value): void {
        this.variables.set(name, value);
    }
    variableGet(name: string): Value {
        return this.variables.get(name);
    }
    unimplemented(): never {
        assert.fail("Unimplemented: {caller}", {caller:this.unimplemented});
    }
}
