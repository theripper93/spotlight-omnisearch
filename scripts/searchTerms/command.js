import { BaseSearchTerm } from "./baseSearchTerm";

export class CommandSearchTerm extends BaseSearchTerm {
    constructor (...args) {
        super(...args);
        this._onClick = this.execute;
    }

    execute() {
        console.log("Executing command: ", this.name);
    }
}