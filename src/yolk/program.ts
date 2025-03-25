import { assert } from "./assertion";
import { Builtins } from "./builtins";
import { RuntimeException } from "./exception";
import { FunctionArguments } from "./function";
import { Logger } from "./logger";
import { Manifestations } from "./manifestations";
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
    export abstract class Resolver extends Logger {
        abstract resolveIdentifier(identifier: string): Type;
    }
    export abstract class Runner extends Resolver {
        abstract manifestations: Manifestations;
        abstract caught: Value;
        abstract scopePush(): void;
        abstract scopePop(): void;
        abstract symbolAdd(symbol: string, flavour: SymbolFlavour, type: Type, value: Value): void;
        abstract symbolGet(symbol: string): Value;
        abstract symbolSet(symbol: string, value: Value): void;
        abstract symbolMut(symbol: string, op: string, lazy: () => Value): Value;
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
        const print = new Builtins.Print();
        this.symbols.add("print", SymbolFlavour.Builtin, print.type, print.value);
        this.manifestations = Manifestations.createDefault();
        this.caught = Value.VOID;
    }
    manifestations: Manifestations;
    caught: Value;
    symbols: SymbolTable;
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
    resolveIdentifier(identifier: string): Type {
        const entry = this.symbols.find(identifier);
        if (!entry) {
            throw new RuntimeException("Identifier not found in symbol table (resolveIdentifier): '{identifier}'", {identifier});
        }
        return entry.type;
    }
    run(): void {
        assert.eq(this.program.modules.length, 1);
        this.program.modules[0].root.execute(this);
    }
    scopePush() {
        this.symbols.push();
    }
    scopePop() {
        this.symbols.pop();
    }
    symbolAdd(symbol: string, flavour: SymbolFlavour, type: Type, value: Value): void {
        if (value.isVoid()) {
            this.symbols.add(symbol, flavour, type, value);
        } else {
            const compatible = type.compatible(value);
            if (compatible.isVoid()) {
                throw new RuntimeException("Cannot initialize '{symbol}' of type '{dsttype}' with {srctype}", {
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
            throw new RuntimeException("Variable not found in symbol table (get): '{symbol}'", {symbol});
        }
        return entry.value;
    }
    symbolSet(symbol: string, value: Value): void {
        const entry = this.symbols.find(symbol);
        if (entry === undefined) {
            throw new RuntimeException("Variable not found in symbol table (set): '{symbol}'", {symbol});
        }
        const compatible = entry.type.compatible(value);
        if (compatible.isVoid()) {
            throw new RuntimeException("Cannot assign value of type '{type}' to variable '{symbol}'", {
                symbol,
                type: entry.type.describe()
            });
        }
        entry.value = compatible;
    }
    symbolMut(symbol: string, op: string, lazy: () => Value): Value {
        const entry = this.symbols.find(symbol);
        if (entry === undefined) {
            throw new RuntimeException("Variable not found in symbol table (mut): '{symbol}'", {symbol});
        }
        return entry.value.mutate(op, lazy);
    }
    unimplemented(): never {
        assert.fail("Unimplemented: {caller}", { caller: this.unimplemented });
    }
}
