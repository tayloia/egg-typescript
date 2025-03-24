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

class Resolver extends Logger {
    constructor(public logger: Logger) {
        super();
    }
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
    resolveIdentifier(identifier_: string): Type {
        // TODO
        return Type.STRING;
    }
    unimplemented(): never {
        assert.fail("Unimplemented: {caller}", {caller:this.unimplemented});
    }
}

class KeyValue {
    constructor(public readonly key: Value, public readonly value: Value) {}
}

type Outcome = Exception | void;

abstract class Node {
    constructor(public location: Location) {}
    abstract resolve(resolver: Resolver): Type;
    abstract evaluate(runner: Program.Runner): Value;
    abstract execute(runner: Program.Runner): Outcome;
    abstract modify(runner: Program.Runner, op: string, expr: Node): Value;
    keyvalue(runner: Program.Runner): KeyValue {
        return new KeyValue(Value.VOID, this.evaluate(runner));
    }
    raise(message: string, parameters?: Message.Parameters): never {
        throw new RuntimeException(message, { ...parameters, location: this.location });
    }
    unimplemented(that: Program.Runner | Resolver): never {
        if (that instanceof Program.Runner) {
            that.location = this.location;
        }
        assert.fail("Unimplemented: {caller}", {caller:this.unimplemented});
    }
}

