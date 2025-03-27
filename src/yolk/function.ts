import { assert } from "./assertion";
import { RuntimeException } from "./exception";
import { FormatOptions, IFormattable } from "./format";
import { Location } from "./location";
import { Message } from "./message";
import { Program } from "./program";
import { Type } from "./type";
import { Value } from "./value";

export class FunctionArguments {
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
    expectProxy(index: number) {
        const value = this.arguments[index];
        if (value.kind !== Value.Kind.Proxy) {
            this.fail("Expected argument {index} to be an 'object', but got {value}" + value.describe(), {index, value});
        }
        return value.getProxy();
    }
    fail(message: string, parameters?: Message.Parameters): never {
        if (this.funcname) {
            throw new RuntimeException(message + " in function call to '{function}()'", { ...parameters, function: this.funcname });
        }
        throw new RuntimeException(message + " in function call", parameters);
    }
}

export class FunctionParameter {
    constructor(public readonly name: string, public readonly type: Type, public readonly defval?: Value) {}
}

export class FunctionSignature implements IFormattable {
    constructor(public readonly name: string, public readonly location: Location, public readonly rettype: Type, public parameters: FunctionParameter[]) {}
    format(options?: FormatOptions): string {
        return `${this.rettype.format(options)}(${this.parameters.map(p => p.type.format(options)).join(",")})`;
    }
}

export class FunctionDefinition implements IFormattable {
    constructor(public readonly signature: FunctionSignature, public readonly invoke: Program.Callsite) {
        this.type = Type.OBJECT;
    }
    readonly type: Type;
    format(options?: FormatOptions): string {
        return this.signature.format(options);
    }
    describe(): string {
        return `function '${this.signature.name}()'`;
    }
}

