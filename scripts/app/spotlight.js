import { MODULE_ID } from "../main.js";
import { SPECIAL_SEARCHES } from "../searchTerms/special.js";

import { INDEX, FILE_INDEX, buildIndex, FILTERS } from "../searchTerms/buildTermIndex.js";
import { getSetting, setSetting } from "../settings.js";
import { BaseSearchTerm } from "../searchTerms/baseSearchTerm.js";

let indexingDone = false;

let SPOTLIGHT_WIDTH = 700;

let LAST_SEARCH = { query: "", filters: [] };

let LAST_INPUT_TIME = 0;

export class Spotlight extends Application {
    constructor({ first } = {}) {
        super();
        SPOTLIGHT_WIDTH = getSetting("spotlightWidth") || 700;
        this.first = first;
        this.ACTOR_ITEMS_INDEX = [];
        ui.spotlightOmnisearch?.close();
        ui.spotlightOmnisearch = this;
        buildIndex().then((r) => {
            if (r) {
                this._onSearch();
                indexingDone = true;
                const help = SPECIAL_SEARCHES.find((search) => search.type.includes("help"));
                const currentDesc = help.description;
                const filterSpans = FILTERS.map((filter) => `<span class="filter" data-filter="${filter}">${filter}</span>`).join("");
                help._description = () => {
                    return `${currentDesc} <div class="filters-help">${filterSpans}</div>`;
                };
                if (this._html) this._html.querySelector(".fa-spinner").classList = "fa-light fa-search";
            }
        });
        this._onSearch = debounce(this._onSearch, 167);
        this.updateStoredPosition = debounce(this.updateStoredPosition, 167);
        document.addEventListener("click", Spotlight.onClickAway);
        this.indexActorItems();
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
            width: SPOTLIGHT_WIDTH,
            top: window.innerHeight / 4,
            title: game.i18n.localize(`${MODULE_ID}.${this.APP_ID}.title`),
        });
    }

    static onClickAway(event) {
        if (!getSetting("clickToDismiss")) return;
        if (event.target.closest("#spotlight")) return;
        ui.spotlightOmnisearch?.close();
    }

    indexActorItems() {
        const actors = canvas?.tokens?.controlled.map((token) => token.actor) ?? [];
        const typeLocalized = game.i18n.localize("DOCUMENT.Item") + " " + "owned";
        if (_token && !actors.includes(_token.actor)) actors.push(_token.actor);
        if (!actors.includes(game.user.character)) actors.push(game.user.character);
        for (const actor of actors) {
            if (!actor) continue;
            const items = actor.items.map((item) => {
                const actions = [];
                if (item.use) {
                    actions.push({
                        name: `${MODULE_ID}.actions.use-item`,
                        icon: '<i class="fas fa-hand-paper"></i>',
                        callback: async () => {
                            item.use();
                        },
                    });
                }
                return new BaseSearchTerm({
                    name: item.name,
                    type: "Item owned",
                    description: actor.name,
                    img: item.img,
                    icon: ["fas fa-user-circle", "fas fa-suitcase"],
                    data: { uuid: item.uuid, documentName: "Item" },
                    actions: actions,
                    onClick: async () => {
                        item.sheet.render(true);
                    },
                });
            });
            this.ACTOR_ITEMS_INDEX.push(...items);
        }
    }

    async getData() {
        const appData = getSetting("appData");
        const saveLastSearch = getSetting("saveLastSearch");
        if (!saveLastSearch) LAST_SEARCH = { query: "", filters: [] };
        const timer = appData.timer;
        if (game.user.isGM && timer && Date.now() > timer) {
            delete appData.timer;
            await setSetting("appData", appData);
        }
        return { first: this.first, lastSearch: LAST_SEARCH.query };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html = html[0] ?? html;
        this._html = html;
        const filtersContainer = html.querySelector(".filters-container");
        LAST_SEARCH.filters.forEach((filter) => {
            const filterElement = document.createElement("span");
            filterElement.innerText = filter;
            filterElement.classList.add("filter");
            filterElement.dataset.filter = filter;
            filterElement.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                filterElement.remove();
                this._onSearch();
            });
            filtersContainer.appendChild(filterElement);
        });
        html.querySelector("input").addEventListener("input", this._onSearch.bind(this));
        //if enter is pressed on the search input, click on the first result
        html.querySelector("input").addEventListener("keydown", this._onKeyDown.bind(this));
        //timeout for janky core behavior
        setTimeout(() => {
            //enable the input
            html.querySelector("input").disabled = false;
            //focus the input
            html.querySelector("input").focus();
        }, 50);
        if (getSetting("darkMode")) html.closest("#spotlight").classList.add("dark");

        html.closest("#spotlight").classList.add("force-opacity");
        setTimeout(() => {
            html.closest("#spotlight").classList.remove("force-opacity");
        }, 300);

        if (!indexingDone) {
            const searchIcon = html.querySelector(".fa-search");
            //replace with these classes <i class="fa-light fa-spinner-scale fa-spin"></i>
            searchIcon.classList = "fa-light fa-spinner fa-spin";
        }
        const positionType = getSetting("position");
        const storedPosition = getSetting("spotlightPosition");
        if (storedPosition && positionType === "save") {
            //check if the stored position is within the window
            if (!(storedPosition.left + SPOTLIGHT_WIDTH > window.innerWidth || storedPosition.top > window.innerHeight || storedPosition.top < 0 || storedPosition.left < 0)) {
                this.setPosition({ left: storedPosition.left, top: storedPosition.top, width: SPOTLIGHT_WIDTH });
            }
        }
        if(getSetting("alwaysOnTop")) html.closest("#spotlight").style.zIndex = "9999 !important";
        if (this.first) html.querySelector("input").value = "?";
        this._onSearch();
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
        this.updateStoredPosition();
    }

    updateStoredPosition() {
        setSetting("spotlightPosition", { left: this.position.left, top: this.position.top });
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

    _onKeyDown(event) {
        const inputTime = Date.now();
        const inputDelta = inputTime - LAST_INPUT_TIME;
        LAST_INPUT_TIME = inputTime;
        if (event.key === "Enter") {
            event.preventDefault();
            const isShift = event.shiftKey;
            const isAlt = event.altKey;
            const selected = html.querySelector(".search-item:not(.type-header).selected");
            const firstItem = selected ?? html.querySelector(".search-item:not(.type-header)");
            if (!firstItem) return;
            if (isShift) {
                //find the first action button
                const actionButton = firstItem.querySelector(".search-item-actions button");
                if (actionButton) actionButton.click();
            } else if (isAlt) {
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
        //if backspace is pressed and the input is empty, remove the last filter
        if (event.key === "Backspace" && !html.querySelector("input").value) {
            const filters = html.querySelectorAll(".filters-container .filter");
            const lastFilter = filters[filters.length - 1];
            if (lastFilter) lastFilter.remove();
            this._onSearch();
        }
        //if arrow up or down is pressed, move the selection
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            const selected = html.querySelector(".search-item.selected");
            if (!selected) {
                const first = html.querySelector(".search-item:not(.type-header)");
                if (first) first.classList.add("selected");
                return;
            }
            let next;
            if (event.ctrlKey) {
                //jump to next or previous type header
                next = selected[event.key === "ArrowUp" ? "previousElementSibling" : "nextElementSibling"];
                while (next && !next.classList.contains("type-header")) {
                    next = next[event.key === "ArrowUp" ? "previousElementSibling" : "nextElementSibling"];
                }
                if (next) {
                    next = next[event.key === "ArrowUp" ? "previousElementSibling" : "nextElementSibling"];
                    //if the key is arrow up, loop until there is a type header above
                    if (event.key === "ArrowUp") {
                        while (next && !next.classList.contains("type-header")) {
                            next = next.previousElementSibling;
                        }
                        next = next.nextElementSibling;
                    }
                }
            } else {
                next = selected[event.key === "ArrowUp" ? "previousElementSibling" : "nextElementSibling"];
                if (next && next.classList.contains("type-header")) next = next[event.key === "ArrowUp" ? "previousElementSibling" : "nextElementSibling"];
            }
            if (next) {
                selected.classList.remove("selected");
                next.classList.add("selected");
                //scroll to the selected element
                next.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
        }
        //if space + shift is pressed, close the spotlight
        if (event.key === " " && event.shiftKey && inputDelta < 400) {
            this.close();
        }
    }

    _onSearch() {
        if (this.closing) return;
        let query = this._html.querySelector("input").value.toLowerCase();
        const endsWithSpace = query.endsWith(" ");
        query = query.trim();
        //check the query for filtered searches such as !keyword
        const filtersData = this._getFilters(query);
        const filters = filtersData.filters;
        query = filtersData.query;
        let hasFilters = filters.length > 0;
        if (hasFilters && endsWithSpace) {
            const filtersContainer = this._html.querySelector(".filters-container");
            //filtersContainer.innerHTML = "";
            filters.forEach((filter) => {
                const filterElement = document.createElement("span");
                filterElement.innerText = filter;
                filterElement.classList.add("filter");
                filterElement.dataset.filter = filter;
                filterElement.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    filterElement.remove();
                    this._onSearch();
                });

                filtersContainer.appendChild(filterElement);
                this._html.querySelector("input").value = this._html.querySelector("input").value.replace(`!${filter}`, "").trim();
            });
        }
        const spanFilters = this._html.querySelectorAll(".filters-container .filter");
        spanFilters.forEach((spanFilter) => {
            filters.push(spanFilter.dataset.filter);
        });
        hasFilters = filters.length > 0;
        LAST_SEARCH = {
            query,
            filters,
        };
        const section = this._html.querySelector("section");
        const isActiveTimer = !!getSetting("appData").timer;
        section.classList.toggle("no-results", !query && !isActiveTimer && !hasFilters);
        if (!query && !isActiveTimer && !hasFilters) {
            this._html.querySelector("#search-result").innerHTML = "";
            this.setPosition({ height: "auto" });
            return;
        }
        const results = [];

        const completeSearch = () => {
            //sort by type
            const types = {};
            results.forEach((result) => {
                if (!types[result.type]) types[result.type] = [];
                types[result.type].push(result);
            });

            const list = this._html.querySelector("#search-result");
            list.innerHTML = "";
            for (const [type, typeResults] of Object.entries(types)) {
                //sort typeResults by name, then bring to the top the ones that start with the query
                const sortedTypeResults = [];
                const doesNotStartWithQuery = [];
                typeResults.forEach((result) => {
                    const lc = result.name.toLowerCase();
                    if (splitQuery.some((q) => lc.startsWith(q))) sortedTypeResults.push(result);
                    else doesNotStartWithQuery.push(result);
                });
                doesNotStartWithQuery.sort((a, b) => a.name.localeCompare(b.name));
                sortedTypeResults.sort((a, b) => a.name.localeCompare(b.name));
                sortedTypeResults.push(...doesNotStartWithQuery);

                const typeHeader = document.createElement("li");
                typeHeader.innerText = type
                    .replaceAll("-", " ")
                    .replaceAll(" ", " - ")
                    .replace(/([a-z])([A-Z])/g, "$1 $2");

                typeHeader.classList.add("type-header");
                if (!type.includes("special-app")) list.appendChild(typeHeader);
                sortedTypeResults.forEach((result) => {
                    list.appendChild(result.element);
                });
            }
            /*results.forEach((result) => {
                list.appendChild(result.element);
            });*/
            if (!results.length) {
                section.classList.add("no-results");
            }
            this.setPosition({ height: "auto" });
        };
        //match special searches
        SPECIAL_SEARCHES.forEach((search) => {
            search.query = query;
            if (hasFilters && !filters.every((filter) => search.type.toLowerCase().includes(filter))) return;
            if (isActiveTimer && search.type.includes("timer")) {
                results.push(new SearchItem(search));
                return;
            }
            if (search.match(query)) {
                results.push(new SearchItem(search));
            }
        });

        if (!query && isActiveTimer) return completeSearch();

        const splitQuery = query
            .split(" ")
            .map((q) => q.trim())
            .filter((q) => q);

        //match actor items
        for (let i = 0; i < this.ACTOR_ITEMS_INDEX.length; i++) {
            if (results.length > 50) break;
            const search = this.ACTOR_ITEMS_INDEX[i];
            search.query = query;
            if (hasFilters && !filters.every((filter) => search.type.toLowerCase().includes(filter))) continue;
            if (splitQuery.every((q) => search.match(q))) {
                results.push(new SearchItem(search));
            }
        }

        //match index
        for (let i = 0; i < INDEX.length; i++) {
            if (results.length > 50) break;
            const search = INDEX[i];
            search.query = query;
            if (hasFilters && !filters.every((filter) => search.type.toLowerCase().includes(filter))) continue;
            if (splitQuery.every((q) => search.match(q))) {
                results.push(new SearchItem(search));
            }
        }

        //match file index
        for (let i = 0; i < FILE_INDEX.length; i++) {
            if (results.length > 50) break;
            const search = FILE_INDEX[i];
            search.query = query;
            if (hasFilters && !filters.some((filter) => search.type.toLowerCase().includes(filter))) continue;
            if (splitQuery.every((q) => search.match(q))) {
                results.push(new SearchItem(search));
            }
        }

        //set the list to the results
        completeSearch();
    }

    setDraggingState(toggle) {
        setTimeout(() => {
            this._html.closest("#spotlight").classList.toggle("dragging", toggle);
        }, 1);
    }

    async close(...args) {
        ui.spotlightOmnisearch = null;
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
        this.addElementListeners();
    }

    addElementListeners() {
        this.element.addEventListener("click", (e) => {
            this.searchTerm.onClick?.(e, this.searchTerm);
        });
        this.setDraggable();

        if (!!getSetting("appData").timer && this.type.includes("timer")) {
            let interval;
            interval = setInterval(() => {
                //if the element is removed from the dom, clear the interval
                if (!document.body.contains(this.element)) {
                    clearInterval(interval);
                    return;
                }

                this.name = this.searchTerm.name;
                this.render();
            }, 1000);
        }
    }

    render() {
        const icons = this.icon.map((icon) => `<i class="${icon}"></i>`).join("");
        this.element.innerHTML = `${this.img ? `<img src="${this.img}" alt="${this.name}">` : ""} ${icons} <div class="search-info"><span class="search-entry-name">${this.name}</span>${this.description ? `<p>${this.description}</p>` : ""}</div>`;
        const actions = this.getActions();
        if (actions) this.element.querySelector(".search-entry-name").insertAdjacentElement("afterend", actions);
        const settingToggle = this.element.querySelector(".s-toggle-setting");
        if (settingToggle) {
            settingToggle.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const state = game.settings.get(settingToggle.dataset.namespace, settingToggle.dataset.key);
                game.settings.set(settingToggle.dataset.namespace, settingToggle.dataset.key, !state);
                settingToggle.classList.remove("fa-toggle-on", "fa-toggle-off");
                settingToggle.classList.add(`fa-toggle-${!state ? "on" : "off"}`);
            });
        }
        this.searchTerm.activateListeners?.(this.element);
    }

    getActions() {
        const actions = [...this.actions] ?? [];
        if (this.type.includes("Macro")) {
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
        } else if (this.type.includes("RollTable")) {
            actions.push({
                name: `${MODULE_ID}.actions.roll-table`,
                icon: '<i class="fas fa-dice-d20"></i>',
                callback: async () => {
                    (await fromUuid(this.data.uuid)).draw();
                },
            });
        } else if (this.type.includes("Playlist")) {
            const playlist = fromUuidSync(this.data.uuid);
            if (playlist) {
                if (playlist.playing) {
                    actions.push({
                        name: `${MODULE_ID}.actions.stop-playlist`,
                        icon: '<i class="fas fa-stop"></i>',
                        callback: async () => {
                            playlist.stopAll();
                        },
                    });
                } else {
                    actions.push({
                        name: `${MODULE_ID}.actions.play-playlist`,
                        icon: '<i class="fas fa-play"></i>',
                        callback: async () => {
                            playlist.playAll();
                        },
                    });
                }
            }
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

    setDragging(event) {
        this.searchTerm.onDragStart?.(event);
        setTimeout(() => {
            document.querySelector("#spotlight").classList.add("dragging");
        }, 1);
    }

    endDragging(event) {
        document.querySelector("#spotlight").classList.remove("dragging");
        this.searchTerm.onDragEnd?.(event);
    }

    setDraggable() {
        if (this.data.uuid) {
            this.element.setAttribute("draggable", true);
            this.element.addEventListener("dragstart", (event) => {
                this.setDragging(event);
                event.dataTransfer.setData("text/plain", JSON.stringify({ type: this.data.documentName, uuid: this.data.uuid }));
            });
            this.element.addEventListener("dragend", (event) => {
                this.endDragging(event);
            });
        }
        if (this.dragData) {
            this.element.setAttribute("draggable", true);
            this.element.addEventListener("dragstart", (event) => {
                this.setDragging(event);
                event.dataTransfer.setData("text/plain", JSON.stringify(this.dragData));
            });
            this.element.addEventListener("dragend", (event) => {
                this.endDragging(event);
            });
        }
    }
}
