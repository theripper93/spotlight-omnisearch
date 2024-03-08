export class BaseSearchTerm {
    /**
     * Create a base search term.
     * @param {Object} options - The options for the base search term.
     * @param {string|function} options.name - The name of the search term. If a function is provided, it will be bound to the instance. The name will be used also to match the search term.
     * @param {string|function} options.description - The description of the search term. If a function is provided, it will be bound to the instance.
     * @param {Array.<string>} [options.keywords=[]] - The keywords for the search term. The keywords will be used to match the search term but are hidden from the user.
     * @param {Array.<Object>} [options.actions=[]] - The actions for the search term.
     * @param {Object} options.dragData - The drag data for the search term. If provided, it will be supplied to the drag handler.
     * @param {string} options.type - The type of the search term. This can be anything but is used in !search commands to filter the results.
     * @param {Object} options.data - The data for the search term. Arbitrary data that can be used by the search term.
     * @param {string} options.img - The image for the search term.
     * @param {string|Array.<string>} options.icon - The icon for the search term. Needs to be a valid font-awesome icon.
     * @param {function} [options.onClick=null] - The click handler for the search term. If provided, it will be bound to the instance.
     */

    constructor({ name, description = "", keywords = [], actions = [], dragData, type, data = {}, img, icon, onClick = null, onDragStart = null, onDragEnd = null, match = null, activateListeners = null}) {
        this._name = typeof name === "function" ? name.bind(this) : () => name;
        this._description = typeof description === "function" ? description.bind(this) : () => description;
        this._actions = typeof actions === "function" ? actions.bind(this) : () => actions;
        this.dragData = dragData;
        this.keywords = keywords;
        this.type = type;
        this.data = data;
        this.img = img;
        this.icon = icon;
        if (activateListeners) this.activateListeners = activateListeners.bind(this);
        if (onClick) this._onClick = onClick.bind(this);
        if (onDragEnd) this._onDragEnd = onDragEnd.bind(this);
        if (onDragStart) this._onDragStart = onDragStart.bind(this);
        if (match) this.match = match.bind(this);
    }

    onClick(...args) {
        if (this._onClick) {
            this._onClick(...args);
        }
    }

    onDragStart(...args) {
        if (this._onDragStart) {
            this._onDragStart(...args);
        }
    }

    onDragEnd(...args) {
        if (this._onDragEnd) {
            this._onDragEnd(...args);
        }
    }

    match(query) {
        try {
            return this.name.toLowerCase().includes(query) || this.keywords.some((keyword) => keyword.includes(query));
        } catch (error) {
            console.error(`Error matching search term:`, this);
            console.error(error);
            return false;
        }
    }

    get name() {
        return this._name(this);
    }

    get description() {
        return this._description(this);
    }

    get actions() {
        return this._actions(this);
    }
}
