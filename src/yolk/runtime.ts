import { assert } from "./assertion";
import { Builtins } from "./builtins";
import { Exception, RuntimeException } from "./exception";
import { FunctionArguments, FunctionDefinition, FunctionSignature } from "./function";
import { Location } from "./location";
import { Logger } from "./logger";
import { Message } from "./message";
import { Program } from "./program";
import { SymbolFlavour } from "./symboltable";
import { Type } from "./type";
import { Value } from "./value";
import { ValueMap } from "./valuemap";

enum Flow {
    Through = "through",
    Break = "break",
    Continue = "continue",
    Return = "return",
}

class Outcome {
    private constructor(public readonly flow: Flow, public readonly value: Value) {}
    static readonly THROUGH = new Outcome(Flow.Through, Value.VOID);
    static readonly BREAK = new Outcome(Flow.Break, Value.VOID);
    static readonly CONTINUE = new Outcome(Flow.Continue, Value.VOID);
    static readonly RETURN = new Outcome(Flow.Return, Value.VOID);
    static fromReturn(value?: Value) {
        return value === undefined ? Outcome.RETURN : new Outcome(Flow.Return, value);
    }
}

export namespace Runtime {
    export class ArrayInitializer {
        constructor(public readonly value: Node, public readonly ellipsis: boolean) {}
    }
    
    export class ObjectInitializer {
        constructor(public readonly key: string, public readonly value: Node, public readonly ellipsis: boolean) {}
    }
    
    export abstract class Node implements Program.INode {
        constructor(public location: Location) {}
        abstract resolve(resolver: Program.IResolver): Type;
        abstract evaluate(runner: Program.IRunner): Value;
        abstract execute(runner: Program.IRunner): Outcome;
        abstract modify(runner: Program.IRunner, op: string, expr: Node): Value;
        catch(error: unknown): never {
            const exception = Exception.from(error);
            if (exception) {
                exception.parameters.location ??= this.location;
            }
            throw error;
        }
        raise(message: string, parameters?: Message.Parameters): never {
            throw new RuntimeException(message, { location: this.location, ...parameters });
        }
        unimplemented(_: Program.IRunner | Program.IResolver): never {
            assert.fail("Unimplemented: {caller}", { caller: this.unimplemented });
        }
    }

