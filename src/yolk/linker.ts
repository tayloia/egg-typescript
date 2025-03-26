import { assert } from "./assertion";
import { Builtins } from "./builtins";
import { Compiler } from "./compiler";
import { Exception } from "./exception";
import { FunctionParameter, FunctionSignature } from "./function";
import { Location } from "./location";
import { ConsoleLogger, Logger } from "./logger";
import { Message } from "./message";
import { Program } from "./program";
import { Runtime } from "./runtime";
import { SymbolFlavour, SymbolTable } from "./symboltable";
import { Type } from "./type";
import { Value } from "./value";

class Module implements Program.IModule {
    constructor(public readonly root: Program.INode, public readonly source: string) {}
}

class Impl implements Program.IResolver {
    static readonly EMPTY = new Runtime.Node_Empty(new Location("(empty)", 0, 0));
    constructor(public modules: Module[], public logger: Logger) {
        this.symbols = new SymbolTable();
        this.symbols.builtin(new Builtins.Print());
    }
    symbols: SymbolTable;
    linkProgram(): Program {
        return new Program(this.modules);
    }
    linkModule(module: Compiler.IModule): Module {
        const root = this.linkNode(module.root);
        return new Module(root, root.location.source);
    }
    linkNode(node: Compiler.INode): Runtime.Node {
        switch (node.kind) {
            case Compiler.Kind.Module:
                return new Runtime.Node_Module(node.location, this.linkNodes(node.children));
            case Compiler.Kind.StmtBlock:
                return new Runtime.Node_StmtBlock(node.location, this.linkNodes(node.children));
            case Compiler.Kind.StmtAssert:
                assert.ge(node.children.length, 1);
                return new Runtime.Node_StmtAssert(node.location, node.value.asString(), this.linkNodes(node.children));
            case Compiler.Kind.StmtCall:
                assert.ge(node.children.length, 1);
                return new Runtime.Node_StmtCall(node.location, this.linkNodes(node.children));
            case Compiler.Kind.StmtVariableDefine:
                assert.eq(node.children.length, 2);
                return this.linkStmtVariableDefine(node);
            case Compiler.Kind.StmtFunctionDefine:
                assert.eq(node.children.length, 3);
                return this.linkStmtFunctionDefine(node);
            case Compiler.Kind.StmtAssign:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_StmtAssign(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.StmtMutate:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_StmtMutate(node.location, node.value.asString(), this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.StmtNudge:
                assert.eq(node.children.length, 1);
                return new Runtime.Node_StmtNudge(node.location, node.value.asString(), this.linkNode(node.children[0]));
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
                return this.linkTargetVariable(node);
            case Compiler.Kind.TargetProperty:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_TargetProperty(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.TargetIndex:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_TargetIndex(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]));
            case Compiler.Kind.TypeKeyword:
                assert.eq(node.children.length, 0);
                return this.linkTypeKeyword(node);
            case Compiler.Kind.TypeNullable:
                assert.eq(node.children.length, 1);
                return new Runtime.Node_TypeNullable(node.location, this.linkNode(node.children[0]));
            case Compiler.Kind.ValueScalar:
                assert.eq(node.children.length, 0);
                return new Runtime.Node_ValueScalar(node.location, node.value);
            case Compiler.Kind.ValueArray:
                return this.linkValueArray(node);
            case Compiler.Kind.ValueObject:
                return this.linkValueObject(node);
            case Compiler.Kind.ValueCall:
                assert.ge(node.children.length, 1);
                return new Runtime.Node_ValueCall(node.location, this.linkNodes(node.children));
            case Compiler.Kind.ValueVariableGet:
                assert.eq(node.children.length, 0);
                return this.linkValueVariableGet(node);
            case Compiler.Kind.ValuePropertyGet:
                assert.ge(node.children.length, 2);
                return this.linkValuePropertyGet(node);
            case Compiler.Kind.ValueIndexGet:
                assert.ge(node.children.length, 2);
                return this.linkValueIndexGet(node);
            case Compiler.Kind.ValueOperatorBinary:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_ValueOperatorBinary(node.location, this.linkNode(node.children[0]), node.value.asString(), this.linkNode(node.children[1]));
            case Compiler.Kind.ValueOperatorTernary:
                assert.eq(node.children.length, 3);
                return new Runtime.Node_ValueOperatorTernary(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]), this.linkNode(node.children[2]));
        }
        assert.fail("Unknown node kind in linkNode: {kind}", {kind:node.kind});
    }
    linkNodes(nodes: Compiler.INode[]): Runtime.Node[] {
        return nodes.map(node => this.linkNode(node));
    }
    linkTypeKeyword(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.TypeKeyword);
        assert.eq(node.children.length, 0);
        const keyword = node.value.asString();
        switch (keyword) {
            case "void":
                return new Runtime.Node_TypeLiteral_Void(node.location);
            case "bool":
                return new Runtime.Node_TypeLiteral_Bool(node.location);
            case "int":
                return new Runtime.Node_TypeLiteral_Int(node.location);
            case "float":
                return new Runtime.Node_TypeLiteral_Float(node.location);
            case "string":
                return new Runtime.Node_TypeLiteral_String(node.location);
            case "object":
                return new Runtime.Node_TypeLiteral_Object(node.location);
            case "any":
                return new Runtime.Node_TypeLiteral_Any(node.location);
        }
        assert.fail("Unknown keyword for Compiler.Kind.TypeKeyword in linkTypeKeyword: {keyword}", {keyword});
    }
    linkValueArray(node: Compiler.INode): Runtime.Node {
        return new Runtime.Node_ValueArray(node.location, node.children.map(child => {
            return new Runtime.ArrayInitializer(this.linkNode(child), false);
        }));
    }
    linkValueObject(node: Compiler.INode): Runtime.Node {
        return new Runtime.Node_ValueObject(node.location, node.children.map(child => {
            assert.eq(child.kind, Compiler.Kind.ValueNamed);
            assert.eq(child.children.length, 1);
            return new Runtime.ObjectInitializer(child.value.asString(), this.linkNode(child.children[0]), false);
        }));
    }
    linkValueVariableGet(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.ValueVariableGet);
        assert.eq(node.children.length, 0);
        const identifier = node.value.asString();
        const symbol = this.symbols.find(identifier);
        if (symbol) {
            return new Runtime.Node_ValueVariableGet(node.location, identifier);
        }
        throw new LinkerException("Unknown identifier: '{identifier}'", { location: node.location, identifier });
    }
    linkValuePropertyGet(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.ValuePropertyGet);
        assert.eq(node.children.length, 2);
        assert.eq(node.children[1].kind, Compiler.Kind.ValueScalar);
        const property = node.children[1].value.asString();
        return new Runtime.Node_ValuePropertyGet(node.location, this.linkNode(node.children[0]), property);
    }
    linkValueIndexGet(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.ValueIndexGet);
        assert.eq(node.children.length, 2);
        return new Runtime.Node_ValueIndexGet(node.location, this.linkNode(node.children[0]), this.linkNode(node.children[1]));
    }
    linkStmtVariableDefine(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.StmtVariableDefine);
        assert.eq(node.children.length, 2);
        const identifier = node.value.asString();
        let type: Type;
        let initializer: Runtime.Node;
        if (node.children[0].kind === Compiler.Kind.TypeInfer) {
            initializer = this.linkNode(node.children[1]);
            type = initializer.resolve(this);
            assert(!type.isEmpty());
            if (node.children[0].value.getBool()) {
                // Allow 'var?'
                type = type.addPrimitive(Type.Primitive.Null);
            } else {
                // Disallow 'var?'
                type = type.removePrimitive(Type.Primitive.Null);
            }
        } else {
            type = this.linkNode(node.children[0]).resolve(this);
            assert(!type.isEmpty());
            initializer = this.linkNode(node.children[1]);
        }
        const itype = initializer.resolve(this);
        assert(!type.isEmpty());
        if (type.compatibleType(itype).isEmpty()) {
            throw new LinkerException(`Cannot initialize variable '{identifier}' of type '${type.describe()}' with a value of type '${itype.describe()}'`, { location: initializer.location, identifier });
        }
        this.symbols.add(identifier, SymbolFlavour.Variable, type, Value.VOID);
        return new Runtime.Node_StmtVariableDefine(initializer.location, identifier, type, initializer);
    }
    linkStmtFunctionDefine(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.StmtFunctionDefine);
        assert.eq(node.children.length, 3);
        const fname = node.value.asString();
        const rettype = this.linkNode(node.children[0]).resolve(this);
        assert(!rettype.isEmpty());
        assert(node.children[1].kind === Compiler.Kind.FunctionParameters);
        this.symbols.add(fname, SymbolFlavour.Function, Type.OBJECT, Value.VOID);
        this.symbols.push();
        try {
            const parameters = node.children[1].children.map(parameter => {
                assert.eq(parameter.kind, Compiler.Kind.FunctionParameter);
                assert.eq(parameter.children.length, 1);
                const pname = parameter.value.asString();
                const ptype = this.linkNode(parameter.children[0]).resolve(this);
                assert(!ptype.isEmpty());
                this.symbols.add(pname, SymbolFlavour.Argument, ptype, Value.VOID);
                return new FunctionParameter(pname, ptype);
            });
            const signature = new FunctionSignature(fname, node.location, rettype, parameters);
            const block = this.linkNode(node.children[2]);
            return new Runtime.Node_StmtFunctionDefine(node.location, signature, block);
        }
        finally {
            this.symbols.pop();
        }
    }
    linkStmtForeach(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.StmtForeach);
        assert.eq(node.children.length, 3);
        let type, expr;
        if (node.children[0].kind === Compiler.Kind.TypeInfer) {
            expr = this.linkNode(node.children[1]);
            const resolved = expr.resolve(this);
            assert(!resolved.isEmpty());
            const elements = resolved.getIterable();
            if (elements === undefined) {
                throw new LinkerException(`Value of type '${resolved.describe()}' is not iterable in 'for' statement`, { location: expr.location });
            }
            if (node.children[0].value.getBool()) {
                // Allow 'var?'
                type = elements.addPrimitive(Type.Primitive.Null);
            } else {
                // Disallow 'var?'
                type = elements.removePrimitive(Type.Primitive.Null);
            }
        } else {
            type = this.linkNode(node.children[0]).resolve(this);
            assert(!type.isEmpty());
            expr = this.linkNode(node.children[1]);
        }
        const identifier = node.value.asString();
        this.symbols.push();
        try {
            this.symbols.add(identifier, SymbolFlavour.Variable, type, Value.VOID);
            const block = this.linkNode(node.children[2]);
            return new Runtime.Node_StmtForeach(node.location, identifier, type, expr, block);
        }
        finally {
            this.symbols.pop();
        }
    }
    linkStmtForloop(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.StmtForloop);
        assert.eq(node.children.length, 4);
        const initialization = this.linkNode(node.children[0]);
        const condition = this.linkNode(node.children[1]);
        const advance = this.linkNode(node.children[2]);
        const block = this.linkNode(node.children[3]);
        return new Runtime.Node_StmtForloop(node.location, initialization, condition, advance, block);
    }
    linkStmtIf(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.StmtIf);
        assert.ge(node.children.length, 2);
        const condition = this.linkNode(node.children[0]);
        const ifBlock = this.linkNode(node.children[1]);
        if (node.children.length === 2) {
            return new Runtime.Node_StmtIf(node.location, condition, ifBlock, Impl.EMPTY);
        }
        assert.eq(node.children.length, 3);
        const elseBlock = this.linkNode(node.children[2]);
        return new Runtime.Node_StmtIf(node.location, condition, ifBlock, elseBlock);
    }
    linkStmtIfGuard(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.StmtIfGuard);
        assert.ge(node.children.length, 3);
        const identifier = node.value.asString();
        const type = this.linkNode(node.children[0]).resolve(this);
        assert(!type.isEmpty());
        const initializer = this.linkNode(node.children[1]);
        let ifBlock;
        this.symbols.push();
        try {
            this.symbols.add(identifier, SymbolFlavour.Guard, type, Value.VOID);
            ifBlock = this.linkNode(node.children[2]);
        }
        finally {
            this.symbols.pop();
        }
        if (node.children.length === 3) {
            return new Runtime.Node_StmtIfGuard(node.location, identifier, type, initializer, ifBlock, Impl.EMPTY);
        }
        assert.eq(node.children.length, 4);
        const elseBlock = this.linkNode(node.children[3]);
        return new Runtime.Node_StmtIfGuard(node.location, identifier, type, initializer, ifBlock, elseBlock);
    }
    linkStmtReturn(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.StmtReturn);
        assert.eq(node.children.length, 1);
        const expr = this.linkNode(node.children[0]);
        return new Runtime.Node_StmtReturn(node.location, expr);
    }
    linkStmtTry(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.StmtTry);
        assert.ge(node.children.length, 2);
        const hasFinally = node.value.asBoolean();
        const tryBlock = this.linkNode(node.children[0]);
        if (hasFinally) {
            const catchClauses = node.children.slice(1, -1).map(child => this.linkStmtCatch(child));
            const finallyClause = this.linkNode(node.children[node.children.length - 1]);
            return new Runtime.Node_StmtTry(node.location, tryBlock, catchClauses, finallyClause);
        } else {
            const catchClauses = node.children.slice(1).map(child => this.linkStmtCatch(child));
            return new Runtime.Node_StmtTry(node.location, tryBlock, catchClauses, Impl.EMPTY);
        }
    }
    linkStmtCatch(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.StmtCatch);
        assert.eq(node.children.length, 2);
        const identifier = node.value.asString();
        const type = this.linkNode(node.children[0]);
        this.symbols.push();
        try {
            this.symbols.add(identifier, SymbolFlavour.Exception, type.resolve(this), Value.VOID);
            const block = this.linkNode(node.children[1]);
            return new Runtime.Node_StmtCatch(node.location, identifier, type, block);
        }
        finally {
            this.symbols.pop();
        }
    }
    linkTargetVariable(node: Compiler.INode): Runtime.Node {
        assert(node.kind === Compiler.Kind.TargetVariable);
        assert.eq(node.children.length, 0);
        const identifier = node.value.asString();
        const symbol = this.symbols.find(identifier);
        if (symbol === undefined) {
            throw new LinkerException("Unknown identifier: '{identifier}'", { location: node.location, identifier });
        }
        return new Runtime.Node_TargetVariable(node.location, identifier);
    }
    resolveIdentifier(identifier: string): Type {
        const symbol = this.symbols.find(identifier);
        if (symbol) {
            return symbol.type;
        }
        throw new LinkerException("Unknown identifier: '{identifier}'", { identifier });
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

class LinkerException extends Exception {
    constructor(message: string, parameters?: Message.Parameters) {
        super(LinkerException.name, Exception.Origin.Linker, message, parameters);
    }
}
