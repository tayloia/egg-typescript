import { assert } from "./assertion";
import { Builtins } from "./builtins";
import { RuntimeException } from "./exception";
import { FunctionArguments } from "./function";
import { ILogger, Logger } from "./logger";
import { Manifestations } from "./manifestations";
import { SymbolFlavour, SymbolTable } from "./symboltable";
import { Type } from "./type";
import { Value } from "./value";

export class Program {
    constructor(public readonly modules: Program.IModule[]) {}
    run(logger: Logger): void {
        const runner = new Runner(this, logger);
        runner.run();
    }
}

export namespace Program {
    export type Callsite = (runner: IRunner, args: FunctionArguments) => Value;
    export interface IResolver extends ILogger {
        resolveIdentifier(identifier: string): Type;
    }
    export interface IRunner extends IResolver {
        readonly manifestations: Manifestations;
        caught: Value;
        scopePush(): void;
        scopePop(): void;
        symbolAdd(symbol: string, flavour: SymbolFlavour, type: Type, value: Value): void;
        symbolGet(symbol: string): Value;
        symbolSet(symbol: string, value: Value): void;
        symbolMut(symbol: string, op: string, lazy: () => Value): Value;
    }
    export interface INode {
        execute(runner: IRunner): void;
    }
    export interface IModule {
        root: INode;
        get source(): string;
    }
}

class Runner implements Program.IRunner {
    constructor(public program: Program, public logger: Logger) {
        this.manifestations = Manifestations.createDefault();
        this.caught = Value.VOID;
        this.symbols = new SymbolTable();
        this.symbolBuiltin(new Builtins.Print());
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
    symbolBuiltin(builtin: Builtins.Builtin) {
        if (!this.symbols.add(builtin.definition.signature.name, SymbolFlavour.Builtin, builtin.definition.type, builtin.value)) {
            throw new RuntimeException("Duplicate built-in definition: '{builtin}'", {builtin:builtin.definition.signature.name});
        }
    }
    symbolAdd(symbol: string, flavour: SymbolFlavour, type: Type, value: Value): void {
        if (!value.isVoid()) {
            const compatible = type.compatible(value);
            if (compatible.isVoid()) {
                throw new RuntimeException(`Cannot initialize ${flavour} '{symbol}' of type '{type}' with ${value.describe()}`, {
                    symbol,
                    type: type.describe(),
                    value: value,
                });
            }
            value = compatible;
        }
        if (!this.symbols.add(symbol, flavour, type, value)) {
            throw new RuntimeException("Symbol already exists in symbol table (add): '{symbol}'", {symbol});
        }
    }
    symbolGet(symbol: string): Value {
        const entry = this.symbols.find(symbol);
        if (entry === undefined) {
            throw new RuntimeException("Symbol not found in symbol table: '{symbol}'", {symbol});
        }
        return entry.value;
    }
    symbolSet(symbol: string, value: Value): void {
        const entry = this.symbols.find(symbol);
        if (entry === undefined) {
            throw new RuntimeException("Cannot assign unknown symbol in symbol table: '{symbol}'", {symbol});
        }
        switch (entry.flavour) {
            case SymbolFlavour.Builtin:
            case SymbolFlavour.Manifestation:
            case SymbolFlavour.Function:
                throw new RuntimeException(`Cannot re-assign ${entry.flavour} value: '{symbol}'`, {symbol});
        }
        const compatible = entry.type.compatible(value);
        if (compatible.isVoid()) {
            throw new RuntimeException(`Cannot assign ${value.describe()} to ${entry.flavour} '{symbol}' of type '{type}'`, {
                symbol,
                type: entry.type.describe(),
                value: value,
            });
        }
        entry.value = compatible;
    }
    symbolMut(symbol: string, op: string, lazy: () => Value): Value {
        const entry = this.symbols.find(symbol);
        if (entry === undefined) {
            throw new RuntimeException("Cannot mutate unknown symbol in symbol table: '{symbol}'", {symbol});
        }
        switch (entry.flavour) {
            case SymbolFlavour.Builtin:
            case SymbolFlavour.Manifestation:
            case SymbolFlavour.Function:
                throw new RuntimeException(`Cannot mutate ${entry.flavour} value: '{symbol}'`, {symbol});
        }
        return entry.value.mutate(op, lazy);
    }
    unimplemented(): never {
        assert.fail("Unimplemented: {caller}", { caller: this.unimplemented });
    }
}