    export class Node_Empty extends Node {
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner_: Program.IRunner): Value {
            // Used by empty conditions: 'for (...; ;...) {}'
            return Value.TRUE;
        }
        execute(runner_: Program.IRunner): Outcome {
            // Used by empty statement blocks: '{}'
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_Module extends Node {
        constructor(location: Location, public children: Node[]) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            for (const child of this.children) {
                const outcome = child.execute(runner);
                if (outcome.flow !== Flow.Through) {
                    return outcome;
                }
            }
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtBlock extends Node {
        constructor(location: Location, public children: Node[]) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            for (const child of this.children) {
                const outcome = child.execute(runner);
                if (outcome.flow !== Flow.Through) {
                    return outcome;
                }
            }
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtAssert extends Node {
        constructor(location: Location, public op: string, public children: Node[]) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            let left, right, passed;
            switch (this.children.length) {
                case 1:
                    if (this.op === "") {
                        passed = this.children[0].evaluate(runner).asBoolean();
                        if (!passed) {
                            this.raise("Assertion is untrue");
                        }
                    } else {
                        right = this.children[0].evaluate(runner);
                        passed = Value.unary(this.op, right).asBoolean();
                        if (!passed) {
                            this.raise("Assertion is untrue: {operator}{operand}", { operator: this.op, operand: right });
                        }
                    }
                    return Outcome.THROUGH;
                case 2:
                    left = this.children[0].evaluate(runner);
                    right = this.children[1].evaluate(runner);
                    passed = Value.binary(left, this.op, right).asBoolean();
                    if (!passed) {
                        this.raise("Assertion is untrue: {left} {operator} {right}", { left, operator: this.op, right });
                    }
                    return Outcome.THROUGH;
            }
            assert.fail("Invalid number of assertion nodes: {nodes}", {nodes:this.children.length});
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtCall extends Node {
        constructor(location: Location, public children: Node[]) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            const callee = this.children[0].evaluate(runner);
            const args = new FunctionArguments();
            for (let index = 1; index < this.children.length; ++index) {
                args.add(this.children[index].evaluate(runner));
            }
            const retval = callee.invoke(runner, args);
            if (!retval.isVoid()) {
                runner.log(Logger.Entry.warning("Function call statement returned non-void value", { value: retval }));
            }
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtVariableDefine extends Node {
        constructor(location: Location, public identifier: string, public type: Type, public initializer: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            const initializer = this.initializer.evaluate(runner);
            try {
                runner.symbolAdd(this.identifier, SymbolFlavour.Variable, this.type, initializer);
            }
            catch (error) {
                this.catch(error);
            }
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtFunctionDefine extends Node {
        constructor(location: Location, public signature: FunctionSignature, public block: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            const definition = new FunctionDefinition(this.signature, (runner, args) => {
                runner.scopePush();
                try {
                    let index = 0;
                    for (const argument of args.arguments) {
                        const parameter = this.signature.parameters[index++];
                        try {
                            runner.symbolAdd(parameter.name, SymbolFlavour.Argument, parameter.type, argument);
                        }
                        catch (error) {
                            this.catch(error);
                        }
                    }
                    const outcome = this.block.execute(runner);
                    assert(outcome.flow === Flow.Through || outcome.flow === Flow.Return);
                    return outcome.value;
                }
                finally {
                    runner.scopePop();
                }
            });
            try {
                const value = Value.fromVanillaFunction(definition);
                runner.symbolAdd(this.signature.name, SymbolFlavour.Function, value.getRuntimeType(), value);
            }
            catch (error) {
                this.catch(error);
            }
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtAssign extends Node {
        constructor(location: Location, public target: Node, public expr: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.target.modify(runner, "", this.expr);
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtMutate extends Node {
        constructor(location: Location, public op: string, public target: Node, public expr: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.target.modify(runner, this.op, this.expr);
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtNudge extends Node {
        constructor(location: Location, public op: string, public target: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.target.modify(runner, this.op, this.target);
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtForeach extends Node {
        constructor(location: Location, public identifier: string, public type: Type, public expr: Node, public block: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            const expr = this.expr.evaluate(runner);
            if (expr.kind === Value.Kind.String) {
                runner.scopePush();
                try {
                    runner.symbolAdd(this.identifier, SymbolFlavour.Variable, this.type, Value.VOID);
                    const unicode = expr.getUnicode();
                    for (let index = BigInt(0); index < unicode.length; ++index) {
                        runner.symbolSet(this.identifier, Value.fromString(unicode.at(index)));
                        const outcome = this.block.execute(runner);
                        if (outcome.flow === Flow.Break) {
                            break;
                        }
                        if (outcome.flow === Flow.Return) {
                            return outcome;
                        }
                    }
                }
                catch (error) {
                    this.catch(error);
                }
                finally {
                    runner.scopePop();
                }
                return Outcome.THROUGH;
            }
            if (expr.kind === Value.Kind.Proxy) {
                runner.scopePush();
                try {
                    runner.symbolAdd(this.identifier, SymbolFlavour.Variable, this.type, Value.VOID);
                    const iterator = expr.getProxy().getIterator();
                    for (let value = iterator(); !value.isVoid(); value = iterator()) {
                        runner.symbolSet(this.identifier, value);
                        const outcome = this.block.execute(runner);
                        if (outcome.flow === Flow.Break) {
                            break;
                        }
                        if (outcome.flow === Flow.Return) {
                            return outcome;
                        }
                    }
                }
                catch (error) {
                    this.catch(error);
                }
                finally {
                    runner.scopePop();
                }
                return Outcome.THROUGH;
            }
            this.expr.raise(`Value of type '${this.type.format()}' is not iterable in 'for' statement`);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtForloop extends Node {
        constructor(location: Location, public initialization: Node, public condition: Node, public advance: Node, public block: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            let outcome = this.initialization.execute(runner);
            assert.eq(outcome.flow, Flow.Through);
            for (;;) {
                const condition = this.condition.evaluate(runner);
                if (!condition.asBoolean()) {
                    break;
                }
                outcome = this.block.execute(runner);
                if (outcome.flow === Flow.Break) {
                    break;
                }
                if (outcome.flow === Flow.Return) {
                    return outcome;
                }
                outcome = this.advance.execute(runner);
                assert.eq(outcome.flow, Flow.Through);
            }
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtIf extends Node {
        constructor(location: Location, public condition: Node, public ifBlock: Node, public elseBlock: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            const condition = this.condition.evaluate(runner);
            if (condition.asBoolean()) {
                return this.ifBlock.execute(runner);
            }
            return this.elseBlock.execute(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtIfGuard extends Node {
        constructor(location: Location, public identifier: string, public type: Type, public initializer: Node, public ifBlock: Node, public elseBlock: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            const initializer = this.initializer.evaluate(runner);
            const compatible = this.type.compatibleValue(initializer);
            if (!compatible.isVoid()) {
                runner.scopePush();
                try {
                    try {
                        runner.symbolAdd(this.identifier, SymbolFlavour.Guard, this.type, compatible);
                    }
                    catch (error) {
                        this.catch(error);
                    }
                    return this.ifBlock.execute(runner);
                }
                finally {
                    runner.scopePop();
                }
            }
            return this.elseBlock.execute(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtWhile extends Node {
        constructor(location: Location, public condition: Node, public block: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            while (this.condition.evaluate(runner).asBoolean()) {
                const outcome = this.block.execute(runner);
                if (outcome.flow !== Flow.Through && outcome.flow !== Flow.Continue) {
                    return outcome;
                }
            }
            return Outcome.THROUGH;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtWhileGuard extends Node {
        constructor(location: Location, public identifier: string, public type: Type, public initializer: Node, public block: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            runner.scopePush();
            try {
                runner.symbolAdd(this.identifier, SymbolFlavour.Guard, this.type, Value.VOID);
                for (;;) {
                    const initializer = this.initializer.evaluate(runner);
                    const compatible = this.type.compatibleValue(initializer);
                    if (compatible.isVoid()) {
                        return Outcome.THROUGH;
                    }
                    try {
                        runner.symbolSet(this.identifier, compatible);
                    }
                    catch (error) {
                        this.catch(error);
                    }
                    const outcome = this.block.execute(runner);
                    if (outcome.flow !== Flow.Through && outcome.flow !== Flow.Continue) {
                        return outcome;
                    }
                }
            }
            finally {
                runner.scopePop();
            }
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtReturn extends Node {
        constructor(location: Location, public expr?: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            if (this.expr === undefined) {
                return Outcome.RETURN;
            }
            const retval = this.expr.evaluate(runner);
            return Outcome.fromReturn(retval);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtTry extends Node {
        constructor(location: Location, public tryBlock: Node, public catchClauses: Node[], public finallyClause: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            let outcome: Outcome;
            try {
                outcome = this.tryBlock.execute(runner);
            }
            catch (error) {
                const exception = Exception.from(error);
                if (exception && exception.origin === Exception.Origin.Runtime) {
                    runner.caught = Value.fromRuntimeException(exception);
                    for (const clause of this.catchClauses) {
                        outcome = clause.execute(runner);
                        switch (outcome.flow) {
                            case Flow.Through:
                                // This clause matched and ran to completion
                                return outcome;
                            case Flow.Continue:
                                // This clause doesn't match
                                break;
                            case Flow.Return:
                                // Explicit return statement
                                return outcome;
                            case Flow.Break:
                                // Shouldn't happen
                                assert.unreachable();
                        }
                    }
                }
                this.catch(error);
            }
            finally {
                const last = this.finallyClause.execute(runner);
                assert.eq(last.flow, Flow.Through);
            }
            assert(outcome.flow === Flow.Through || outcome.flow === Flow.Return);
            return outcome;
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_StmtCatch extends Node {
        constructor(location: Location, public identifier: string, public type: Node, public block: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            const type = this.type.resolve(runner);
            assert(!type.isEmpty());
            const exception = type.compatibleValue(runner.caught);
            if (exception.isVoid()) {
                return Outcome.CONTINUE;
            }
            runner.scopePush();
            try {
                try {
                    runner.symbolAdd(this.identifier, SymbolFlavour.Variable, type, exception);
                }
                catch (error) {
                    this.catch(error);
                }
                const outcome = this.block.execute(runner);
                assert(outcome.flow === Flow.Through || outcome.flow === Flow.Return);
                return outcome;
            }
            finally {
                runner.scopePop();
            }
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ValueVariableGet extends Node {
        constructor(location: Location, public identifier: string) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            try {
                return resolver.resolveIdentifier(this.identifier);
            }
            catch (error) {
                this.catch(error);
            }
        }
        evaluate(runner: Program.IRunner): Value {
            try {
                return runner.symbolGet(this.identifier);
            }
            catch (error) {
                this.catch(error);
            }
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ValuePropertyGet extends Node {
        constructor(location: Location, public instance: Node, public property: string) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            const value = this.instance.evaluate(runner);
            if (value.kind === Value.Kind.String) {
                const unicode = value.getUnicode();
                if (this.property === "length") {
                    return Value.fromInt(unicode.length);
                }
                const proxy = Builtins.String.queryProxy(unicode, this.property);
                if (proxy) {
                    return Value.fromProxy(proxy);
                }
                this.raise("Unknown property for 'string': '{property}'", { property: this.property });
            }
            if (value.kind === Value.Kind.Proxy) {
                try {
                    return value.getProxy().getProperty(this.property);
                }
                catch (error) {
                    this.catch(error);
                }
            }
            assert.fail(`Cannot get property for ${value.kind}`);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ValueIndexGet extends Node {
        constructor(location: Location, public instance: Node, public index: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            const value = this.instance.evaluate(runner);
            if (value.kind === Value.Kind.String) {
                const index = this.index.evaluate(runner).getInt();
                const unicode = value.getUnicode();
                const char = unicode.at(index.toBigint());
                if (!char) {
                    this.raise("String index {index} is out of range for a string of length {length}", { index, length: unicode.length });
                }
                return Value.fromString(char);
            }
            if (value.kind === Value.Kind.Proxy) {
                const proxy = value.getProxy();
                const index = this.index.evaluate(runner);
                return proxy.getIndex(index);
            }
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ManifestationVoid extends Node {
        resolve(resolver_: Program.IResolver): Type {
            return Type.VOID;
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ManifestationBool extends Node {
        resolve(resolver_: Program.IResolver): Type {
            return Type.BOOL;
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ManifestationInt extends Node {
        resolve(resolver_: Program.IResolver): Type {
            return Type.INT;
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ManifestationFloat extends Node {
        resolve(resolver_: Program.IResolver): Type {
            return Type.FLOAT;
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ManifestationString extends Node {
        resolve(resolver: Program.IResolver): Type {
            return resolver.manifestations.STRING.getRuntimeType();
        }
        evaluate(runner: Program.IRunner): Value {
            return Value.fromProxy(runner.manifestations.STRING.getProxy());
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ManifestationObject extends Node {
        resolve(resolver: Program.IResolver): Type {
            return resolver.manifestations.OBJECT.getRuntimeType();
        }
        evaluate(runner: Program.IRunner): Value {
            return Value.fromProxy(runner.manifestations.OBJECT.getProxy());
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ManifestationAny extends Node {
        resolve(resolver_: Program.IResolver): Type {
            return Type.ANY;
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ManifestationType extends Node {
        resolve(resolver: Program.IResolver): Type {
            return resolver.manifestations.TYPE.getRuntimeType();
        }
        evaluate(runner: Program.IRunner): Value {
            return Value.fromProxy(runner.manifestations.TYPE.getProxy());
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_TypePrimitive extends Node {
        constructor(location: Location, public type: Type) {
            super(location);
        }
        resolve(resolver_: Program.IResolver): Type {
            return this.type;
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_TypeNullable extends Node {
        constructor(location: Location, public type: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            let type = this.type.resolve(resolver);
            if (!type.isEmpty()) {
                type = type.addPrimitive(Type.Primitive.Null);
            }
            return type;
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_TargetVariable extends Node {
        constructor(location: Location, public identifier: string) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op: string, expr: Node): Value {
            try {
                if (op === "") {
                    runner.symbolSet(this.identifier, expr.evaluate(runner));
                    return Value.VOID;
                }
                return runner.symbolMut(this.identifier, op, () => expr.evaluate(runner));
            }
            catch (error) {
                this.catch(error);
            }
        }
    }

    export class Node_TargetProperty extends Node {
        constructor(location: Location, public instance: Node, public property: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op: string, expr: Node): Value {
            const instance = this.instance.evaluate(runner);
            if (instance.kind === Value.Kind.String) {
                const property = this.property.evaluate(runner).asString();
                this.raise("Values of type 'string' do not support modification of property '{property}'", { property });
            }
            if (instance.kind === Value.Kind.Proxy) {
                const property = this.property.evaluate(runner).asString();
                if (op === "") {
                    const value = expr.evaluate(runner);
                    return instance.getProxy().setProperty(property, value);
                }
                return instance.getProxy().mutProperty(property, op, () => expr.evaluate(runner));
            }
            this.unimplemented(runner);
        }
    }

    export class Node_TargetIndex extends Node {
        constructor(location: Location, public instance: Node, public index: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            this.unimplemented(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op: string, expr: Node): Value {
            const instance = this.instance.evaluate(runner);
            if (instance.kind === Value.Kind.Proxy) {
                const index = this.index.evaluate(runner);
                if (op === "") {
                    const value = expr.evaluate(runner);
                    return instance.getProxy().setIndex(index, value);
                }
                return instance.getProxy().mutIndex(index, op, () => expr.evaluate(runner));
            }
            this.unimplemented(runner);
        }
    }

    export class Node_ValueScalar extends Node {
        constructor(location: Location, private value: Value) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            switch (this.value.kind) {
                case Value.Kind.Null:
                    return Type.NULL;
                case Value.Kind.Bool:
                    return Type.BOOL;
                case Value.Kind.Int:
                    return Type.INT;
                case Value.Kind.Float:
                    return Type.FLOAT;
                case Value.Kind.String:
                    return Type.STRING;
            }
            this.unimplemented(resolver);
        }
        evaluate(runner_: Program.IRunner): Value {
            return this.value;
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ValueArray extends Node {
        constructor(location: Location, private initializers: ArrayInitializer[]) {
            super(location);
        }
        resolve(resolver_: Program.IResolver): Type {
            return Type.OBJECT;
        }
        evaluate(runner: Program.IRunner): Value {
            const elements = new Array<Value>();
            for (const initializer of this.initializers) {
                assert(!initializer.ellipsis);
                const value = initializer.value.evaluate(runner);
                assert(!value.isVoid());
                elements.push(value);
            }
            return Value.fromVanillaArray(elements);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ValueObject extends Node {
        constructor(location: Location, private initializers: ObjectInitializer[]) {
            super(location);
        }
        resolve(resolver_: Program.IResolver): Type {
            return Type.OBJECT;
        }
        evaluate(runner: Program.IRunner): Value {
            const elements = new ValueMap();
            for (const initializer of this.initializers) {
                assert(!initializer.ellipsis);
                const key = Value.fromString(initializer.key);
                const value = initializer.value.evaluate(runner);
                assert(!value.isVoid());
                elements.set(key, value);
            }
            return Value.fromVanillaObject(elements);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ValueCall extends Node {
        constructor(location: Location, public children: Node[]) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            const callee = this.children[0].resolve(resolver);
            assert(!callee.isEmpty());
            const callables = callee.getCallables();
            if (callables.length > 0) {
                return Type.union(...callables.map(i => i.rettype));
            }
            this.raise(`Cannot call ${callee.describeValue()}`);
        }
        evaluate(runner: Program.IRunner): Value {
            const callee = this.children[0].evaluate(runner);
            const args = new FunctionArguments();
            for (let arg = 1; arg < this.children.length; ++arg) {
                args.add(this.children[arg].evaluate(runner));
            }
            return callee.invoke(runner, args);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ValueOperatorBinary extends Node {
        constructor(location: Location, public lhs: Node, public op: string, public rhs: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            const ltype = this.lhs.resolve(resolver);
            const rtype = this.rhs.resolve(resolver);
            return Type.binary(ltype, this.op, rtype);
        }
        evaluate(runner: Program.IRunner): Value {
            const lhs = this.lhs.evaluate(runner);
            const rhs = this.rhs.evaluate(runner);
            try {
                return Value.binary(lhs, this.op, rhs);
            }
            catch (error) {
                this.catch(error);
            }
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }

    export class Node_ValueOperatorTernary extends Node {
        constructor(location: Location, public lhs: Node, public mid: Node, public rhs: Node) {
            super(location);
        }
        resolve(resolver: Program.IResolver): Type {
            this.unimplemented(resolver);
        }
        evaluate(runner: Program.IRunner): Value {
            const lhs = this.lhs.evaluate(runner);
            if (lhs.kind !== Value.Kind.Bool) {
                this.lhs.raise(`Expected condition of ternary operator '?:' to be a 'bool', but instead got ${lhs.describe()}`, { value: lhs });
            }
            return lhs.asBoolean() ? this.mid.evaluate(runner) : this.rhs.evaluate(runner);
        }
        execute(runner: Program.IRunner): Outcome {
            this.unimplemented(runner);
        }
        modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
            this.unimplemented(runner);
        }
    }
}
