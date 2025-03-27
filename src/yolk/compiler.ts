import { assert } from "./assertion";
import { Builtins } from "./builtins";
import { Syntax } from "./syntax";
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
import { Manifestations } from "./manifestations";

class Module implements Program.IModule {
    constructor(public readonly root: Program.INode, public readonly source: string) {}
}

enum ScopeKind {
    Module,
    Function,
}

class ScopeFrame {
    constructor(public kind: ScopeKind, public chain?: ScopeFrame) {}
    signature?: FunctionSignature;
}

class Scope {
    private frame = new ScopeFrame(ScopeKind.Module);
    private push(kind: ScopeKind) {
        return this.frame = new ScopeFrame(kind, this.frame);
    }
    pushFunction(signature: FunctionSignature) {
        this.push(ScopeKind.Function).signature = signature;
    }
    pop() {
        if (this.frame.chain) {
            this.frame = this.frame.chain;
        } else {
            assert.unreachable();
        }
    }
    findFunction() {
        for (let frame : ScopeFrame | undefined = this.frame; frame; frame = frame.chain) {
            if (frame.signature) {
                return frame.signature;
            }
        }
        return undefined;
    }
}

class Impl implements Program.IResolver {
    static readonly EMPTY = new Runtime.Node_Empty(new Location("(empty)", 0, 0));
    constructor(public modules: Module[], public logger: Logger) {
        this.manifestations = Manifestations.createDefault();
        this.scope = new Scope();
        this.symbols = new SymbolTable();
        this.symbols.builtin(new Builtins.Print());
    }
    manifestations: Manifestations;
    scope: Scope;
    symbols: SymbolTable;
    compileProgram(): Program {
        return new Program(this.modules);
    }
    compileModule(module: Syntax.IModule): Module {
        const root = this.compileNode(module.root);
        return new Module(root, root.location.source);
    }
    compileNode(node: Syntax.INode): Runtime.Node {
        switch (node.kind) {
            case Syntax.Kind.Module:
                return new Runtime.Node_Module(node.location, this.compileNodes(node.children));
            case Syntax.Kind.StmtBlock:
                return new Runtime.Node_StmtBlock(node.location, this.compileNodes(node.children));
            case Syntax.Kind.StmtAssert:
                assert.ge(node.children.length, 1);
                return new Runtime.Node_StmtAssert(node.location, node.value.asString(), this.compileNodes(node.children));
            case Syntax.Kind.StmtCall:
                assert.ge(node.children.length, 1);
                return new Runtime.Node_StmtCall(node.location, this.compileNodes(node.children));
            case Syntax.Kind.StmtVariableDefine:
                assert.eq(node.children.length, 2);
                return this.compileStmtVariableDefine(node);
            case Syntax.Kind.StmtFunctionDefine:
                assert.eq(node.children.length, 3);
                return this.compileStmtFunctionDefine(node);
            case Syntax.Kind.StmtAssign:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_StmtAssign(node.location, this.compileNode(node.children[0]), this.compileNode(node.children[1]));
            case Syntax.Kind.StmtMutate:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_StmtMutate(node.location, node.value.asString(), this.compileNode(node.children[0]), this.compileNode(node.children[1]));
            case Syntax.Kind.StmtNudge:
                assert.eq(node.children.length, 1);
                return new Runtime.Node_StmtNudge(node.location, node.value.asString(), this.compileNode(node.children[0]));
            case Syntax.Kind.StmtForeach:
                assert.eq(node.children.length, 3);
                return this.compileStmtForeach(node);
            case Syntax.Kind.StmtForloop:
                assert.eq(node.children.length, 4);
                return this.compileStmtForloop(node);
            case Syntax.Kind.StmtIf:
                return this.compileStmtIf(node);
            case Syntax.Kind.StmtIfGuard:
                return this.compileStmtIfGuard(node);
            case Syntax.Kind.StmtReturn:
                return this.compileStmtReturn(node);
            case Syntax.Kind.StmtTry:
                return this.compileStmtTry(node);
            case Syntax.Kind.TargetVariable:
                return this.compileTargetVariable(node);
            case Syntax.Kind.TargetProperty:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_TargetProperty(node.location, this.compileNode(node.children[0]), this.compileNode(node.children[1]));
            case Syntax.Kind.TargetIndex:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_TargetIndex(node.location, this.compileNode(node.children[0]), this.compileNode(node.children[1]));
            case Syntax.Kind.TypeKeyword:
                assert.eq(node.children.length, 0);
                return this.compileTypeKeyword(node);
            case Syntax.Kind.TypeManifestation:
                assert.eq(node.children.length, 0);
                return this.compileTypeManifestation(node);
            case Syntax.Kind.TypeNullable:
                assert.eq(node.children.length, 1);
                return new Runtime.Node_TypeNullable(node.location, this.compileNode(node.children[0]));
            case Syntax.Kind.ValueScalar:
                assert.eq(node.children.length, 0);
                return new Runtime.Node_ValueScalar(node.location, node.value);
            case Syntax.Kind.ValueArray:
                return this.compileValueArray(node);
            case Syntax.Kind.ValueObject:
                return this.compileValueObject(node);
            case Syntax.Kind.ValueCall:
                assert.ge(node.children.length, 1);
                return new Runtime.Node_ValueCall(node.location, this.compileNodes(node.children));
            case Syntax.Kind.ValueVariableGet:
                assert.eq(node.children.length, 0);
                return this.compileValueVariableGet(node);
            case Syntax.Kind.ValuePropertyGet:
                assert.ge(node.children.length, 2);
                return this.compileValuePropertyGet(node);
            case Syntax.Kind.ValueIndexGet:
                assert.ge(node.children.length, 2);
                return this.compileValueIndexGet(node);
            case Syntax.Kind.ValueOperatorBinary:
                assert.eq(node.children.length, 2);
                return new Runtime.Node_ValueOperatorBinary(node.location, this.compileNode(node.children[0]), node.value.asString(), this.compileNode(node.children[1]));
            case Syntax.Kind.ValueOperatorTernary:
                assert.eq(node.children.length, 3);
                return new Runtime.Node_ValueOperatorTernary(node.location, this.compileNode(node.children[0]), this.compileNode(node.children[1]), this.compileNode(node.children[2]));
        }
        assert.fail("Unknown node kind in compileNode: {kind}", {kind:node.kind});
    }
    compileNodes(nodes: Syntax.INode[]): Runtime.Node[] {
        return nodes.map(node => this.compileNode(node));
    }
    compileTypeKeyword(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.TypeKeyword);
        assert.eq(node.children.length, 0);
        const keyword = node.value.asString();
        switch (keyword) {
            case "void":
                return new Runtime.Node_TypePrimitive(node.location, Type.VOID);
            case "bool":
                return new Runtime.Node_TypePrimitive(node.location, Type.BOOL);
            case "int":
                return new Runtime.Node_TypePrimitive(node.location, Type.INT);
            case "float":
                return new Runtime.Node_TypePrimitive(node.location, Type.FLOAT);
            case "string":
                return new Runtime.Node_TypePrimitive(node.location, Type.STRING);
            case "object":
                return new Runtime.Node_TypePrimitive(node.location, Type.OBJECT);
            case "any":
                return new Runtime.Node_TypePrimitive(node.location, Type.ANY);
        }
        assert.fail("Unknown keyword in compileTypeKeyword: {keyword}", {keyword});
    }
    compileTypeManifestation(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.TypeManifestation);
        assert.eq(node.children.length, 0);
        const keyword = node.value.asString();
        switch (keyword) {
            case "void":
                return new Runtime.Node_ManifestationVoid(node.location);
            case "bool":
                return new Runtime.Node_ManifestationBool(node.location);
            case "int":
                return new Runtime.Node_ManifestationInt(node.location);
            case "float":
                return new Runtime.Node_ManifestationFloat(node.location);
            case "string":
                return new Runtime.Node_ManifestationString(node.location);
            case "object":
                return new Runtime.Node_ManifestationObject(node.location);
            case "any":
                return new Runtime.Node_ManifestationAny(node.location);
            case "type":
                return new Runtime.Node_ManifestationType(node.location);
        }
        assert.fail("Unknown keyword in compileTypeManifestation: {keyword}", {keyword});
    }
    compileValueArray(node: Syntax.INode): Runtime.Node {
        return new Runtime.Node_ValueArray(node.location, node.children.map(child => {
            return new Runtime.ArrayInitializer(this.compileNode(child), false);
        }));
    }
    compileValueObject(node: Syntax.INode): Runtime.Node {
        return new Runtime.Node_ValueObject(node.location, node.children.map(child => {
            assert.eq(child.kind, Syntax.Kind.ValueNamed);
            assert.eq(child.children.length, 1);
            return new Runtime.ObjectInitializer(child.value.asString(), this.compileNode(child.children[0]), false);
        }));
    }
    compileValueVariableGet(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.ValueVariableGet);
        assert.eq(node.children.length, 0);
        const identifier = node.value.asString();
        const symbol = this.symbols.find(identifier);
        if (symbol) {
            return new Runtime.Node_ValueVariableGet(node.location, identifier);
        }
        this.raise(node, "Unknown identifier: '{identifier}'", { identifier });
    }
    compileValuePropertyGet(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.ValuePropertyGet);
        assert.eq(node.children.length, 2);
        assert.eq(node.children[1].kind, Syntax.Kind.ValueScalar);
        const property = node.children[1].value.asString();
        return new Runtime.Node_ValuePropertyGet(node.location, this.compileNode(node.children[0]), property);
    }
    compileValueIndexGet(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.ValueIndexGet);
        assert.eq(node.children.length, 2);
        return new Runtime.Node_ValueIndexGet(node.location, this.compileNode(node.children[0]), this.compileNode(node.children[1]));
    }
    compileStmtVariableDefine(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.StmtVariableDefine);
        assert.eq(node.children.length, 2);
        const identifier = node.value.asString();
        let type: Type;
        let initializer: Runtime.Node;
        if (node.children[0].kind === Syntax.Kind.TypeInfer) {
            initializer = this.compileNode(node.children[1]);
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
            type = this.compileNode(node.children[0]).resolve(this);
            assert(!type.isEmpty());
            initializer = this.compileNode(node.children[1]);
        }
        const itype = initializer.resolve(this);
        assert(!type.isEmpty());
        if (type.compatibleType(itype).isEmpty()) {
            this.raise(node.children[1], `Cannot initialize variable '{identifier}' of type '${type.format()}' with ${itype.describeValue()}`, { identifier });
        }
        this.symbols.add(identifier, SymbolFlavour.Variable, type, Value.VOID);
        return new Runtime.Node_StmtVariableDefine(initializer.location, identifier, type, initializer);
    }
    compileStmtFunctionDefine(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.StmtFunctionDefine);
        assert.eq(node.children.length, 3);
        const fname = node.value.asString();
        const rettype = this.compileNode(node.children[0]).resolve(this);
        assert(!rettype.isEmpty());
        assert(node.children[1].kind === Syntax.Kind.FunctionParameters);
        this.symbols.add(fname, SymbolFlavour.Function, Type.OBJECT, Value.VOID);
        this.symbols.push();
        try {
            const parameters = node.children[1].children.map(parameter => {
                assert.eq(parameter.kind, Syntax.Kind.FunctionParameter);
                assert.eq(parameter.children.length, 1);
                const pname = parameter.value.asString();
                const ptype = this.compileNode(parameter.children[0]).resolve(this);
                assert(!ptype.isEmpty());
                this.symbols.add(pname, SymbolFlavour.Argument, ptype, Value.VOID);
                return new FunctionParameter(pname, ptype);
            });
            const signature = new FunctionSignature(fname, node.location, rettype, parameters);
            this.scope.pushFunction(signature);
            try {
                const block = this.compileNode(node.children[2]);
                return new Runtime.Node_StmtFunctionDefine(node.location, signature, block);
            }
            finally {
                this.scope.pop();
            }
        }
        finally {
            this.symbols.pop();
        }
    }
    compileStmtForeach(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.StmtForeach);
        assert.eq(node.children.length, 3);
        let type, expr;
        if (node.children[0].kind === Syntax.Kind.TypeInfer) {
            expr = this.compileNode(node.children[1]);
            const resolved = expr.resolve(this);
            assert(!resolved.isEmpty());
            const iterables = resolved.getIterables();
            if (iterables.length === 0) {
                this.raise(node.children[1], `Value of type '${resolved.format()}' is not iterable in 'for' statement`);
            }
            type = Type.union(...iterables.map(i => i.elementtype));
            if (node.children[0].value.getBool()) {
                // Allow 'var?'
                type = type.addPrimitive(Type.Primitive.Null);
            } else {
                // Disallow 'var?'
                type = type.removePrimitive(Type.Primitive.Null);
            }
        } else {
            type = this.compileNode(node.children[0]).resolve(this);
            assert(!type.isEmpty());
            expr = this.compileNode(node.children[1]);
        }
        const identifier = node.value.asString();
        this.symbols.push();
        try {
            this.symbols.add(identifier, SymbolFlavour.Variable, type, Value.VOID);
            const block = this.compileNode(node.children[2]);
            return new Runtime.Node_StmtForeach(node.location, identifier, type, expr, block);
        }
        finally {
            this.symbols.pop();
        }
    }
    compileStmtForloop(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.StmtForloop);
        assert.eq(node.children.length, 4);
        const initialization = this.compileNode(node.children[0]);
        const condition = this.compileNode(node.children[1]);
        const advance = this.compileNode(node.children[2]);
        const block = this.compileNode(node.children[3]);
        return new Runtime.Node_StmtForloop(node.location, initialization, condition, advance, block);
    }
    compileStmtIf(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.StmtIf);
        assert.ge(node.children.length, 2);
        const condition = this.compileNode(node.children[0]);
        const ifBlock = this.compileNode(node.children[1]);
        if (node.children.length === 2) {
            return new Runtime.Node_StmtIf(node.location, condition, ifBlock, Impl.EMPTY);
        }
        assert.eq(node.children.length, 3);
        const elseBlock = this.compileNode(node.children[2]);
        return new Runtime.Node_StmtIf(node.location, condition, ifBlock, elseBlock);
    }
    compileStmtIfGuard(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.StmtIfGuard);
        assert.ge(node.children.length, 3);
        const identifier = node.value.asString();
        const type = this.compileNode(node.children[0]).resolve(this);
        assert(!type.isEmpty());
        const initializer = this.compileNode(node.children[1]);
        let ifBlock;
        this.symbols.push();
        try {
            this.symbols.add(identifier, SymbolFlavour.Guard, type, Value.VOID);
            ifBlock = this.compileNode(node.children[2]);
        }
        finally {
            this.symbols.pop();
        }
        if (node.children.length === 3) {
            return new Runtime.Node_StmtIfGuard(node.location, identifier, type, initializer, ifBlock, Impl.EMPTY);
        }
        assert.eq(node.children.length, 4);
        const elseBlock = this.compileNode(node.children[3]);
        return new Runtime.Node_StmtIfGuard(node.location, identifier, type, initializer, ifBlock, elseBlock);
    }
    compileStmtReturn(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.StmtReturn);
        assert.le(node.children.length, 1);
        const signature = this.scope.findFunction();
        if (signature === undefined) {
            this.raise(node, "Unexpected 'return' statement");
        }
        if (node.children.length === 0) {
            if (signature.rettype.hasOnly(Type.Primitive.Void)) {
                return new Runtime.Node_StmtReturn(node.location);
            }
            this.raise(node, `Expected 'return' statement with ${signature.rettype.describeValue()}`);
        }
        const expr = this.compileNode(node.children[0]);
        if (signature.rettype.compatibleType(expr.resolve(this)).isEmpty()) {
            if (signature.rettype.hasOnly(Type.Primitive.Void)) {
                this.raise(node.children[0], "Expected no value after 'return' within a 'void' function");
            }
            this.raise(node, "Incompatible 'return' statement value");
        }
        return new Runtime.Node_StmtReturn(node.location, expr);
    }
    compileStmtTry(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.StmtTry);
        assert.ge(node.children.length, 2);
        const hasFinally = node.value.asBoolean();
        const tryBlock = this.compileNode(node.children[0]);
        if (hasFinally) {
            const catchClauses = node.children.slice(1, -1).map(child => this.compileStmtCatch(child));
            const finallyClause = this.compileNode(node.children[node.children.length - 1]);
            return new Runtime.Node_StmtTry(node.location, tryBlock, catchClauses, finallyClause);
        } else {
            const catchClauses = node.children.slice(1).map(child => this.compileStmtCatch(child));
            return new Runtime.Node_StmtTry(node.location, tryBlock, catchClauses, Impl.EMPTY);
        }
    }
    compileStmtCatch(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.StmtCatch);
        assert.eq(node.children.length, 2);
        const identifier = node.value.asString();
        const type = this.compileNode(node.children[0]);
        this.symbols.push();
        try {
            this.symbols.add(identifier, SymbolFlavour.Exception, type.resolve(this), Value.VOID);
            const block = this.compileNode(node.children[1]);
            return new Runtime.Node_StmtCatch(node.location, identifier, type, block);
        }
        finally {
            this.symbols.pop();
        }
    }
    compileTargetVariable(node: Syntax.INode): Runtime.Node {
        assert(node.kind === Syntax.Kind.TargetVariable);
        assert.eq(node.children.length, 0);
        const identifier = node.value.asString();
        const symbol = this.symbols.find(identifier);
        if (symbol === undefined) {
            this.raise(node, "Unknown identifier: '{identifier}'", { identifier });
        }
        return new Runtime.Node_TargetVariable(node.location, identifier);
    }
    resolveIdentifier(identifier: string): Type {
        const symbol = this.symbols.find(identifier);
        if (symbol) {
            return symbol.type;
        }
        throw new CompilerException(undefined, "Unknown identifier: '{identifier}'", { identifier });
    }
    raise(node: Syntax.INode, message: string, parameters?: Message.Parameters): never {
        throw new CompilerException(node.location, message, parameters);
    }
    log(entry: Logger.Entry): void {
        this.logger.log(entry);
    }
}

export class Compiler {
    logger?: Logger;
    modules: Module[] = [];
    compile(): Program {
        const impl = new Impl(this.modules, this.logger ?? new ConsoleLogger());
        return impl.compileProgram();
    }
    withLogger(logger: Logger): Compiler {
        this.logger = logger;
        return this;
    }
    withModule(module: Syntax.IModule): Compiler {
        const impl = new Impl(this.modules, this.logger ?? new ConsoleLogger());
        this.modules.push(impl.compileModule(module));
        return this;
    }
}

class CompilerException extends Exception {
    constructor(location: Location | undefined, message: string, parameters?: Message.Parameters) {
        super(CompilerException.name, Exception.Origin.Compiler, message, { location, ...parameters });
    }
}
