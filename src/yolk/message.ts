import { FormatOptions } from "./format";
import { Location } from "./location";

export class Message extends Error {
    protected constructor(public readonly reason: string, public parameters: Message.Parameters) {
        super();
    }
    get name() {
        return this.parameters.name as string;
    }
    get origin() {
        return this.parameters.origin as Message.Origin;
    }
    get message() {
        return this.format(true);
    }
    format(prefixLocation: boolean) {
        return Message.format(this.reason, this.parameters, prefixLocation);
    }
    static format(reason: string, parameters: Message.Parameters, prefixLocation: boolean): string {
        const options = new FormatOptions();
        options.quoteString = "\"";
        function replacer(input: string, key: string): string {
            const output = parameters[key];
            if (output) {
                if (output instanceof Object && "format" in output && typeof output.format === "function") {
                    return output?.format(options);
                }
                return String(output);
            }
            return input;
        }
        const message = reason.replace(/\{([^}]+)\}/g, replacer);
        const prefix = prefixLocation && parameters.location && (parameters.location as Location).format();
        return prefix ? prefix + ": " + message : message;
    }
}

export namespace Message {
    export enum Origin {
        Assertion = "ASSERTION",
        Compiler = "COMPILER",
        Parser = "PARSER",
        Runtime = "RUNTIME",
        Tokenizer = "TOKENIZER",
    };
    export type Parameters = Record<string, unknown>;
}
