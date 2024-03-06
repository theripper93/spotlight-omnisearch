import { MODULE_ID } from "../main.js";
import { SPECIAL_SEARCHES } from "../searchTerms/special.js";

import { INDEX, FILE_INDEX, buildIndex } from "../searchTerms/buildTermIndex.js";
import { getSetting } from "../settings.js";

let indexingDone = false;

export class Spotlight extends Application {
    constructor({ first } = {}) {
        super();
        this.first = first;
        ui.spotlightOmnisearch?.close();
        ui.spotlightOmnisearch = this;
        buildIndex().then((r) => {
            if (r) {
                this._onSearch();
                indexingDone = true;
                if (this._html) this._html.querySelector(".fa-spinner").classList = "fa-light fa-search";
            }
        });
        this._onSearch = debounce(this._onSearch, 167);
        document.addEventListener("click", Spotlight.onClickAway);
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
            width: 700,
            top: window.innerHeight / 4,
            title: game.i18n.localize(`${MODULE_ID}.${this.APP_ID}.title`),
        });
    }

    static onClickAway(event) {
        if (event.target.closest("#spotlight")) return;
        ui.spotlightOmnisearch?.close();
    }

    async getData() {
        return { first: this.first };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html = html[0] ?? html;
        this._html = html;
        html.querySelector("input").addEventListener("input", this._onSearch.bind(this));
        //if enter is pressed on the search input, click on the first result
        html.querySelector("input").addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                const isShift = event.shiftKey;
                const isAlt = event.altKey;
                const firstItem = html.querySelector(".search-item");
                if (!firstItem) return;
                if (isShift) {
                    //find the first action button
                    const actionButton = firstItem.querySelector(".search-item-actions button");
                    if (actionButton) actionButton.click();
                }else if (isAlt) {
                    //find the second action button
                    const actionButton = firstItem.querySelectorAll(".search-item-actions button")[1];
                    if (actionButton) actionButton.click();
                } else {
                    firstItem?.click();
                }
                this.close();
            }
            //if escape is pressed, close the spotlight
            if (event.key === "Escape") {
                this.close();
            }
        });
        //timeout for janky core behavior
        setTimeout(() => {
            //enable the input
            html.querySelector("input").disabled = false;
            //focus the input
            html.querySelector("input").focus();
        }, 50);
        if (getSetting("darkMode")) html.closest("#spotlight").classList.add("dark");

        if (!indexingDone) {
            const searchIcon = html.querySelector(".fa-search");
            //replace with these classes <i class="fa-light fa-spinner-scale fa-spin"></i>
            searchIcon.classList = "fa-light fa-spinner fa-spin";
        }
    }

    setPosition(...args) {
        super.setPosition(...args);
        //get max availeble vertical space
        const windowApp = this._html.closest("#spotlight");
        const top = windowApp.getBoundingClientRect().top;
        const searchHeight = 100;
        const maxHeight = window.innerHeight - top - searchHeight;
        const prev = this._html.querySelector("section").style.maxHeight;
        this._html.querySelector("section").style.maxHeight = `${maxHeight}px`;
        if (prev !== this._html.querySelector("section").style.maxHeight) {
            windowApp.classList.toggle("inverted", maxHeight < window.innerHeight / 3);
            this.setPosition({ height: "auto" });
        }
    }

    _getFilters(query) {
        const filters = [];
        while (query.includes("!")) {
            const filter = query.match(/^!(\w+)/g);
            if (filter) {
                filters.push(filter[0].replace("!", "").toLowerCase());
                query = query.replace(filter[0], "").trim();
            } else {
                break;
            }
        }
        return { filters, query };
    }

    _onSearch() {
        let query = this._html.querySelector("input").value.toLowerCase().trim();
        //check the query for filtered searches such as !keyword
        const filtersData = this._getFilters(query);
        const filters = filtersData.filters;
        query = filtersData.query;
        const hasFilters = filters.length > 0;
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

        const splitQuery = query
            .split(" ")
            .map((q) => q.trim())
            .filter((q) => q);

        //match index
        for (let i = 0; i < INDEX.length; i++) {
            const search = INDEX[i];
            search.query = query;
            if (hasFilters && !filters.every((filter) => search.type.toLowerCase().includes(filter))) continue;
            if (splitQuery.every((q) => search.match(q))) {
                results.push(new SearchItem(search));
            }
        }

        //match file index
        for (let i = 0; i < FILE_INDEX.length; i++) {
            const search = FILE_INDEX[i];
            search.query = query;
            if (hasFilters && !filters.some((filter) => search.type.toLowerCase().includes(filter))) continue;
            if (splitQuery.every((q) => search.match(q))) {
                results.push(new SearchItem(search));
            }
        }

        //cap max results to 50
        results.splice(50);

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

    async close(...args) {
        document.removeEventListener("click", Spotlight.onClickAway);
        return super.close(...args);
    }
}

