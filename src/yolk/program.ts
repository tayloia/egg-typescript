import { assert } from "./assertion";
import { RuntimeException } from "./exception";
import { Location } from "./location";
import { Logger } from "./logger";
import { Message } from "./message";
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
    export type Callsite = (runner: Runner, args: Arguments) => Value;
    export class Arguments {
        funcname: string = "";
        arguments: Value[] = [];
        add(argument: Value) {
            this.arguments.push(argument);
        }
        evaluate(callee: Value) {
            return callee;
        }
        expect(lbound: number, ubound: number = lbound): number {
            const expected = () => ["no arguments", "one argument"][lbound] ?? "{expected} arguments";
            assert.le(lbound, ubound);
            if (lbound === ubound) {
                // Exact number of arguments expected
                if (this.arguments.length !== lbound) {
                    this.fail(`Expected ${expected()}, but got {actual}`, {expected: lbound, actual: this.arguments.length});
                }
            } else if (this.arguments.length < lbound) {
                this.fail(`Expected at least ${expected()}, but got {actual}`, {actual: this.arguments.length});
            } else if (this.arguments.length > ubound) {
                this.fail(`Expected no more than ${expected()}, but got {actual}`, {actual: this.arguments.length});
            }
            return this.arguments.length;
        }
        expectInt(index: number) {
            const value = this.arguments[index];
            if (value.kind !== Value.Kind.Int) {
                this.fail("Expected argument {index} to be an 'int', but got {value}" + value.describe(), {index, value});
            }
            return value.getInt();
        }
        expectUnicode(index: number) {
            const value = this.arguments[index];
            if (value.kind !== Value.Kind.String) {
                this.fail("Expected argument {index} to be a 'string', but got {value}" + value.describe(), {index, value});
            }
            return value.getUnicode();
        }
        expectString(index: number) {
            return this.expectUnicode(index).toString();
        }
        fail(message: string, parameters?: Message.Parameters): never {
            if (this.funcname) {
                throw new RuntimeException(message + " in function call to '{function}()'", { ...parameters, function: this.funcname });
            }
            throw new RuntimeException(message + " in function call", parameters);
        }
    }
    export abstract class Runner extends Logger {
        abstract location: Location;
        abstract variableDeclare(symbol: string, type: Type): void;
        abstract variableDefine(symbol: string, type: Type, initializer: Value): void;
        abstract variableGet(symbol: string): Value;
        abstract variableSet(symbol: string, value: Value): void;
        abstract variableMut(symbol: string, op: string, lazy: () => Value): Value;
        raise(message: string, parameters?: Message.Parameters): never {
            throw new RuntimeException(message, { ...parameters, location: this.location });
        }
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
        this.location = new Location("", 0, 0);
    }
    variables: SymbolTable;
    location: Location;
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
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
            this.raise("Cannot initialize '{symbol}' of type '{dsttype}' with {srctype}", {
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
            this.raise("Variable not found in symbol table (get): '{symbol}'", {symbol});
        }
        return entry.value;
    }
    variableSet(symbol: string, value: Value): void {
        const entry = this.variables.find(symbol);
        if (entry === undefined) {
            this.raise("Variable not found in symbol table (set): '{symbol}'", {symbol});
        }
        const compatible = entry.type.compatible(value);
        if (compatible === undefined) {
            this.raise("Cannot assign value of type '{type}' to variable '{symbol}'", {
                symbol,
                type: entry.type.describe()
            });
        }
        entry.value = compatible;
    }
    variableMut(symbol: string, op: string, lazy: () => Value): Value {
        const entry = this.variables.find(symbol);
        if (entry === undefined) {
            this.raise("Variable not found in symbol table (mut): '{symbol}'", {symbol});
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
