import { assert } from "./assertion";
import { ExceptionParameters, RuntimeException } from "./exception";
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
    export class Location {
        constructor(public source: string, public line0: number = 1, public column0: number = 1, public line1: number = 0, public column1: number = 0) {}
        span(that: Location): Location {
            assert.eq(this.source, that.source);
            assert.gt(that.line1, 0);
            assert.gt(that.column1, 0);
            this.line1 = that.line1;
            this.column1 = that.column1;
            return this;
        }
        format() {
            function range(lbound: number, ubound: number): string {
                return lbound < ubound ? `${lbound}-${ubound}` : `${lbound}`;
            }
            return `${this.source}(${range(this.line0, this.line1)},${range(this.column0, this.column1)})`;
        }
    }
    export abstract class Runner extends Logger {
        abstract location: Location;
        abstract variableDeclare(symbol: string, type: Type): void;
        abstract variableDefine(symbol: string, type: Type, initializer: Value): void;
        abstract variableGet(symbol: string): Value;
        abstract variableSet(symbol: string, value: Value): void;
        abstract variableMut(symbol: string, op: string, lazy: () => Value): Value;
    }
    export interface Node {
        execute(runner: Runner): void;
    }
    export interface Module {
        root: Node;
        get source(): string;
    }
}

class Runner extends Program.Runner {
    constructor(public program: Program, public logger: Logger) {
        super();
        this.variables = new SymbolTable();
        this.location = new Program.Location("");
    }
    variables: SymbolTable;
    location: Program.Location;
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
    throw(message: string, parameters?: ExceptionParameters): never {
        throw new RuntimeException(message, {
            ...parameters,
            location: this.location,
        });
    }
    run(): void {
        assert.eq(this.program.modules.length, 1);
        this.program.modules[0].root.execute(this);
    }
    variableDeclare(symbol: string, type: Type): void {
        this.variables.declare(symbol, type);
    }
    variableDefine(symbol: string, type: Type, initializer: Value): void {
        const compatible = type.compatible(initializer);
        if (compatible === undefined) {
            this.throw("Cannot initialize '{symbol}' of type '{dsttype}' with {srctype}", {
                symbol,
                dsttype: type.describe(),
                srctype:initializer.describe()
            });
        }
        this.variables.define(symbol, type, compatible);
    }
    variableGet(symbol: string): Value {
        const entry = this.variables.find(symbol);
        if (!entry) {
            this.throw("Variable not found in symbol table (get): '{symbol}'", {symbol});
        }
        return entry.value;
    }
    variableSet(symbol: string, value: Value): void {
        const entry = this.variables.find(symbol);
        if (entry === undefined) {
            this.throw("Variable not found in symbol table (set): '{symbol}'", {symbol});
        }
        const compatible = entry.type.compatible(value);
        if (compatible === undefined) {
            this.throw("Cannot assign value of type '{type}' to variable '{symbol}'", {
                symbol,
                type: entry.type.describe()
            });
        }
        entry.value = compatible;
    }
    variableMut(symbol: string, op: string, lazy: () => Value): Value {
        const entry = this.variables.find(symbol);
        if (entry === undefined) {
            this.throw("Variable not found in symbol table (mut): '{symbol}'", {symbol});
        }
        const result = entry.value.mutate(op, lazy);
        if (result instanceof Value) {
            return result;
        }
        throw result;
    }
    unimplemented(): never {
        assert.fail("Unimplemented: {caller}", {caller:this.unimplemented});
    }
}
