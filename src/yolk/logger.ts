export abstract class Logger {
    abstract log(entry: Logger.Entry): void;
    error(message: string, parameters?: Logger.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Error, message, parameters));
    }
    warning(message: string, parameters?: Logger.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Warning, message, parameters));
    }
    info(message: string, parameters?: Logger.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Info, message, parameters));
    }
    debug(message: string, parameters?: Logger.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Debug, message, parameters));
    }
    trace(message: string, parameters?: Logger.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Trace, message, parameters));
    }
    print(message: string, parameters?: Logger.Parameters) {
        this.log(new Logger.Entry(Logger.Severity.Print, message, parameters));
    }
    static location(source: unknown, line: unknown, column: unknown): string {
        if (column) {
            return `${source || ""}(${line},${column}): `;
        }
        if (line) {
            return `${source || ""}(${line}): `;
        }
        if (source) {
            return `${source}: `;
        }
        return "";
    }
    static format(message: string, parameters: Logger.Parameters): string {
        function replacer(input: string, key: string): string {
            if (key === "location") {
                return Logger.location(parameters.source, parameters.line, parameters.column);
            }
            const output = parameters[key];
            if (output === undefined) {
                return input;
            }
            return String(output);
        }
        return message.replace(/\{([^}]+)\}/g, replacer);
    }
}

export namespace Logger {
    export enum Severity {
        Print, Trace, Debug, Info, Warning, Error
    }
    export type Parameters = Record<string, unknown>;
    export class Entry {
        constructor(public severity: Logger.Severity, public message: string, public parameters?: Logger.Parameters) {}
        format() {
            return this.parameters ? Logger.format(this.message, this.parameters) : this.message;
        }
    }
}

export class ConsoleLogger extends Logger {
    log(entry: Logger.Entry): void {
        const message = entry.format();
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
