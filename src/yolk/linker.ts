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

abstract class Node implements Program.Node {
    constructor(public location: Program.Location) {}
    abstract evaluate(runner: Program.Runner): Value;
    abstract entype(runner: Program.Runner): Type;
    abstract execute(runner: Program.Runner): void;
}

class Node_Module extends Node {
    constructor(location: Program.Location, public children: Node[]) {
        super(location);
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    entype(runner: Program.Runner): Type {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        for (const child of this.children) {
            child.execute(runner);
        }
    }
}

class Node_StmtVariableDefine extends Node {
    constructor(location: Program.Location, public name: string, public type: Node, public initializer: Node) {
        super(location);
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    entype(runner: Program.Runner): Type {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        const type = this.type.entype(runner);
        const initializer = this.initializer.evaluate(runner);
        runner.location = this.initializer.location;
        runner.variableDefine(this.name, type, initializer);
    }
}

class Node_StmtCall extends Node {
    constructor(location: Program.Location, public children: Node[]) {
        super(location);
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    entype(runner: Program.Runner): Type {
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
    evaluate(runner: Program.Runner): Value {
        runner.location = this.location;
        return runner.variableGet(this.identifier);
    }
    entype(runner: Program.Runner): Type {
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
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    entype(runner_: Program.Runner): Type {
        return this.type;
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Node_ValueLiteral extends Node {
    constructor(location: Program.Location, public value: Value) {
        super(location);
    }
    evaluate(runner_: Program.Runner): Value {
        return this.value;
    }
    entype(runner: Program.Runner): Type {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Node_ValueOperatorBinary extends Node {
    constructor(location: Program.Location, public lhs: Node, public op: string, public rhs: Node) {
        super(location);
    }
    evaluate(runner: Program.Runner): Value {
        const lhs = this.lhs.evaluate(runner);
        const rhs = this.rhs.evaluate(runner);
        runner.location = this.location;
        return evaluateBinaryOperator(lhs, this.op, rhs);
    }
    entype(runner: Program.Runner): Type {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Module implements Program.Module {
    constructor(public readonly root: Program.Node, public readonly source: string) {}
}

class Impl extends Logger {
    constructor(public modules: Module[], public logger: Logger) {
        super();
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
                return new Node_StmtVariableDefine(node.location, node.value.getString(), this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.StmtCall:
                assert.ge(node.children.length, 1);
                return new Node_StmtCall(node.location, this.linkNodes(node.children));
            case Compiler.Kind.Identifier:
                assert.eq(node.children.length, 0);
                return new Node_LiteralIdentifier(node.location, node.value.getString());
            case Compiler.Kind.TypeKeyword:
                assert.eq(node.children.length, 0);
                switch (node.value.getString()) {
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
                assert.fail("Unknown keyword for Compiler.Kind.TypeKeywordnode in linkNode: {keyword}", {keyword:node.value.getString()});
                break;
            case Compiler.Kind.ValueLiteral:
                assert.eq(node.children.length, 0);
                return new Node_ValueLiteral(node.location, node.value);
            case Compiler.Kind.ValueOperatorBinary:
                assert.eq(node.children.length, 2);
                return new Node_ValueOperatorBinary(node.location, this.linkNode(node.children[0]), node.value.getString(), this.linkNode(node.children[1]));
        }
        assert.fail("Unknown node kind in linkNode: {kind}", {kind:node.kind});
    }
    linkNodes(nodes: Compiler.Node[]): Node[] {
        return nodes.map(node => this.linkNode(node));
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
