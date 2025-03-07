export type ExceptionParameters = Record<string, unknown>;

export class BaseException extends Error {
    parameters: ExceptionParameters;
    protected constructor(name: string, private _message: string, parameters?: ExceptionParameters) {
        super();
        this.parameters = parameters ? { ...parameters, name: name } : { name: name };
    }
    get message(): string {
        return Exception.format(this._message, this.parameters);
    }
    get name(): string {
        return this.parameters.name as string;
    }
}

export class Exception extends BaseException {
    constructor(message: string, parameters?: ExceptionParameters) {
        super(Exception.name, message, parameters);
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
    static format(message: string, parameters: ExceptionParameters): string {
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
