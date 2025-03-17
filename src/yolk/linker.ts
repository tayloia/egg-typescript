import { assert } from "./assertion";
import { Compiler } from "./compiler";
import { BaseException, ExceptionOrigin, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
import { Program } from "./program";
import { Type } from "./type";
import { Value } from "./value";

function evaluateBinaryOperator(lhs: Value, op: string, rhs: Value): Value {
    switch (op) {
        case "+":
            if (lhs.kind === Value.Kind.Float || rhs.kind === Value.Kind.Float) {
                return Value.fromFloat(lhs.asFloat() + rhs.asFloat());
            }
            return Value.fromInt(lhs.getInt() + rhs.getInt());
        case "-":
            if (lhs.kind === Value.Kind.Float || rhs.kind === Value.Kind.Float) {
                return Value.fromFloat(lhs.asFloat() - rhs.asFloat());
            }
            return Value.fromInt(lhs.getInt() - rhs.getInt());
        case "*":
            if (lhs.kind === Value.Kind.Float || rhs.kind === Value.Kind.Float) {
                return Value.fromFloat(lhs.asFloat() * rhs.asFloat());
            }
            return Value.fromInt(lhs.getInt() * rhs.getInt());
        case "/":
            if (lhs.kind === Value.Kind.Float || rhs.kind === Value.Kind.Float) {
                return Value.fromFloat(lhs.asFloat() / rhs.asFloat());
            }
            return Value.fromInt(lhs.getInt() / rhs.getInt());
    }
    assert.fail("Unknown binary operator: '{op}'", {op, caller:evaluateBinaryOperator});
}

class Resolver extends Logger {
    constructor(public logger: Logger) {
        super();
    }
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
    unimplemented(): never {
        assert.fail("Unimplemented: {caller}", {caller:this.unimplemented});
    }
}

abstract class Node {
    constructor(public location: Program.Location) {}
    abstract resolve(resolver: Resolver): Type;
    abstract evaluate(runner: Program.Runner): Value;
    abstract execute(runner: Program.Runner): void;
}

class Node_Module extends Node {
    constructor(location: Program.Location, public children: Node[]) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        resolver.unimplemented();
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        for (const child of this.children) {
            child.execute(runner);
        }
    }
}

class Node_StmtVariableDefine extends Node {
    constructor(location: Program.Location, public name: string, public type: Type, public initializer: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        resolver.unimplemented();
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        const initializer = this.initializer.evaluate(runner);
        runner.location = this.initializer.location;
        runner.variableDefine(this.name, this.type, initializer);
    }
}

class Node_StmtCall extends Node {
    constructor(location: Program.Location, public children: Node[]) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        resolver.unimplemented();
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        const text = this.children.slice(1).map(child => child.evaluate(runner).toString()).join("");
        runner.location = this.location;
        runner.print(text);
    }
}

class Node_LiteralIdentifier extends Node {
    constructor(location: Program.Location, public identifier: string) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        resolver.unimplemented();
    }
    evaluate(runner: Program.Runner): Value {
        runner.location = this.location;
        return runner.variableGet(this.identifier);
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Node_ValuePropertyGet extends Node {
    constructor(location: Program.Location, public instance: Node, public property: string) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        resolver.unimplemented();
    }
    evaluate(runner: Program.Runner): Value {
        const value = this.instance.evaluate(runner);
        if (value.kind === Value.Kind.String && this.property === "length") {
            return Value.fromInt(value.getString().length);
        }
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Node_TypeLiteral extends Node {
    constructor(location: Program.Location, public type: Type) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        return this.type;
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Node_ValueLiteral extends Node {
    constructor(location: Program.Location, public value: Value) {
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
        resolver.unimplemented();
    }
    evaluate(runner_: Program.Runner): Value {
        return this.value;
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Node_ValueCall extends Node {
    constructor(location: Program.Location, public children: Node[]) {
        super(location);
    }
    resolve(resolver_: Resolver): Type {
        // TODO
        return Type.STRING;
    }
    evaluate(runner: Program.Runner): Value {
        const text = this.children.slice(1).map(child => child.evaluate(runner).toString()).join("");
        runner.location = this.location;
        // TODO
        return Value.fromString(text);
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Node_ValueOperatorBinary extends Node {
    constructor(location: Program.Location, public lhs: Node, public op: string, public rhs: Node) {
        super(location);
    }
    resolve(resolver: Resolver): Type {
        resolver.unimplemented();
    }
    evaluate(runner: Program.Runner): Value {
        const lhs = this.lhs.evaluate(runner);
        const rhs = this.rhs.evaluate(runner);
        runner.location = this.location;
        return evaluateBinaryOperator(lhs, this.op, rhs);
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
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
            case Compiler.Kind.StmtVariableDefine:
                assert.eq(node.children.length, 2);
                return this.linkStmtVariableDefine(node);
            case Compiler.Kind.StmtCall:
                assert.ge(node.children.length, 1);
                return new Node_StmtCall(node.location, this.linkNodes(node.children));
            case Compiler.Kind.Identifier:
                assert.eq(node.children.length, 0);
                return new Node_LiteralIdentifier(node.location, node.value.getString());
            case Compiler.Kind.TypeKeyword:
                assert.eq(node.children.length, 0);
                return this.linkTypeKeyword(node);
            case Compiler.Kind.ValueLiteral:
                assert.eq(node.children.length, 0);
                return new Node_ValueLiteral(node.location, node.value);
            case Compiler.Kind.ValueCall:
                assert.ge(node.children.length, 1);
                return new Node_ValueCall(node.location, this.linkNodes(node.children));
            case Compiler.Kind.ValuePropertyGet:
                assert.ge(node.children.length, 2);
                return this.linkValuePropertyGet(node);
            case Compiler.Kind.ValueOperatorBinary:
                assert.eq(node.children.length, 2);
                return new Node_ValueOperatorBinary(node.location, this.linkNode(node.children[0]), node.value.getString(), this.linkNode(node.children[1]));
        }
        assert.fail("Unknown node kind in linkNode: {kind}", {kind:node.kind});
    }
    linkNodes(nodes: Compiler.Node[]): Node[] {
        return nodes.map(node => this.linkNode(node));
    }
    linkTypeKeyword(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.TypeKeyword);
        assert.eq(node.children.length, 0);
        const keyword = node.value.getString();
        switch (keyword) {
            case "void":
                return new Node_TypeLiteral(node.location, Type.VOID);
            case "bool":
                return new Node_TypeLiteral(node.location, Type.BOOL);
            case "int":
                return new Node_TypeLiteral(node.location, Type.INT);
            case "float":
                return new Node_TypeLiteral(node.location, Type.FLOAT);
            case "string":
                return new Node_TypeLiteral(node.location, Type.STRING);
        }
        assert.fail("Unknown keyword for Compiler.Kind.TypeKeywordnode in linkTypeKeyword: {keyword}", {keyword});
    }
    linkValuePropertyGet(node: Compiler.Node): Node {
        assert(node.kind === Compiler.Kind.ValuePropertyGet);
        assert.eq(node.children.length, 2);
        assert.eq(node.children[1].kind, Compiler.Kind.Identifier);
        const property = node.children[1].value.getString();
        return new Node_ValuePropertyGet(node.location, this.linkNode(node.children[0]), property);
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
        return new Node_StmtVariableDefine(node.location, node.value.getString(), type, initializer);
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

export namespace Linker {
    export class Exception extends BaseException {
        constructor(message: string, parameters?: ExceptionParameters) {
            super("LinkerException", ExceptionOrigin.Linker, message, parameters);
        }
    }
}
