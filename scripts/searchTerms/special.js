import { BaseSearchTerm } from "./baseSearchTerm";

export const SPECIAL_SEARCHES = [];

export class SpecialSearchTerm extends BaseSearchTerm {
    constructor(...args) {
        super(...args);
        this.match = args[0].match.bind(this);
    }
}

SPECIAL_SEARCHES.push(
    new SpecialSearchTerm({
        name: function (search){
            try {
                return eval(search.query);
            } catch {
                //remove characters from the end until the last character is a number
                let query = search.query;
                while (query.length > 0 && isNaN(query[query.length - 1])) {
                    query = query.slice(0, -1);
                }
                try {
                    return eval(query);
                } catch {
                    return "..."
                }
            }
        },
        type: "calc",
        data: {},
        img: "",
        icon: "fas fa-calculator",
        match: (query) => {
            return query.match(/^[0-9\+\-\*\/\(\)\.\s]*$/);

        },
        onClick: function (search) {
            navigator.clipboard.writeText(this.name);
        },
    }),
);
