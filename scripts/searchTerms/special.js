export const SPECIAL_SEARCHES = [];

export class SpecialSearchTerm extends BaseSearchTerm {
    constructor (...args) {
        super(...args);
        this._onClick = this.execute;
        this.match = args[0].match;
    }

    execute() {
        console.log("Executing command: ", this.name);
    }
}

SPECIAL_SEARCHES.push(new SpecialSearchTerm({
    name: () => {
        return eval(this.query);
    },
    type: "calc",
    data: {},
    img: "",
    icon: "fas fa-calculator",
    match: (query) => {
        return query.match(/^[0-9\+\-\*\/\(\)\.]*$/);
    },
    onClick: (event) => { 
        navigator.clipboard.writeText(this.name);
    }
}));