class SearchItem {
    constructor(searchTerm) {
        this.name = searchTerm.name;
        this.description = searchTerm.description;
        this.type = searchTerm.type;
        this.data = searchTerm.data;
        this.img = searchTerm.img;
        this.dragData = searchTerm.dragData;
        this.actions = searchTerm.actions;
        if (!getSetting("showImages")) this.img = null;
        this.icon = Array.isArray(searchTerm.icon) ? searchTerm.icon : [searchTerm.icon];
        this.element = document.createElement("li");
        this.element.classList.add("search-item", ...this.type.split(" "));
        if (this.icon.length > 1) {
            this.element.classList.add("multi-icons");
        }
        this.searchTerm = searchTerm;
        this.render();
    }

    async render() {
        const icons = this.icon.map((icon) => `<i class="${icon}"></i>`).join("");
        this.element.innerHTML = `${this.img ? `<img src="${this.img}" alt="${this.name}">` : ""} ${icons} <div class="search-info"><span class="search-entry-name">${this.name}</span>${this.description ? `<p>${this.description}</p>` : ""}</div>`;
        const actions = this.getActions();
        if (actions) this.element.querySelector(".search-entry-name").insertAdjacentElement("afterend", actions);
        this.element.addEventListener("click", (e) => {
            this.searchTerm.onClick?.(e);
        });
        this.setDraggable();
    }

    getActions() {
        const actions = this.actions ?? [];
        if (this.type == "Macro") {
            actions.push({
                name: `${MODULE_ID}.actions.execute`,
                icon: '<i class="fas fa-terminal"></i>',
                callback: async () => {
                    (await fromUuid(this.data.uuid)).execute();
                },
            });
        } else if (this.type == "Scene") {
            actions.push(
                {
                    name: `${MODULE_ID}.actions.view`,
                    icon: '<i class="fas fa-eye"></i>',
                    callback: async () => {
                        (await fromUuid(this.data.uuid)).view();
                    },
                },
                {
                    name: `${MODULE_ID}.actions.activate`,
                    icon: '<i class="fas fa-play"></i>',
                    callback: async () => {
                        (await fromUuid(this.data.uuid)).activate();
                    },
                },
            );
        }

        if (!actions.length) return null;
        const actionsContainer = document.createElement("div");
        actionsContainer.classList.add("search-item-actions");
        actions.forEach((action) => {
            const button = document.createElement("button");
            button.innerHTML = action.icon + " " + game.i18n.localize(action.name);
            button.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                action.callback(e);
            });
            actionsContainer.appendChild(button);
        });
        return actionsContainer;
    }

    setDragging() {
        setTimeout(() => {
            document.querySelector("#spotlight").classList.add("dragging");
        }, 1);
    }

    endDragging() {
        document.querySelector("#spotlight").classList.remove("dragging");
    }

    setDraggable() {
        if (this.data.uuid) {
            this.element.setAttribute("draggable", true);
            this.element.addEventListener("dragstart", (event) => {
                this.setDragging();
                event.dataTransfer.setData("text/plain", JSON.stringify({ type: this.data.documentName, uuid: this.data.uuid }));
            });
            this.element.addEventListener("dragend", () => {
                this.endDragging();
            });
        }
        if (this.dragData) {
            this.element.setAttribute("draggable", true);
            this.element.addEventListener("dragstart", (event) => {
                this.setDragging();
                event.dataTransfer.setData("text/plain", JSON.stringify(this.dragData));
            });
            this.element.addEventListener("dragend", () => {
                this.endDragging();
            });
        }
    }
}
