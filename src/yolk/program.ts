import { assert } from "./assertion";
import { RuntimeException } from "./exception";
import { FunctionArguments } from "./function";
import { Location } from "./location";
import { Logger } from "./logger";
import { Manifestations } from "./manifestations";
import { Message } from "./message";
import { SymbolFlavour, SymbolTable } from "./symboltable";
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
    export type Callsite = (runner: Runner, args: FunctionArguments) => Value;
    export abstract class Runner extends Logger {
        abstract location: Location;
        abstract manifestations: Manifestations;
        abstract symbolAdd(symbol: string, flavour: SymbolFlavour, type: Type, value: Value): void;
        abstract symbolGet(symbol: string): Value;
        abstract symbolSet(symbol: string, value: Value): void;
        abstract symbolMut(symbol: string, op: string, lazy: () => Value): Value;
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
        this.symbols = new SymbolTable();
        this.location = new Location("", 0, 0);
        this.manifestations = Manifestations.createDefault();
    }
    location: Location;
    manifestations: Manifestations;
    symbols: SymbolTable;
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
    run(): void {
        assert.eq(this.program.modules.length, 1);
        this.program.modules[0].root.execute(this);
    }
    symbolAdd(symbol: string, flavour: SymbolFlavour, type: Type, value: Value): void {
        if (value.isVoid()) {
            this.symbols.add(symbol, flavour, type, value);
        } else {
            const compatible = type.compatible(value);
            if (compatible.isVoid()) {
                this.raise("Cannot initialize '{symbol}' of type '{dsttype}' with {srctype}", {
                    symbol,
                    dsttype: type.describe(),
                    srctype:value.describe()
                });
            }
            this.symbols.add(symbol, flavour, type, compatible);
        }
    }
    symbolGet(symbol: string): Value {
        const entry = this.symbols.find(symbol);
        if (!entry) {
            this.raise("Variable not found in symbol table (get): '{symbol}'", {symbol});
        }
        return entry.value;
    }
    symbolSet(symbol: string, value: Value): void {
        const entry = this.symbols.find(symbol);
        if (entry === undefined) {
            this.raise("Variable not found in symbol table (set): '{symbol}'", {symbol});
        }
        const compatible = entry.type.compatible(value);
        if (compatible.isVoid()) {
            this.raise("Cannot assign value of type '{type}' to variable '{symbol}'", {
                symbol,
                type: entry.type.describe()
            });
        }
        entry.value = compatible;
    }
    symbolMut(symbol: string, op: string, lazy: () => Value): Value {
        const entry = this.symbols.find(symbol);
        if (entry === undefined) {
            this.raise("Variable not found in symbol table (mut): '{symbol}'", {symbol});
        }
        return entry.value.mutate(op, lazy).unwrap();
    }
    unimplemented(): never {
        assert.fail("Unimplemented: {caller}", {caller:this.unimplemented});
    }
}
