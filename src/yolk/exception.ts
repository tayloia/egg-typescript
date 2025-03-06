export class BaseException extends Error {
    parameters: Record<string, unknown>;
    protected constructor(name: string, private _message: string, parameters: Record<string, unknown>) {
        super();
        this.parameters = { ...parameters, name: name };
    }
    get message(): string {
        return Exception.format(this._message, this.parameters);
    }
    get name(): string {
        return this.parameters.name as string;
    }
}

export class Exception extends BaseException {
    constructor(message: string, parameters: Record<string, unknown> = {}) {
        super(Exception.name, message, parameters);
    }
    static location(source: any, line: any, column: any): string {
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
    static format(message: string, parameters: Record<string, unknown>): string {
        function replacer(input: string, key: string): string {
            if (key === "location") {
                return Exception.location(parameters.source, parameters.line, parameters.column);
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
