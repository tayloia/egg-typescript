import { BaseException, ExceptionParameters } from "./exception";
import { ConsoleLogger, Logger } from "./logger";
import { Module, Program } from "./program";

class Impl extends Logger {
    constructor(public modules: Module[], public logger: Logger) {
        super();
    }
    linkProgram(): Program {
        return new Program(this.modules);
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
    withModule(module: Module): Linker {
        this.modules.push(module);
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
