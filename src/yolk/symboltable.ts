import { assert } from "./assertion";
import { Type } from "./type";
import { Value } from "./value";

export class SymbolTableEntry {
    constructor(public name: string, public type: Type, public value: Value) {}
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
    define(key: string, type: Type, initializer: Value) {
        assert(!this.frame.has(key), "Key already extant in symbol table (define): '{key}'", {key});
        this.frame.set(key, new SymbolTableEntry(key, type, initializer));
    }
    declare(key: string, type: Type) {
        assert(!this.frame.has(key), "Key already extant in symbol table (declare): '{key}'", {key});
        this.frame.set(key, new SymbolTableEntry(key, type, Value.VOID));
    }
    find(key: string): SymbolTableEntry | undefined {
        let frame: SymbolTableFrame | undefined = this.frame;
        while (frame) {
            const entry = frame.get(key);
            if (entry) {
                return entry;
            }
            frame = frame.chain;
        }
        return undefined;
    }
}
