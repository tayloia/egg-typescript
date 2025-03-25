import { Exception } from "./exception";
import { Message } from "./message";

export abstract class Logger {
    abstract log(entry: Logger.Entry): void;
    trap(error: unknown) {
        const exception = Exception.from(error);
        if (exception) {
            this.error(exception.reason, exception.parameters);
        } else {
            this.error("Unknown exception: {exception}", {exception: error});
        }
        return error;
    }
    error(message: string, parameters?: Message.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Error, message, parameters));
    }
    warning(message: string, parameters?: Message.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Warning, message, parameters));
    }
    info(message: string, parameters?: Message.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Info, message, parameters));
    }
    debug(message: string, parameters?: Message.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Debug, message, parameters));
    }
    trace(message: string, parameters?: Message.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Trace, message, parameters));
    }
    print(message: string, parameters?: Message.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Print, message, parameters));
    }
}

export namespace Logger {
    export enum Severity {
        Print, Trace, Debug, Info, Warning, Error
    }
    export class Entry extends Message {
        constructor(public severity: Logger.Severity, message: string, parameters?: Message.Parameters) {
            super(message, { ...parameters });
        }
    }
}

export class ConsoleLogger extends Logger {
    log(entry: Logger.Entry): void {
        const message = entry.format(true);
        switch (entry.severity) {
            case Logger.Severity.Error:
                console.error(message);
                break;
            case Logger.Severity.Warning:
                console.warn(message);
                break;
            case Logger.Severity.Info:
                console.info(message);
                break;
            case Logger.Severity.Debug:
                console.debug(message);
                break;
            case Logger.Severity.Trace:
                console.trace(message);
                break;
            case Logger.Severity.Print:
                console.log(message);
                break;
        }
    }
}
