import { assert } from "./assertion";
import { Compiler } from "./compiler";
import { BaseException, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
import { Program } from "./program";

abstract class Node implements Program.Node {
    abstract evaluate(runner: Program.Runner): unknown;
    abstract execute(runner: Program.Runner): void;
}

class Node_Module extends Node {
    constructor(public children: Node[]) {
        super();
    }
    evaluate(runner: Program.Runner): unknown {
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
    evaluate(runner: Program.Runner): unknown {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        const text = this.args.evaluate(runner);
        runner.print(text as string); // TODO
    }
}

class Node_LiteralIdentifier extends Node {
    constructor(public identifier: string) {
        super();
    }
    evaluate(runner: Program.Runner): unknown {
        runner.unimplemented();
    }
    execute(runner: Program.Runner): void {
        runner.unimplemented();
    }
}

class Node_LiteralString extends Node {
    constructor(public value: string) {
        super();
    }
    evaluate(runner_: Program.Runner): unknown {
        return this.value;
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
            case Compiler.Kind.LiteralIdentifier:
                assert.eq(node.children.length, 0);
                return new Node_LiteralIdentifier(node.value as string);
            case Compiler.Kind.LiteralString:
                assert.eq(node.children.length, 0);
                return new Node_LiteralString(node.value as string);
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
