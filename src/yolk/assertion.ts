import { BaseException, ExceptionParameters } from "./exception";

export class AssertionException extends BaseException {
    constructor(message: string, parameters?: ExceptionParameters) {
        super("AssertionException", message, parameters);
    }
}
