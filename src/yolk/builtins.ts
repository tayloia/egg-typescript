import { FunctionArguments, FunctionDefinition, FunctionSignature } from "./function";
import { Location } from "./location";
import { Logger } from "./logger";
import { Program } from "./program";
import { ProxyStringMethod } from "./proxy";
import { Type } from "./type";
import { Value } from "./value";

const LOCATION = new Location("(builtin)", 0, 0);

export namespace Builtins {
    export class Print {
        readonly signature = new FunctionSignature("print", LOCATION, Type.VOID, []);
        readonly definition = new FunctionDefinition(this.signature, this.invoke);
        readonly type = Type.OBJECT;
        readonly value = Value.fromVanillaFunction(this.definition);
        private invoke(runner: Program.IRunner, args: FunctionArguments): Value {
            const text = args.arguments.map(arg => arg.toString()).join("");
            runner.log(Logger.Entry.print(text));
            return Value.VOID;
        }
    }
    export namespace String {
        const SPACE = new Value.Unicode(new Uint32Array([32]));
        export type Method = (instance: Value.Unicode, args: FunctionArguments) => Value;
        const methods = new Map<String, Method>([
            ["compareTo", compareTo],
            ["contains", contains],
            ["endsWith", endsWith],
            ["hash", hash],
            ["indexOf", indexOf],
            ["join", join],
            ["lastIndexOf", lastIndexOf],
            ["padStart", padStart],
            ["padEnd", padEnd],
            ["repeat", repeat],
            ["replace", replace],
            ["slice", slice],
            ["startsWith", startsWith],
            ["toString", toString],
        ]);
        export function queryProxy(instance: Value.Unicode, method: string): Value.IProxy | undefined {
            const handler = methods.get(method);
            if (handler) {
                return new ProxyStringMethod(method, (runner_, args) => {
                    return handler(instance, args);
                });
            }
            return undefined;
        }
        export function concat(runner_: Program.IRunner, args: FunctionArguments): Value {
            return Value.fromString(args.arguments.map(arg => arg.toString()).join(""));
        }
        function compareTo(instance: Value.Unicode, args: FunctionArguments): Value {
            args.expect(1);
            return Value.fromInt(BigInt(instance.compareTo(args.expectUnicode(0))));
        }
        function contains(instance: Value.Unicode, args: FunctionArguments): Value {
            args.expect(1);
            return Value.fromBool(instance.contains(args.expectUnicode(0)));
        }
        function endsWith(instance: Value.Unicode, args: FunctionArguments): Value {
            args.expect(1);
            return Value.fromBool(instance.endsWith(args.expectUnicode(0)));
        }
        function hash(instance: Value.Unicode, args: FunctionArguments): Value {
            args.expect(0);
            return Value.fromInt(instance.hash());
        }
        function indexOf(instance: Value.Unicode, args: FunctionArguments): Value {
            args.expect(1);
            const index = instance.indexOf(args.expectUnicode(0));
            return (index < 0) ? Value.fromNull() : Value.fromInt(BigInt(index));
        }
        function join(instance: Value.Unicode, args: FunctionArguments): Value {
            return Value.fromString(instance.join(args.arguments));
        }
        function lastIndexOf(instance: Value.Unicode, args: FunctionArguments): Value {
            args.expect(1);
            const index = instance.lastIndexOf(args.expectUnicode(0));
            return (index < 0) ? Value.fromNull() : Value.fromInt(BigInt(index));
        }
        function padStart(instance: Value.Unicode, args: FunctionArguments): Value {
            if (args.expect(1, 2) === 1) {
                return Value.fromString(instance.padStart(args.expectInt(0).toNumber(), SPACE));
            }
            return Value.fromString(instance.padStart(args.expectInt(0).toNumber(), args.expectUnicode(1)));
        }
        function padEnd(instance: Value.Unicode, args: FunctionArguments): Value {
            if (args.expect(1, 2) === 1) {
                return Value.fromString(instance.padEnd(args.expectInt(0).toNumber(), SPACE));
            }
            return Value.fromString(instance.padEnd(args.expectInt(0).toNumber(), args.expectUnicode(1)));
        }
        function repeat(instance: Value.Unicode, args: FunctionArguments): Value {
            args.expect(1);
            return Value.fromString(instance.repeat(args.expectInt(0).toNumber()));
        }
        function replace(instance: Value.Unicode, args: FunctionArguments): Value {
            if (args.expect(2, 3) === 2) {
                return Value.fromString(instance.replace(args.expectUnicode(0), args.expectUnicode(1)));
            }
            return Value.fromString(instance.replace(args.expectUnicode(0), args.expectUnicode(1), args.expectInt(2).toNumber()));
        }
        function slice(instance: Value.Unicode, args: FunctionArguments): Value {
            switch (args.expect(0, 2)) {
                case 1:
                    return Value.fromString(instance.slice(args.expectInt(0).toNumber()));
                case 2:
                    return Value.fromString(instance.slice(args.expectInt(0).toNumber(), args.expectInt(1).toNumber()));
            }
            return Value.fromString(instance);
        }
        function startsWith(instance: Value.Unicode, args: FunctionArguments): Value {
            args.expect(1);
            return Value.fromBool(instance.startsWith(args.expectUnicode(0)));
        }
        function toString(instance: Value.Unicode, args: FunctionArguments): Value {
            args.expect(0);
            return Value.fromString(instance);
        }
    }
}
