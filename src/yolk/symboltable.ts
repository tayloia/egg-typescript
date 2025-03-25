import { assert } from "./assertion";
import { Type } from "./type";
import { Value } from "./value";

export enum SymbolFlavour {
    Builtin = "built-in",
    Manifestation = "manifestation",
    Function = "function",
    Argument = "argument",
    Exception = "exception",
    Variable = "variable",
}

export class SymbolTableEntry {
    constructor(public name: string, public flavour: SymbolFlavour, public type: Type, public value: Value) {}
}

class SymbolTableFrame extends Map<string, SymbolTableEntry> {
    constructor(public chain: SymbolTableFrame | undefined) {
        super();
    }
}

export class SymbolTable {
    private frame = new SymbolTableFrame(undefined);
    push() {
        this.frame = new SymbolTableFrame(this.frame);
    }
    pop() {
        if (this.frame.chain) {
            this.frame = this.frame.chain;
        } else {
            assert.unreachable();
        }
    }
    add(symbol: string, flavour: SymbolFlavour, type: Type, initializer: Value): boolean {
        if (this.frame.has(symbol)) {
            return false;
        }
        this.frame.set(symbol, new SymbolTableEntry(symbol, flavour, type, initializer));
        return true;
    }
    find(symbol: string): SymbolTableEntry | undefined {
        let frame: SymbolTableFrame | undefined = this.frame;
        while (frame) {
            const entry = frame.get(symbol);
            if (entry) {
                return entry;
            }
            frame = frame.chain;
        }
        return undefined;
    }
}
