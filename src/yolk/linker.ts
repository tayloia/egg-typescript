import { assert } from "./assertion";
import { Compiler } from "./compiler";
import { BaseException, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
import { Program } from "./program";
import { Value } from "./value";

abstract class Node implements Program.Node {
    abstract evaluate(runner: Program.Runner): Value;
    abstract execute(runner: Program.Runner): void;
    evaluateBinaryOperator(lhs: Value, op: string, rhs: Value): Value {
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
        assert.fail("Unknown binary operator: '{op}'", {op,caller:this.evaluateBinaryOperator});
    }
}

class Node_Module extends Node {
    constructor(public children: Node[]) {
        super();
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

class Node_StmtCall extends Node {
    constructor(public callee: Node, public args: Node) {
        super();
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        const value = this.args.evaluate(runner);
        runner.print(value.toString()); // TODO
    }
}

class Node_LiteralIdentifier extends Node {
    constructor(public identifier: string) {
        super();
    }
    evaluate(runner: Program.Runner): Value {
        runner.unimplemented();
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
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Node_ValueOperatorBinary extends Node {
    constructor(public lhs: Node, public op: string, public rhs: Node) {
        super();
    }
    evaluate(runner: Program.Runner): Value {
        return this.evaluateBinaryOperator(this.lhs.evaluate(runner), this.op, this.rhs.evaluate(runner));
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
            case Compiler.Kind.StmtCall:
                assert.eq(node.children.length, 2);
                return new Node_StmtCall(this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.Identifier:
                assert.eq(node.children.length, 0);
                return new Node_LiteralIdentifier(node.value.getString());
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
