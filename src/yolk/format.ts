export interface IFormattable {
    format(options?: FormatOptions): string;
}

export class FormatOptions {
    quoteString?: string;
    functionParameterNames?: boolean;
}
