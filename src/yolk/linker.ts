import { assert } from "./assertion";
import { Compiler } from "./compiler";
import { BaseException, ExceptionParameters } from "./exception";
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
    abstract evaluate(runner: Program.Runner): Value;
    abstract entype(runner: Program.Runner): Type;
    abstract execute(runner: Program.Runner): void;
}

class Node_Module extends Node {
    constructor(public children: Node[]) {
        super();
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
    constructor(public name: string, public type: Node, public initializer: Node) {
        super();
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    entype(runner: Program.Runner): Type {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        runner.variableDefine(this.name, this.type.entype(runner), this.initializer.evaluate(runner));
    }
}

class Node_StmtCall extends Node {
    constructor(public children: Node[]) {
        super();
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    entype(runner: Program.Runner): Type {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        const text = this.children.slice(1).map(child => child.evaluate(runner).toString()).join("");
        runner.print(text);
    }
}

class Node_LiteralIdentifier extends Node {
    constructor(public identifier: string) {
        super();
    }
    evaluate(runner: Program.Runner): Value {
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
    constructor(public type: Type) {
        super();
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
    constructor(public value: Value) {
        super();
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
    constructor(public lhs: Node, public op: string, public rhs: Node) {
        super();
    }
    evaluate(runner: Program.Runner): Value {
        return evaluateBinaryOperator(this.lhs.evaluate(runner), this.op, this.rhs.evaluate(runner));
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
        return new Module(root, module.source);
    }
    linkNode(node: Compiler.Node): Node {
        switch (node.kind) {
            case Compiler.Kind.Module:
                return new Node_Module(this.linkNodes(node.children));
            case Compiler.Kind.StmtVariableDefine:
                assert.eq(node.children.length, 2);
                return new Node_StmtVariableDefine(node.value.getString(), this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.StmtCall:
                assert.ge(node.children.length, 1);
                return new Node_StmtCall(this.linkNodes(node.children));
            case Compiler.Kind.Identifier:
                assert.eq(node.children.length, 0);
                return new Node_LiteralIdentifier(node.value.getString());
            case Compiler.Kind.TypeKeyword:
                assert.eq(node.children.length, 0);
                switch (node.value.getString()) {
                    case "void":
                        return new Node_TypeLiteral(Type.VOID);
                    case "bool":
                        return new Node_TypeLiteral(Type.BOOL);
                    case "int":
                        return new Node_TypeLiteral(Type.INT);
                    case "float":
                        return new Node_TypeLiteral(Type.FLOAT);
                    case "string":
                        return new Node_TypeLiteral(Type.STRING);
                }
                assert.fail("Unknown keyword for Compiler.Kind.TypeKeywordnode in linkNode: {keyword}", {keyword:node.value.getString()});
                break;
            case Compiler.Kind.ValueLiteral:
                assert.eq(node.children.length, 0);
                return new Node_ValueLiteral(node.value);
            case Compiler.Kind.ValueOperatorBinary:
                assert.eq(node.children.length, 2);
                return new Node_ValueOperatorBinary(this.linkNode(node.children[0]), node.value.getString(), this.linkNode(node.children[1]));
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
            super("Exception", message, parameters);
        }
    }
}
