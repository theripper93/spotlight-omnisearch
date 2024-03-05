import { MODULE_ID } from "../main.js";
import {SPECIAL_SEARCHES} from "../searchTerms/special.js";

import { INDEX, buildIndex } from "../searchTerms/buildTermIndex.js";

export class Spotlight extends Application {
    constructor() {
        super();
        buildIndex();
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
        this._html = html;
        html.querySelector("input").addEventListener("input", this._onSearch.bind(this));
    }

    setPosition(...args) {
        super.setPosition(...args);
        //get max availeble vertical space
        const windowApp = this._html.closest("#spotlight");
        const top = windowApp.getBoundingClientRect().top;
        const searchHeight = 100;
        const maxHeight = window.innerHeight - top - searchHeight;
        this._html.querySelector("section").style.maxHeight = `${maxHeight}px`;
    }

    _onSearch(event) {
        const query = event.target.value.toLowerCase().trim();
        const section = this._html.querySelector("section");
        section.classList.toggle("no-results", !query);
        if (!query) {
            this._html.querySelector("#search-result").innerHTML = "";
            this.setPosition({ height: "auto" });
            return;
        }
        const results = [];
        //match special searches
        SPECIAL_SEARCHES.forEach((search) => {
            search.query = query;
            if (search.match(query)) {
                results.push(new SearchItem(search));
            }
        });

        //match index

        INDEX.forEach((search) => {
            search.query = query;
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
        if (!results.length) {
            section.classList.add("no-results");
        }
        this.setPosition({ height: "auto" });
    }
}

class SearchItem {
    constructor(searchTerm) {
        this.name = searchTerm.name;
        this.type = searchTerm.type;
        this.data = searchTerm.data;
        this.img = searchTerm.img;
        this.icon = Array.isArray(searchTerm.icon) ? searchTerm.icon : [searchTerm.icon];
        this.element = document.createElement("li");
        this.element.classList.add("search-item", ...this.type.split(" "));
        this.searchTerm = searchTerm;
        this.render();
    }

    async render() {
        const icons = this.icon.map((icon) => `<i class="${icon}"></i>`).join("");
        this.element.innerHTML = `${this.img && `<img src="${this.img}" alt="${this.name}">`} ${icons} <span>${this.name}</span>`;
        this.element.addEventListener("click", (e) => {
            this.searchTerm.onClick?.(e);
        });
        this.setDraggable();
    }

    setDraggable() {
        if (this.data.uuid) {
            this.element.setAttribute("draggable", true);
            this.element.addEventListener("dragstart", (event) => {
                event.dataTransfer.setData("text/plain", JSON.stringify({ type: this.data.documentName, uuid: this.data.uuid }));
            });
        }
    }
}
