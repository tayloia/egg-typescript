import { Value } from "./value";

type ValueMapKey = boolean | bigint | number | string | object;

class ValueMapPair {
    constructor(public key: Value, public value: Value) {}
}

export class ValueMap {
    private entries = new Map<ValueMapKey, ValueMapPair>();
    get(key: Value): Value | undefined {
        const vmk = ValueMap.keyof(key);
        return this.entries.get(vmk)?.value;
    }
    set(key: Value, value: Value): void {
        const vmk = ValueMap.keyof(key);
        this.entries.set(vmk, new ValueMapPair(key, value));
    }
    swap(key: Value, value: Value): Value | undefined {
        const vmk = ValueMap.keyof(key);
        const entry = this.entries.get(vmk);
        if (entry) {
            return entry.value.swap(value);
        }
        this.entries.set(vmk, new ValueMapPair(key, value));
        return undefined;
    }
    delete(key: Value) {
        const vmk = ValueMap.keyof(key);
        const entry = this.entries.get(vmk);
        if (entry) {
            this.entries.delete(vmk);
            return entry.value;
        }
        return undefined;
    }
    chronological<T>(mapper: (kv: ValueMapPair) => T) {
        return [...this.entries.values()].map(mapper);
    }
    ordered<T>(mapper: (kv: ValueMapPair) => T, order?: (a: ValueMapPair, b: ValueMapPair) => number) {
        order ??= (a, b) => a.key.compare(b.key);
        return [...this.entries.values()].sort(order).map(mapper);
    }
    static keyof(value: Value): ValueMapKey {
        switch (value.kind) {
            case Value.Kind.Void:
                return Value.VOID;
            case Value.Kind.Null:
                return Value.NULL;
            case Value.Kind.Bool:
                return value.asBoolean();
            case Value.Kind.Int:
                return value.asBigint();
            case Value.Kind.Float:
                return value.asNumber();
            case Value.Kind.String:
                return value.asString();
            case Value.Kind.Proxy:
                return value.getProxy();
        }
    }
}