class Node_Module extends Node {
    constructor(location: Location, public children: Node[]) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        runner.location = this.location;
        for (const child of this.children) {
            child.execute(runner);
        }
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtBlock extends Node {
    constructor(location: Location, public children: Node[]) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        runner.location = this.location;
        for (const child of this.children) {
            child.execute(runner);
        }
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtAssert extends Node {
    constructor(location: Location, public op: string, public children: Node[]) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        let lhs, rhs, passed;
        switch (this.children.length) {
            case 1:
                if (this.op === "") {
                    passed = this.children[0].evaluate(runner).asBoolean();
                    if (!passed) {
                        throw new RuntimeException("Assertion is untrue", {location: this.location});
                    }
                } else {
                    rhs = this.children[0].evaluate(runner);
                    passed = Value.binary(rhs, this.op, rhs).unwrap().asBoolean();
                    if (!passed) {
                        throw new RuntimeException("Assertion is untrue: {op}{rhs}", {location: this.location, op: this.op, rhs});
                    }
                }
                break;
            case 2:
                lhs = this.children[0].evaluate(runner);
                rhs = this.children[1].evaluate(runner);
                passed = Value.binary(lhs, this.op, rhs).unwrap().asBoolean();
                if (!passed) {
                    throw new RuntimeException("Assertion is untrue: {lhs} {op} {rhs}", {location: this.location, lhs, op: this.op, rhs});
                }
                break;
            default:
                assert.fail("Invalid number of assertion nodes: {nodes}", {nodes:this.children.length});
        }
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtCall extends Node {
    constructor(location: Location, public children: Node[]) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        const callee = this.children[0].evaluate(runner);
        const args = new FunctionArguments();
        for (let index = 1; index < this.children.length; ++index) {
            args.add(this.children[index].evaluate(runner));
        }
        runner.location = this.location;
        callee.invoke(runner, args).unwrap();
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtVariableDefine extends Node {
    constructor(location: Location, public identifier: string, public type: Type, public initializer: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        const initializer = this.initializer.evaluate(runner);
        runner.location = this.initializer.location;
        runner.symbolAdd(this.identifier, SymbolFlavour.Variable, this.type, initializer);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtFunctionDefine extends Node {
    constructor(location: Location, public signature: FunctionSignature, public block: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        const definition = new FunctionDefinition(this.signature, (runner, args_) => {
            const outcome = this.block.execute(runner);
            return Value.VOID;
        });
        runner.location = this.location;
        runner.symbolAdd(this.signature.name, SymbolFlavour.Function, definition.type, Value.fromVanillaFunction(definition));
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtAssign extends Node {
    constructor(location: Location, public target: Node, public expr: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        runner.location = this.location;
        this.target.modify(runner, "", this.expr);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtMutate extends Node {
    constructor(location: Location, public op: string, public target: Node, public expr: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        runner.location = this.location;
        this.target.modify(runner, this.op, this.expr);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtNudge extends Node {
    constructor(location: Location, public op: string, public target: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        runner.location = this.location;
        this.target.modify(runner, this.op, this.target);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtForeach extends Node {
    constructor(location: Location, public identifier: string, public type: Type, public expr: Node, public block: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        const expr = this.expr.evaluate(runner);
        assert.eq(expr.kind, Value.Kind.String);
        runner.location = this.location;
        runner.symbolAdd(this.identifier, SymbolFlavour.Variable, this.type, Value.VOID);
        const unicode = expr.getUnicode();
        for (let index = BigInt(0); index < unicode.length; ++index) {
            runner.location = this.location;
            runner.symbolSet(this.identifier, Value.fromString(unicode.at(index)));
            this.block.execute(runner);
        }
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtForloop extends Node {
    constructor(location: Location, public initialization: Node, public condition: Node, public advance: Node, public block: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        this.initialization.execute(runner);
        for (;;) {
            const condition = this.condition.evaluate(runner);
            if (!condition.asBoolean()) {
                break;
            }
            this.block.execute(runner);
            this.advance.execute(runner);
        }
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtIf extends Node {
    constructor(location: Location, public condition: Node, public block: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        const condition = this.condition.evaluate(runner);
        if (condition.asBoolean()) {
            this.block.execute(runner);
        }
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtReturn extends Node {
    constructor(location: Location, public expr: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtTry extends Node {
    constructor(location: Location, public tryBlock: Node, public catchClauses: Node[], public finallyClause?: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        this.tryBlock.execute(runner);
        if (this.finallyClause) {
            this.finallyClause.execute(runner);
        }
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_StmtCatch extends Node {
    constructor(location: Location, public identifier: string, public type: Node, public block: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_ValueVariableGet extends Node {
    constructor(location: Location, public identifier: string) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        return resolver.resolveIdentifier(this.identifier);
    }
    evaluate(runner: Program.Runner): Value {
        runner.location = this.location;
        return runner.symbolGet(this.identifier);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_ValuePropertyGet extends Node {
    constructor(location: Location, public instance: Node, public property: string) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        const value = this.instance.evaluate(runner);
        runner.location = this.location;
        if (value.kind === Value.Kind.String) {
            const unicode = value.getUnicode();
            if (this.property === "length") {
                return Value.fromInt(unicode.length);
            }
            const proxy = Builtins.String.queryProxy(unicode, this.property);
            if (proxy) {
                return Value.fromProxy(proxy);
            }
            this.raise("Unknown property for 'string': '{property}'", {property: this.property});
        }
        if (value.kind === Value.Kind.Proxy) {
            return value.getProxy().getProperty(this.property).unwrap(this.location);
        }
        assert.fail(`Cannot get property for ${value.kind}`);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_ValueIndexGet extends Node {
    constructor(location: Location, public instance: Node, public index: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        const value = this.instance.evaluate(runner);
        if (value.kind === Value.Kind.String) {
            const index = this.index.evaluate(runner).getInt();
            const unicode = value.getUnicode();
            const char = unicode.at(index.toBigint());
            if (!char) {
                this.raise("String index {index} is out of range for a string of length {length}", {index, length: unicode.length});
            }
            return Value.fromString(char);
        }
        if (value.kind === Value.Kind.Proxy) {
            const proxy = value.getProxy();
            const index = this.index.evaluate(runner);
            return proxy.getIndex(index).unwrap(this.index.location);
        }
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

abstract class Node_TypeLiteral extends Node {
    constructor(location: Location) {
        super(location);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_TypeLiteral_Void extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.VOID;
    }
}

class Node_TypeLiteral_Bool extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.BOOL;
    }
}

class Node_TypeLiteral_Int extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.INT;
    }
}

class Node_TypeLiteral_Float extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.FLOAT;
    }
}

class Node_TypeLiteral_String extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    evaluate(runner: Program.Runner): Value {
        return Value.fromProxy(runner.manifestations.STRING);
    }
    resolve(resolver_: Resolver): Type {
        return Type.STRING;
    }
}

class Node_TypeLiteral_Object extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    evaluate(runner: Program.Runner): Value {
        return Value.fromProxy(runner.manifestations.OBJECT);
    }
    resolve(resolver_: Resolver): Type {
        return Type.OBJECT;
    }
}

class Node_TypeLiteral_Any extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.ANY;
    }
}

class Node_TargetVariable extends Node {
    constructor(location: Location, public identifier: string) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op: string, expr: Node): Value {
        if (op === "") {
            runner.symbolSet(this.identifier, expr.evaluate(runner));
            return Value.VOID;
        }
        return runner.symbolMut(this.identifier, op, () => expr.evaluate(runner));
    }
}

class Node_TargetProperty extends Node {
    constructor(location: Location, public instance: Node, public property: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op: string, expr: Node): Value {
        const location = runner.location;
        const instance = this.instance.evaluate(runner);
        if (instance.kind === Value.Kind.String) {
            const property = this.property.evaluate(runner).asString();
            throw new RuntimeException("Values of type 'string' do not support modification of property '{property}'", { property, location });
        }
        if (instance.kind === Value.Kind.Proxy) {
            const property = this.property.evaluate(runner).asString();
            if (op === "") {
                const value = expr.evaluate(runner);
                return instance.getProxy().setProperty(property, value).unwrap(location);
            }
            return instance.getProxy().mutProperty(property, op, () => expr.evaluate(runner)).unwrap(location);
        }
        this.unimplemented(runner);
    }
}

class Node_TargetIndex extends Node {
    constructor(location: Location, public instance: Node, public index: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op: string, expr: Node): Value {
        const instance = this.instance.evaluate(runner);
        if (instance.kind === Value.Kind.Proxy) {
            const index = this.index.evaluate(runner);
            runner.location = this.location;
            if (op === "") {
                const value = expr.evaluate(runner);
                return instance.getProxy().setIndex(index, value).unwrap(this.location);
            }
            return instance.getProxy().mutIndex(index, op, () => expr.evaluate(runner)).unwrap(this.location);
        }
        this.unimplemented(runner);
    }
}

class Node_ValueScalar extends Node {
    constructor(location: Location, private value: Value) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
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
    evaluate(runner_: Program.Runner): Value {
        return this.value;
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_ValueArray extends Node {
    constructor(location: Location, private nodes: Node[]) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.OBJECT;
    }
    evaluate(runner: Program.Runner): Value {
        const elements = new Array<Value>();
        for (const node of this.nodes) {
            const kv = node.keyvalue(runner);
            assert(kv.key.isVoid());
            elements.push(kv.value);
        }
        return Value.fromVanillaArray(elements);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_ValueObject extends Node {
    constructor(location: Location, private nodes: Node[]) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.OBJECT;
    }
    evaluate(runner: Program.Runner): Value {
        const elements = new ValueMap();
        for (const node of this.nodes) {
            const kv = node.keyvalue(runner);
            assert(!kv.key.isVoid());
            elements.set(kv.key, kv.value);
        }
        return Value.fromVanillaObject(elements);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_ValueCall extends Node {
    constructor(location: Location, public children: Node[]) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        // TODO
        return Type.STRING;
    }
    evaluate(runner: Program.Runner): Value {
        runner.location = this.children[0].location;
        const callee = this.children[0].evaluate(runner);
        const args = new FunctionArguments();
        for (let arg = 1; arg < this.children.length; ++arg) {
            args.add(this.children[arg].evaluate(runner));
        }
        runner.location = this.location;
        return callee.invoke(runner, args).unwrap();
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Node_ValueOperatorBinary extends Node {
    constructor(location: Location, public lhs: Node, public op: string, public rhs: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        const lhs = this.lhs.evaluate(runner);
        const rhs = this.rhs.evaluate(runner);
        runner.location = this.location;
        return Value.binary(lhs, this.op, rhs).unwrap(this.location);
    }
    execute(runner: Program.Runner): Outcome {
        this.unimplemented(runner);
    }
    modify(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
}

class Module implements Program.Module {
    constructor(public readonly root: Node, public readonly source: string) {}
}

class Impl extends Logger {
    resolver: Resolver;
    constructor(public modules: Module[], public logger: Logger) {
        super();
        this.resolver = new Resolver(logger);
    }
    linkProgram(): Program {
        return new Program(this.modules);
    }
    linkModule(module: Compiler.Module): Module {
        const root = this.linkNode(module.root);
        return new Module(root, root.location.source);
    }
    linkNode(node: Compiler.Node): Node {
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
            case Compiler.Kind.ValueScalar:
                assert.eq(node.children.length, 0);
                return new Node_ValueScalar(node.location, node.value);
            case Compiler.Kind.ValueArray:
                return new Node_ValueArray(node.location, this.linkNodes(node.children));
            case Compiler.Kind.ValueObject:
                return new Node_ValueObject(node.location, this.linkNodes(node.children));
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
        }
        assert.fail("Unknown node kind in linkNode: {kind}", {kind:node.kind});
    }
    linkNodes(nodes: Compiler.Node[]): Node[] {
        return nodes.map(node => this.linkNode(node));
    }
    linkTypeKeyword(node: Compiler.Node): Node {
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
    linkValuePropertyGet(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.ValuePropertyGet);
        assert.eq(node.children.length, 2);
        assert.eq(node.children[1].kind, Compiler.Kind.ValueScalar);
        const property = node.children[1].value.asString();
        return new Node_ValuePropertyGet(node.location, this.linkNode(node.children[0]), property);
    }
    linkValueIndexGet(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.ValueIndexGet);
        assert.eq(node.children.length, 2);
        return new Node_ValueIndexGet(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]));
    }
    linkStmtVariableDefine(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.StmtVariableDefine);
        assert.eq(node.children.length, 2);
        let type: Type;
        let initializer: Node;
        if (node.children[0].kind === Compiler.Kind.TypeInfer) {
            initializer = this.linkNode(node.children[1]);
            type = initializer.resolve(this.resolver);
            if (node.children[0].value.getBool()) {
                // Allow 'var?'
                type.addPrimitive(Type.Primitive.Null);
            } else {
                // Disallow 'var?'
                type.removePrimitive(Type.Primitive.Null);
            }
        } else {
            type = this.linkNode(node.children[0]).resolve(this.resolver);
            initializer = this.linkNode(node.children[1]);
        }
        return new Node_StmtVariableDefine(node.location, node.value.asString(), type, initializer);
    }
    linkStmtFunctionDefine(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.StmtFunctionDefine);
        assert.eq(node.children.length, 3);
        const rettype = this.linkNode(node.children[0]).resolve(this.resolver);
        assert(node.children[1].kind === Compiler.Kind.FunctionParameters);
        const parameters = node.children[1].children.map(parameter => {
            assert.eq(parameter.kind, Compiler.Kind.FunctionParameter);
            return new FunctionParameter(parameter.value.asString(), this.linkNode(node.children[0]).resolve(this.resolver));
        });
        const block = this.linkNode(node.children[2]);
        const signature = new FunctionSignature(node.value.asString(), node.location, rettype, parameters);
        return new Node_StmtFunctionDefine(node.location, signature, block);
    }
    linkStmtForeach(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.StmtForeach);
        assert.eq(node.children.length, 3);
        let type: Type;
        let expr: Node;
        if (node.children[0].kind === Compiler.Kind.TypeInfer) {
            expr = this.linkNode(node.children[1]);
            type = expr.resolve(this.resolver);
            if (node.children[0].value.getBool()) {
                // Allow 'var?'
                type.addPrimitive(Type.Primitive.Null);
            } else {
                // Disallow 'var?'
                type.removePrimitive(Type.Primitive.Null);
            }
        } else {
            type = this.linkNode(node.children[0]).resolve(this.resolver);
            expr = this.linkNode(node.children[1]);
        }
        const block = this.linkNode(node.children[2]);
        return new Node_StmtForeach(node.location, node.value.asString(), type, expr, block);
    }
    linkStmtForloop(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.StmtForloop);
        assert.eq(node.children.length, 4);
        const initialization = this.linkNode(node.children[0]);
        const condition = this.linkNode(node.children[1]);
        const advance = this.linkNode(node.children[2]);
        const block = this.linkNode(node.children[3]);
        return new Node_StmtForloop(node.location, initialization, condition, advance, block);
    }
    linkStmtIf(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.StmtIf);
        assert.eq(node.children.length, 2);
        const condition = this.linkNode(node.children[0]);
        const block = this.linkNode(node.children[1]);
        return new Node_StmtIf(node.location, condition, block);
    }
    linkStmtReturn(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.StmtReturn);
        assert.eq(node.children.length, 1);
        const expr = this.linkNode(node.children[0]);
        return new Node_StmtReturn(node.location, expr);
    }
    linkStmtTry(node: Compiler.Node): Node {
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
            return new Node_StmtTry(node.location, tryBlock, catchClauses);
        }
    }
    linkStmtCatch(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.StmtCatch);
        assert.eq(node.children.length, 2);
        const type = this.linkNode(node.children[0]);
        const block = this.linkNode(node.children[1]);
        return new Node_StmtCatch(node.location, node.value.asString(), type, block);
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
    withModule(module: Compiler.Module): Linker {
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
