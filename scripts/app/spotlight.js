import {MODULE_ID} from "../main.js";
import { SPECIAL_SEARCHES } from "../searchTerms/special.js";

export class Spotlight extends Application {
    constructor() {
        super();
    }

    static get APP_ID() {
        return this.name
            .split(/(?=[A-Z])/)
            .join("-")
            .toLowerCase();
    }

    get APP_ID() {
        return this.constructor.APP_ID;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: this.APP_ID,
            template: `modules/${MODULE_ID}/templates/${this.APP_ID}.hbs`,
            popOut: true,
            resizable: false,
            minimizable: false,
            width: 600,
            title: game.i18n.localize(`${MODULE_ID}.${this.APP_ID}.title`),
        });
    }

    async getData() {
        const data = {};
        return { data };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html = html[0] ?? html;
        html.querySelector("input").addEventListener("input", this._onSearch.bind(this));
        this._html = html;
    }

    _onSearch(event) {
        const query = event.target.value.toLowerCase().trim();
        const results = [];
        console.log(query);
        //match special searches
        SPECIAL_SEARCHES.forEach((search) => {
            if (search.match(query)) {
                results.push(new SearchItem(search));
            }
        });



        //set the list to the results
        const list = this._html.querySelector("#search-result");
        list.innerHTML = "";
        results.forEach((result) => {
            list.appendChild(result.element);
        });
    }
}

class SearchItem {
    constructor({ name, type, data, img, icon, onClick = null }) {
        this.name = name;
        this.type = type;
        this.data = data;
        this.img = img;
        this.icon = icon;
        this.element = document.createElement("li");
        this._onClick = onClick;
        this.render();
    }

    async render() {
        this.element.innerHTML = `${this.img && `<img src="${this.img}" alt="${this.name}">`} <i class="${this.icon}"></i> ${this.name}`;
        this.element.addEventListener("click", this._onClick.bind(this));
    }
}
