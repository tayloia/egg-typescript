import { Program } from "./program";
import { Value } from "./value";

export namespace Builtins {
    export namespace String {
        const SPACE = new Value.Unicode(new Uint32Array([32]));
        type Method = (instance: Value.Unicode, args: Program.Arguments) => Value;
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
        export function queryMethod(instance: Value.Unicode, method: string): Program.Callsite | undefined {
            const handler = methods.get(method);
            if (handler) {
                return (runner_, args) => {
                    args.funcname = "string." + method;
                    return handler(instance, args);
                };
            }
            return undefined;
        }
        export function concat(runner_: Program.Runner, args: Program.Arguments): Value {
            return Value.fromString(args.arguments.map(arg => arg.toString()).join(""));
        }
        function compareTo(instance: Value.Unicode, args: Program.Arguments): Value {
            args.expect(1);
            return Value.fromInt(BigInt(instance.compareTo(args.expectUnicode(0))));
        }
        function contains(instance: Value.Unicode, args: Program.Arguments): Value {
            args.expect(1);
            return Value.fromBool(instance.contains(args.expectUnicode(0)));
        }
        function endsWith(instance: Value.Unicode, args: Program.Arguments): Value {
            args.expect(1);
            return Value.fromBool(instance.endsWith(args.expectUnicode(0)));
        }
        function hash(instance: Value.Unicode, args: Program.Arguments): Value {
            args.expect(0);
            return Value.fromInt(instance.hash());
        }
        function indexOf(instance: Value.Unicode, args: Program.Arguments): Value {
            args.expect(1);
            const index = instance.indexOf(args.expectUnicode(0));
            return (index < 0) ? Value.fromNull() : Value.fromInt(BigInt(index));
        }
        function join(instance: Value.Unicode, args: Program.Arguments): Value {
            return Value.fromString(instance.join(args.arguments));
        }
        function lastIndexOf(instance: Value.Unicode, args: Program.Arguments): Value {
            args.expect(1);
            const index = instance.lastIndexOf(args.expectUnicode(0));
            return (index < 0) ? Value.fromNull() : Value.fromInt(BigInt(index));
        }
        function padStart(instance: Value.Unicode, args: Program.Arguments): Value {
            if (args.expect(1, 2) === 1) {
                return Value.fromString(instance.padStart(args.expectInt(0).toNumber(), SPACE));
            }
            return Value.fromString(instance.padStart(args.expectInt(0).toNumber(), args.expectUnicode(1)));
        }
        function padEnd(instance: Value.Unicode, args: Program.Arguments): Value {
            if (args.expect(1, 2) === 1) {
                return Value.fromString(instance.padEnd(args.expectInt(0).toNumber(), SPACE));
            }
            return Value.fromString(instance.padEnd(args.expectInt(0).toNumber(), args.expectUnicode(1)));
        }
        function repeat(instance: Value.Unicode, args: Program.Arguments): Value {
            args.expect(1);
            return Value.fromString(instance.repeat(args.expectInt(0).toNumber()));
        }
        function replace(instance: Value.Unicode, args: Program.Arguments): Value {
            if (args.expect(2, 3) === 2) {
                return Value.fromString(instance.replace(args.expectUnicode(0), args.expectUnicode(1)));
            }
            return Value.fromString(instance.replace(args.expectUnicode(0), args.expectUnicode(1), args.expectInt(2).toNumber()));
        }
        function slice(instance: Value.Unicode, args: Program.Arguments): Value {
            switch (args.expect(0, 2)) {
                case 1:
                    return Value.fromString(instance.slice(args.expectInt(0).toNumber()));
                case 2:
                    return Value.fromString(instance.slice(args.expectInt(0).toNumber(), args.expectInt(1).toNumber()));
            }
            return Value.fromString(instance);
        }
        function startsWith(instance: Value.Unicode, args: Program.Arguments): Value {
            args.expect(1);
            return Value.fromBool(instance.startsWith(args.expectUnicode(0)));
        }
        function toString(instance: Value.Unicode, args: Program.Arguments): Value {
            args.expect(0);
            return Value.fromString(instance);
        }
    }
}
