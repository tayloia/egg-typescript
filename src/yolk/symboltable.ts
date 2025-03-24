import { assert } from "./assertion";
import { Type } from "./type";
import { Value } from "./value";

export enum SymbolFlavour {
    Builtin = "builtin",
    Manifestation = "manifestation",
    Function = "function",
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
        assert.truthy(this.frame.chain, "No more frames in symbol table (pop)");
        this.frame = this.frame.chain;
    }
    add(symbol: string, flavour: SymbolFlavour, type: Type, initializer: Value) {
        assert(!this.frame.has(symbol), "Key already extant in symbol table (define): '{symbol}'", {symbol});
        this.frame.set(symbol, new SymbolTableEntry(symbol, flavour, type, initializer));
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
