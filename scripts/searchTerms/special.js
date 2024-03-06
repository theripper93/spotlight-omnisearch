import {BaseSearchTerm} from "./baseSearchTerm";
import { MODULE_ID } from "../main";

export const SPECIAL_SEARCHES = [];

export class SpecialSearchTerm extends BaseSearchTerm {
    constructor(...args) {
        super(...args);
        this.match = args[0].match.bind(this);
    }
}

const NOTE_MATCHING = ["note", "notes", "!note", "!notes", "note:", "notes:", "!n", "n:"];
const ROLL_MATCHING = ["roll", "!roll", "roll:", "!r", "r:", "r "];

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
            ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.calc-clipboard`));
        },
    }),
    //notes
    new SpecialSearchTerm({
        name: () => game.i18n.localize(`${MODULE_ID}.special.note.name`),
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
            if (!noteText) return;
            const journalName = `Omnisearch Notes [${game.user.name}]`
            let journal = game.journal.getName(journalName);
            if (!journal) {
                journal = await JournalEntry.create({
                    name: journalName,
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
            ui.notifications.info(game.i18n.localize(`${MODULE_ID}.notifications.note`));
        },
    }),
    //roll
    new SpecialSearchTerm({
        name: () => game.i18n.localize(`${MODULE_ID}.special.roll.name`),
        description: (search) => {
            const rollText = search.query.replace(/(roll|!roll|roll:|!r|r:|r )/i, "").trim();
            return rollText;
        },
        type: "special-app",
        data: {},
        img: "",
        icon: "fas fa-dice-d20",
        match: (query) => {
            return ROLL_MATCHING.some((keyword) => query.startsWith(keyword));
        },
        onClick: async function (search) {
            new Roll(this.description).toMessage();
        },
    }),
        //help
        new SpecialSearchTerm({
            name: () => game.i18n.localize(`${MODULE_ID}.special.help.name`),
            description: (search) => {
                const listElements = game.i18n.translations["spotlight-omnisearch"].special.help.list;
                return `<ul>${listElements.map((element) => `<li style="pointer-events:none">${element}</li>`).join("")}</ul>`;                
            },
            type: "special-app",
            data: {},
            img: "",
            icon: "fas fa-question",
            match: (query) => {
                return query.includes("help") || query.startsWith("?");
            },
            onClick: async function (search) {
            },
        }),
);
