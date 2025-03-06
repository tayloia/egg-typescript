export class Exception extends Error {
    constructor(private _message: string, public parameters: Record<string, unknown> = {}) {
        super();
    }
    get message(): string {
        return Exception.format(this._message, this.parameters);
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
