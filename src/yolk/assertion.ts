import { BaseException, ExceptionOrigin, ExceptionParameters } from "./exception";

function extractCaller(caller: { name: string }): string {
    if (caller) {
        const error = new Error();
        if (error.stack) {
            const regexp = new RegExp(` +at .*${caller.name}.*\\s+ at (.*)`);
            const match = error.stack.match(regexp);
            if (match) {
                return match[1];
            }
        }
    }
    return "<UNKNOWN>";
}

export class AssertionException extends BaseException {
    constructor(message: string, parameters?: ExceptionParameters) {
        super("AssertionException", ExceptionOrigin.Assertion, message, parameters);
    }
}

export function assert(predicate: boolean, message?: string, parameters?: ExceptionParameters) : asserts predicate is true {
    if (predicate) {
        assert.pass();
    } else {
        assert.fail(message, parameters);
    }
}

assert.pass = function(): void {
}

assert.fail = function(message?: string, parameters?: ExceptionParameters): never {
    const caller = parameters?.caller as { name: string };
    if (caller) {
        parameters!.caller = extractCaller(caller);
    }
    throw new AssertionException(message ?? "Assertion failure", parameters);
}

assert.binop = function(predicate: boolean, lhs: unknown, rhs: unknown, op: string, caller: unknown): void {
    if (!predicate) {
        assert.fail(`Assertion failure: lhs ${op} rhs\n  lhs=${JSON.stringify(lhs)}\n  rhs=${JSON.stringify(rhs)}`, {lhs,rhs,op,caller});
    }
}

assert.eq = function(lhs: unknown, rhs: unknown): void {
    assert.binop(lhs === rhs, lhs, rhs, "===", assert.eq);
}

assert.ne = function(lhs: unknown, rhs: unknown): void {
    assert.binop(lhs !== rhs, lhs, rhs, "!==", assert.ne);
}

assert.lt = function(lhs: number, rhs: number): void {
    assert.binop(lhs < rhs, lhs, rhs, "<", assert.lt);
}

assert.le = function(lhs: number, rhs: number): void {
    assert.binop(lhs <= rhs, lhs, rhs, "<=", assert.le);
}

assert.gt = function(lhs: number, rhs: number): void {
    assert.binop(lhs > rhs, lhs, rhs, ">", assert.gt);
}

assert.ge = function(lhs: number, rhs: number): void {
    assert.binop(lhs >= rhs, lhs, rhs, ">=", assert.ge);
}

assert.falsey = function(value: unknown, message?: string, parameters?: ExceptionParameters): asserts value is undefined | null | false {
    if (value) {
        assert.fail(message ?? `Assertion failure: value not falsey: ${JSON.stringify(value)}`, {value,...parameters,caller:assert.truthy});
    }
}

assert.truthy = function(value: unknown, message?: string, parameters?: ExceptionParameters): asserts value {
    if (!value) {
        assert.fail(message ?? `Assertion failure: value not truthy: ${JSON.stringify(value)}`, {value,...parameters,caller:assert.truthy});
    }
}
