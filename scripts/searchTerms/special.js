import { BaseSearchTerm } from "./baseSearchTerm";

export const SPECIAL_SEARCHES = [];

export class SpecialSearchTerm extends BaseSearchTerm {
    constructor(...args) {
        super(...args);
        this.match = args[0].match.bind(this);
    }
}

const NOTE_MATCHING = ["note", "notes", "!note", "!notes", "note:", "notes:", "!n", "n:"];

SPECIAL_SEARCHES.push(
    //Calculator
    new SpecialSearchTerm({
        name: function (search) {
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
                    return "...";
                }
            }
        },
        type: "special-app",
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
    //notes
    new SpecialSearchTerm({
        name: "Note",
        description: (search) => {
            const noteText = search.query.replace(/(note|notes|!note|!notes|note:|notes:|!n|n:)/i, "").trim();
            return noteText;
        },
        type: "special-app",
        data: {},
        img: "",
        icon: "fas fa-sticky-note",
        match: (query) => {
            return NOTE_MATCHING.some((keyword) => query.startsWith(keyword));
        },
        onClick: async function (search) {
            const noteText = this.description;
            if(!noteText) return;
            let journal = game.journal.getName("Omnisearch Notes");
            if (!journal) {
                journal = await JournalEntry.create({
                    name: "Omnisearch Notes",
                });
            }
            const todayDate = new Date().toLocaleDateString();
            const nowTime = new Date().toLocaleTimeString();
            let page = journal.pages.getName(todayDate);
            if (!page) {
                page = await journal.createEmbeddedDocuments("JournalEntryPage", [
                    {
                        name: todayDate,
                        type: "text",
                    },
                ]);
                page = page[0];
            }
            const currentContent = page.text.content ?? "";
            page.update({
                "text.content": `${currentContent} <h3>${nowTime}:</h3><p>${noteText}</p>`,
            });
        },
    }),
);
