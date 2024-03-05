import {MODULE_ID} from "../main";

export class BaseSearchTerm {
    constructor ({name, query, keywords = [], type, data, img, icon, onClick = null}) {
        this._name = typeof name === "function" ? name.bind(this) : () => name;
        this.query = query;
        this.keywords = keywords;
        this.type = type;
        this.data = data;
        this.img = img;
        this.icon = icon;
        this._onClick = onClick.bind(this);
    }

    onClick(...args) {
        if (this._onClick) {
            this._onClick(...args);
        }
    }

    match(query) {
        return this.name.toLowerCase().includes(query) || this.keywords.some((keyword) => keyword.includes(query));
    }

    get name() {
        return this._name(this);
    }
}