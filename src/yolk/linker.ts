import { assert } from "./assertion";
import { Builtins } from "./builtins";
import { Compiler } from "./compiler";
import { Exception, RuntimeException } from "./exception";
import { FunctionArguments, FunctionDefinition, FunctionParameter, FunctionSignature } from "./function";
import { Location } from "./location";
import { ConsoleLogger, Logger } from "./logger";
import { Message } from "./message";
import { Program } from "./program";
import { SymbolFlavour } from "./symboltable";
import { Type } from "./type";
import { Value } from "./value";
import { ValueMap } from "./valuemap";

class ArrayInitializer {
    constructor(public readonly value: Node, public readonly ellipsis: boolean) {}
}

class ObjectInitializer {
    constructor(public readonly key: string, public readonly value: Node, public readonly ellipsis: boolean) {}
}

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

abstract class Node {
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

class Node_Empty extends Node {
    constructor(location: Location) {
        super(location);
    }
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

class Node_Module extends Node {
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

class Node_StmtBlock extends Node {
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

class Node_StmtAssert extends Node {
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

class Node_StmtCall extends Node {
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

class Node_StmtVariableDefine extends Node {
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

class Node_StmtFunctionDefine extends Node {
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
            runner.symbolAdd(this.signature.name, SymbolFlavour.Function, definition.type, Value.fromVanillaFunction(definition));
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

class Node_StmtAssign extends Node {
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

class Node_StmtMutate extends Node {
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

class Node_StmtNudge extends Node {
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

class Node_StmtForeach extends Node {
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
        this.expr.raise("Value of type '{type}' is not iterable in 'for' statement", { type: this.type.describe() });
    }
    modify(runner: Program.IRunner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtForloop extends Node {
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

class Node_StmtIf extends Node {
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

class Node_StmtIfGuard extends Node {
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
        const compatible = this.type.compatible(initializer);
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

class Node_StmtReturn extends Node {
    constructor(location: Location, public expr: Node | undefined) {
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

class Node_StmtTry extends Node {
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

class Node_StmtCatch extends Node {
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
        const exception = type.compatible(runner.caught);
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

class Node_ValueVariableGet extends Node {
    constructor(location: Location, public identifier: string) {
        super(location);
    }
    resolve(resolver: Program.IResolver): Type {
        return resolver.resolveIdentifier(this.identifier);
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

class Node_ValuePropertyGet extends Node {
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

class Node_ValueIndexGet extends Node {
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

abstract class Node_TypeLiteral extends Node {
    constructor(location: Location) {
        super(location);
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

class Node_TypeLiteral_Void extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Program.IResolver): Type {
        return Type.VOID;
    }
}

class Node_TypeLiteral_Bool extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Program.IResolver): Type {
        return Type.BOOL;
    }
}

class Node_TypeLiteral_Int extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Program.IResolver): Type {
        return Type.INT;
    }
}

class Node_TypeLiteral_Float extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Program.IResolver): Type {
        return Type.FLOAT;
    }
}

class Node_TypeLiteral_String extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    evaluate(runner: Program.IRunner): Value {
        return Value.fromProxy(runner.manifestations.STRING);
    }
    resolve(resolver_: Program.IResolver): Type {
        return Type.STRING;
    }
}

class Node_TypeLiteral_Object extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    evaluate(runner: Program.IRunner): Value {
        return Value.fromProxy(runner.manifestations.OBJECT);
    }
    resolve(resolver_: Program.IResolver): Type {
        return Type.OBJECT;
    }
}

class Node_TypeLiteral_Any extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Program.IResolver): Type {
        return Type.ANY;
    }
}

class Node_TypeNullable extends Node {
    constructor(location: Location, public type: Node) {
        super(location);
    }
    resolve(resolver: Program.IResolver): Type {
        return this.type.resolve(resolver).addPrimitive(Type.Primitive.Null);
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

class Node_TargetVariable extends Node {
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

class Node_TargetProperty extends Node {
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

class Node_TargetIndex extends Node {
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

class Node_ValueScalar extends Node {
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

class Node_ValueArray extends Node {
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

class Node_ValueObject extends Node {
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

class Node_ValueCall extends Node {
    constructor(location: Location, public children: Node[]) {
        super(location);
    }
    resolve(resolver_: Program.IResolver): Type {
        // TODO
        return Type.STRING;
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

class Node_ValueOperatorBinary extends Node {
    constructor(location: Location, public lhs: Node, public op: string, public rhs: Node) {
        super(location);
    }
    resolve(resolver: Program.IResolver): Type {
        this.unimplemented(resolver);
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

class Node_ValueOperatorTernary extends Node {
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

class Module implements Program.IModule {
    constructor(public readonly root: Node, public readonly source: string) {}
}

class Impl implements Program.IResolver {
    readonly EMPTY = new Node_Empty(new Location("(empty)", 0, 0));
    constructor(public modules: Module[], public logger: Logger) {}
    linkProgram(): Program {
        return new Program(this.modules);
    }
    linkModule(module: Compiler.IModule): Module {
        const root = this.linkNode(module.root);
        return new Module(root, root.location.source);
    }
    linkNode(node: Compiler.INode): Node {
        switch (node.kind) {
            case Compiler.Kind.Module:
                return new Node_Module(node.location, this.linkNodes(node.children));
            case Compiler.Kind.StmtBlock:
                return new Node_StmtBlock(node.location, this.linkNodes(node.children));
            case Compiler.Kind.StmtAssert:
                assert.ge(node.children.length, 1);
                return new Node_StmtAssert(node.location, node.value.asString(), this.linkNodes(node.children));
            case Compiler.Kind.StmtCall:
                assert.ge(node.children.length, 1);
                return new Node_StmtCall(node.location, this.linkNodes(node.children));
            case Compiler.Kind.StmtVariableDefine:
                assert.eq(node.children.length, 2);
                return this.linkStmtVariableDefine(node);
            case Compiler.Kind.StmtFunctionDefine:
                assert.eq(node.children.length, 3);
                return this.linkStmtFunctionDefine(node);
            case Compiler.Kind.StmtAssign:
                assert.eq(node.children.length, 2);
                return new Node_StmtAssign(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.StmtMutate:
                assert.eq(node.children.length, 2);
                return new Node_StmtMutate(node.location, node.value.asString(), this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.StmtNudge:
                assert.eq(node.children.length, 1);
                return new Node_StmtNudge(node.location, node.value.asString(), this.linkNode(node.children[0]));
            case Compiler.Kind.StmtForeach:
                assert.eq(node.children.length, 3);
                return this.linkStmtForeach(node);
            case Compiler.Kind.StmtForloop:
                assert.eq(node.children.length, 4);
                return this.linkStmtForloop(node);
            case Compiler.Kind.StmtIf:
                return this.linkStmtIf(node);
            case Compiler.Kind.StmtIfGuard:
                return this.linkStmtIfGuard(node);
            case Compiler.Kind.StmtReturn:
                return this.linkStmtReturn(node);
            case Compiler.Kind.StmtTry:
                return this.linkStmtTry(node);
            case Compiler.Kind.TargetVariable:
                assert.eq(node.children.length, 0);
                return new Node_TargetVariable(node.location, node.value.asString());
            case Compiler.Kind.TargetProperty:
                assert.eq(node.children.length, 2);
                return new Node_TargetProperty(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.TargetIndex:
                assert.eq(node.children.length, 2);
                return new Node_TargetIndex(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.TypeKeyword:
                assert.eq(node.children.length, 0);
                return this.linkTypeKeyword(node);
            case Compiler.Kind.TypeNullable:
                assert.eq(node.children.length, 1);
                return new Node_TypeNullable(node.location, this.linkNode(node.children[0]));
            case Compiler.Kind.ValueScalar:
                assert.eq(node.children.length, 0);
                return new Node_ValueScalar(node.location, node.value);
            case Compiler.Kind.ValueArray:
                return this.linkValueArray(node);
            case Compiler.Kind.ValueObject:
                return this.linkValueObject(node);
            case Compiler.Kind.ValueCall:
                assert.ge(node.children.length, 1);
                return new Node_ValueCall(node.location, this.linkNodes(node.children));
            case Compiler.Kind.ValueVariableGet:
                assert.eq(node.children.length, 0);
                return new Node_ValueVariableGet(node.location, node.value.asString());
            case Compiler.Kind.ValuePropertyGet:
                assert.ge(node.children.length, 2);
                return this.linkValuePropertyGet(node);
            case Compiler.Kind.ValueIndexGet:
                assert.ge(node.children.length, 2);
                return this.linkValueIndexGet(node);
            case Compiler.Kind.ValueOperatorBinary:
                assert.eq(node.children.length, 2);
                return new Node_ValueOperatorBinary(node.location, this.linkNode(node.children[0]), node.value.asString(), this.linkNode(node.children[1]));
            case Compiler.Kind.ValueOperatorTernary:
                assert.eq(node.children.length, 3);
                return new Node_ValueOperatorTernary(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]), this.linkNode(node.children[2]));
        }
        assert.fail("Unknown node kind in linkNode: {kind}", {kind:node.kind});
    }
    linkNodes(nodes: Compiler.INode[]): Node[] {
        return nodes.map(node => this.linkNode(node));
    }
    linkTypeKeyword(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.TypeKeyword);
        assert.eq(node.children.length, 0);
        const keyword = node.value.asString();
        switch (keyword) {
            case "void":
                return new Node_TypeLiteral_Void(node.location);
            case "bool":
                return new Node_TypeLiteral_Bool(node.location);
            case "int":
                return new Node_TypeLiteral_Int(node.location);
            case "float":
                return new Node_TypeLiteral_Float(node.location);
            case "string":
                return new Node_TypeLiteral_String(node.location);
            case "object":
                return new Node_TypeLiteral_Object(node.location);
            case "any":
                return new Node_TypeLiteral_Any(node.location);
        }
        assert.fail("Unknown keyword for Compiler.Kind.TypeKeyword in linkTypeKeyword: {keyword}", {keyword});
    }
    linkValueArray(node: Compiler.INode): Node {
        return new Node_ValueArray(node.location, node.children.map(child => {
            return new ArrayInitializer(this.linkNode(child), false);
        }));
    }
    linkValueObject(node: Compiler.INode): Node {
        return new Node_ValueObject(node.location, node.children.map(child => {
            assert.eq(child.kind, Compiler.Kind.ValueNamed);
            assert.eq(child.children.length, 1);
            return new ObjectInitializer(child.value.asString(), this.linkNode(child.children[0]), false);
        }));
    }
    linkValuePropertyGet(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.ValuePropertyGet);
        assert.eq(node.children.length, 2);
        assert.eq(node.children[1].kind, Compiler.Kind.ValueScalar);
        const property = node.children[1].value.asString();
        return new Node_ValuePropertyGet(node.location, this.linkNode(node.children[0]), property);
    }
    linkValueIndexGet(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.ValueIndexGet);
        assert.eq(node.children.length, 2);
        return new Node_ValueIndexGet(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]));
    }
    linkStmtVariableDefine(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.StmtVariableDefine);
        assert.eq(node.children.length, 2);
        let type: Type;
        let initializer: Node;
        if (node.children[0].kind === Compiler.Kind.TypeInfer) {
            initializer = this.linkNode(node.children[1]);
            type = initializer.resolve(this);
            if (node.children[0].value.getBool()) {
                // Allow 'var?'
                type.addPrimitive(Type.Primitive.Null);
            } else {
                // Disallow 'var?'
                type.removePrimitive(Type.Primitive.Null);
            }
        } else {
            type = this.linkNode(node.children[0]).resolve(this);
            initializer = this.linkNode(node.children[1]);
        }
        return new Node_StmtVariableDefine(initializer.location, node.value.asString(), type, initializer);
    }
    linkStmtFunctionDefine(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.StmtFunctionDefine);
        assert.eq(node.children.length, 3);
        const rettype = this.linkNode(node.children[0]).resolve(this);
        assert(node.children[1].kind === Compiler.Kind.FunctionParameters);
        const parameters = node.children[1].children.map(parameter => {
            assert.eq(parameter.kind, Compiler.Kind.FunctionParameter);
            assert.eq(parameter.children.length, 1);
            return new FunctionParameter(parameter.value.asString(), this.linkNode(parameter.children[0]).resolve(this));
        });
        const block = this.linkNode(node.children[2]);
        const signature = new FunctionSignature(node.value.asString(), node.location, rettype, parameters);
        return new Node_StmtFunctionDefine(node.location, signature, block);
    }
    linkStmtForeach(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.StmtForeach);
        assert.eq(node.children.length, 3);
        let type: Type;
        let expr: Node;
        if (node.children[0].kind === Compiler.Kind.TypeInfer) {
            expr = this.linkNode(node.children[1]);
            type = expr.resolve(this);
            if (node.children[0].value.getBool()) {
                // Allow 'var?'
                type.addPrimitive(Type.Primitive.Null);
            } else {
                // Disallow 'var?'
                type.removePrimitive(Type.Primitive.Null);
            }
        } else {
            type = this.linkNode(node.children[0]).resolve(this);
            expr = this.linkNode(node.children[1]);
        }
        const block = this.linkNode(node.children[2]);
        return new Node_StmtForeach(node.location, node.value.asString(), type, expr, block);
    }
    linkStmtForloop(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.StmtForloop);
        assert.eq(node.children.length, 4);
        const initialization = this.linkNode(node.children[0]);
        const condition = this.linkNode(node.children[1]);
        const advance = this.linkNode(node.children[2]);
        const block = this.linkNode(node.children[3]);
        return new Node_StmtForloop(node.location, initialization, condition, advance, block);
    }
    linkStmtIf(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.StmtIf);
        assert.ge(node.children.length, 2);
        const condition = this.linkNode(node.children[0]);
        const ifBlock = this.linkNode(node.children[1]);
        if (node.children.length === 2) {
            return new Node_StmtIf(node.location, condition, ifBlock, this.EMPTY);
        }
        assert.eq(node.children.length, 3);
        const elseBlock = this.linkNode(node.children[2]);
        return new Node_StmtIf(node.location, condition, ifBlock, elseBlock);
    }
    linkStmtIfGuard(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.StmtIfGuard);
        assert.ge(node.children.length, 3);
        const type = this.linkNode(node.children[0]).resolve(this);
        const initializer = this.linkNode(node.children[1]);
        const ifBlock = this.linkNode(node.children[2]);
        if (node.children.length === 3) {
            return new Node_StmtIfGuard(node.location, node.value.asString(), type, initializer, ifBlock, this.EMPTY);
        }
        assert.eq(node.children.length, 4);
        const elseBlock = this.linkNode(node.children[3]);
        return new Node_StmtIfGuard(node.location, node.value.asString(), type, initializer, ifBlock, elseBlock);
    }
    linkStmtReturn(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.StmtReturn);
        assert.eq(node.children.length, 1);
        const expr = this.linkNode(node.children[0]);
        return new Node_StmtReturn(node.location, expr);
    }
    linkStmtTry(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.StmtTry);
        assert.ge(node.children.length, 2);
        const hasFinally = node.value.asBoolean();
        const tryBlock = this.linkNode(node.children[0]);
        if (hasFinally) {
            const catchClauses = node.children.slice(1, -1).map(child => this.linkStmtCatch(child));
            const finallyClause = this.linkNode(node.children[node.children.length - 1]);
            return new Node_StmtTry(node.location, tryBlock, catchClauses, finallyClause);
        } else {
            const catchClauses = node.children.slice(1).map(child => this.linkStmtCatch(child));
            return new Node_StmtTry(node.location, tryBlock, catchClauses, this.EMPTY);
        }
    }
    linkStmtCatch(node: Compiler.INode): Node {
        assert(node.kind === Compiler.Kind.StmtCatch);
        assert.eq(node.children.length, 2);
        const type = this.linkNode(node.children[0]);
        const block = this.linkNode(node.children[1]);
        return new Node_StmtCatch(node.location, node.value.asString(), type, block);
    }
    resolveIdentifier(identifier_: string): Type {
        return Type.ANYQ; // TODO
    }
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
}

export class Linker {
    logger?: Logger;
    modules: Module[] = [];
    link(): Program {
        const impl = new Impl(this.modules, this.logger ?? new ConsoleLogger());
        return impl.linkProgram();
    }
    withLogger(logger: Logger): Linker {
        this.logger = logger;
        return this;
    }
    withModule(module: Compiler.IModule): Linker {
        const impl = new Impl(this.modules, this.logger ?? new ConsoleLogger());
        this.modules.push(impl.linkModule(module));
        return this;
    }
}

export class LinkerException extends Exception {
    constructor(message: string, parameters?: Message.Parameters) {
        super(LinkerException.name, Exception.Origin.Linker, message, parameters);
    }
}
