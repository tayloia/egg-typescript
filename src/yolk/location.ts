import { inspect } from "util";

export class Location {
    constructor(public source: string, public line0: number, public column0: number, public line1: number = 0, public column1: number = 0) {}
    span(that: Location): Location {
        return new Location(this.source, this.line0, this.column0, that.line1, that.column1);
    }
    format() {
        function range(lbound: number, ubound: number): string {
            return lbound < ubound ? `${lbound}-${ubound}` : `${lbound}`;
        }
        if (this.line0 === 0 && this.column0 === 0) {
            return this.source;
        }
        if (this.column0 === 0) {
            return `${this.source}(${range(this.line0, this.line1)})`;
        }
        return `${this.source}(${range(this.line0, this.line1)},${range(this.column0, this.column1)})`;
    }
    [inspect.custom]() {
        return `[${this.format()}]`;
    } ;
}
