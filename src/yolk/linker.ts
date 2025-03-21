import { assert } from "./assertion";
import { Builtins } from "./builtins";
import { Compiler } from "./compiler";
import { Exception, RuntimeException } from "./exception";
import { Location } from "./location";
import { ConsoleLogger, Logger } from "./logger";
import { Message } from "./message";
import { Program } from "./program";
import { ProxyPredicateBinary } from "./proxy";
import { Type } from "./type";
import { Value } from "./value";

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

abstract class Node {
    constructor(public location: Location) {}
    abstract resolve(resolver: Resolver): Type;
    abstract evaluate(runner: Program.Runner): Value;
    abstract execute(runner: Program.Runner): void;
    abstract callsite(runner: Program.Runner): Program.Callsite;
    abstract mutate(runner: Program.Runner, op: string, expr: Node): void;
    predicate(runner: Program.Runner): Value {
        return this.evaluate(runner);
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
    execute(runner: Program.Runner): void {
        runner.location = this.location;
        for (const child of this.children) {
            child.execute(runner);
        }
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        runner.location = this.location;
        for (const child of this.children) {
            child.execute(runner);
        }
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        const callsite = this.children[0].callsite(runner);
        const args = new Program.Arguments();
        for (let index = 1; index < this.children.length; ++index) {
            args.add(this.children[index].evaluate(runner));
        }
        runner.location = this.location;
        callsite(runner, args);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        const initializer = this.initializer.evaluate(runner);
        runner.location = this.initializer.location;
        runner.variableDefine(this.identifier, this.type, initializer);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        runner.location = this.location;
        this.target.mutate(runner, "=", this.expr);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        runner.location = this.location;
        this.target.mutate(runner, this.op, this.expr);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        runner.location = this.location;
        this.target.mutate(runner, this.op, this.target);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        const expr = this.expr.evaluate(runner);
        assert.eq(expr.kind, Value.Kind.String);
        runner.location = this.location;
        runner.variableDeclare(this.identifier, this.type);
        const unicode = expr.getUnicode();
        for (let index = BigInt(0); index < unicode.length; ++index) {
            runner.location = this.location;
            runner.variableSet(this.identifier, Value.fromString(unicode.at(index)));
            this.block.execute(runner);
        }
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
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
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
        return runner.variableGet(this.identifier);
    }
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        if (this.identifier === "assert") {
            return (runner_, args) => {
                const proxy = args.arguments[0].getProxy().toUnderlying() as {
                    value: Value;
                    lhs: Value;
                    op: string;
                    rhs: Value;
                    location: Location;
                };
                if (!proxy.value.asBoolean()) {
                    throw new RuntimeException("Assertion is untrue: {lhs} {op} {rhs}", proxy);
                }
                return Value.VOID;
            };
        }
        if (this.identifier === "print") {
            return (runner, args) => {
                const text = args.arguments.map(arg => arg.toString()).join("");
                runner.print(text);
                return Value.VOID;
            };
        }
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
        if (value.kind === Value.Kind.String && this.property === "length") {
            return Value.fromInt(value.getUnicode().length);
        }
        if (value.kind === Value.Kind.Proxy) {
            return value.getProxy().getProperty(this.property).unwrap(this.location);
        }
        this.unimplemented(runner);
    }
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        const instance = this.instance.evaluate(runner);
        runner.location = this.location;
        if (instance.kind === Value.Kind.String) {
            return Builtins.String.queryMethod(instance.getUnicode(), this.property)
                ?? this.raise("Unknown builtin property for 'string': '{method}()'", {method:this.property});
        }
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
}

class Node_TypeLiteral_Bool extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.BOOL;
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
}

class Node_TypeLiteral_Int extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.INT;
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
}

class Node_TypeLiteral_Float extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.FLOAT;
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
}

class Node_TypeLiteral_String extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.STRING;
    }
    callsite(runner_: Program.Runner): Program.Callsite {
        return Builtins.String.concat;
    }
}

class Node_TypeLiteral_Object extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.OBJECT;
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
}

class Node_TypeLiteral_Any extends Node_TypeLiteral {
    constructor(location: Location) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return Type.ANY;
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
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
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op: string, expr: Node): Value {
        return runner.variableMut(this.identifier, op, () => expr.evaluate(runner));
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
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op: string, expr: Node): Value {
        const location = runner.location;
        const instance = this.instance.evaluate(runner);
        if (instance.kind === Value.Kind.String) {
            const property = this.property.evaluate(runner).asString();
            throw new RuntimeException("Values of type 'string' do not support modification of property '{property}'", { property, location });
        }
        if (instance.kind === Value.Kind.Proxy) {
            const property = this.property.evaluate(runner).asString();
            if (op === "=") {
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
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op: string, expr: Node): Value {
        const instance = this.instance.evaluate(runner);
        if (instance.kind === Value.Kind.Proxy) {
            const index = this.index.evaluate(runner);
            runner.location = this.location;
            if (op === "=") {
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
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
        const values = this.nodes.map(node => node.evaluate(runner));
        return Value.fromArray(values);
    }
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
        const callsite = this.children[0].callsite(runner);
        const args = new Program.Arguments();
        for (let arg = 1; arg < this.children.length; ++arg) {
            args.add(this.children[arg].evaluate(runner));
        }
        runner.location = this.location;
        return callsite(runner, args);
    }
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
        this.unimplemented(runner);
    }
    predicate(runner: Program.Runner): Value {
        const lhs = this.lhs.evaluate(runner);
        const rhs = this.rhs.evaluate(runner);
        runner.location = this.location;
        const value = Value.binary(lhs, this.op, rhs).unwrap(this.location);
        return Value.fromProxy(new ProxyPredicateBinary(value, lhs, this.op, rhs, this.location));
    }
}

class Node_ValuePredicate extends Node {
    constructor(location: Location, public child: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        this.unimplemented(resolver);
    }
    evaluate(runner: Program.Runner): Value {
        return this.child.predicate(runner);
    }
    execute(runner: Program.Runner): void {
        this.unimplemented(runner);
    }
    callsite(runner: Program.Runner): Program.Callsite {
        this.unimplemented(runner);
    }
    mutate(runner: Program.Runner, op_: string, expr_: Node): Value {
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
            case Compiler.Kind.StmtCall:
                assert.ge(node.children.length, 1);
                return new Node_StmtCall(node.location, this.linkNodes(node.children));
            case Compiler.Kind.StmtVariableDefine:
                assert.eq(node.children.length, 2);
                return this.linkStmtVariableDefine(node);
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
            case Compiler.Kind.ValuePredicate:
                assert.eq(node.children.length, 1);
                return new Node_ValuePredicate(node.location, this.linkNode(node.children[0]));
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
