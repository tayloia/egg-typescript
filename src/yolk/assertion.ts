import { BaseException, ExceptionParameters } from "./exception";

export class AssertionException extends BaseException {
    constructor(message: string, parameters?: ExceptionParameters) {
        super("AssertionException", message, parameters);
    }
}

export function assert(predicate: boolean, message?: string, parameters?: ExceptionParameters): void {
    if (predicate) {
        assert.pass();
    } else {
        assert.fail(message, parameters);
    }
}

assert.pass = function(): void {
}

assert.fail = function(message?: string, parameters?: ExceptionParameters): never {
    throw new AssertionException(message ?? "Assertion failure", parameters);
}

assert.binop = function(predicate: boolean, lhs: unknown, rhs: unknown, op: string): void {
    if (!predicate) {
        assert.fail(`Assertion failure: lhs ${op} rhs\n  lhs=${JSON.stringify(lhs)}\n  rhs=${JSON.stringify(rhs)}`, {lhs,rhs,op});
    }
}

assert.eq = function(lhs: unknown, rhs: unknown): void {
    assert.binop(lhs === rhs, lhs, rhs, "===");
}

assert.ne = function(lhs: unknown, rhs: unknown): void {
    assert.binop(lhs !== rhs, lhs, rhs, "!==");
}
