export class BaseSearchTerm {
    /**
     * Creates an instance of BaseSearchTerm.
     * @constructor
     * @param {Object} options - The options for creating the search term.
     * @param {string|Function} options.name - The name or function returning the name of the search term. This will be used to match the search term against a query.
     * @param {string|Function} [options.nameExtra=""] - The additional name or function returning the additional name of the search term. This will be added to the name but will not be used to match the search term against a query.
     * @param {string|Function} [options.description=""] - The description or function returning the description of the search term.
     * @param {Array<string>} [options.keywords=[]] - The array of keywords associated with the search term. This will be used to match the search term against a query.
     * @param {Array<Function>} [options.actions=[]] - The array of actions associated with the search term.
     * @param {*} options.dragData - The data associated with the drag action.
     * @param {string} options.type - The type of the search term. This will be split by space and used to match !type filters.
     * @param {Object} [options.data={}] - Additional data associated with the search term.
     * @param {string} options.img - The image URL associated with the search term.
     * @param {string|Array<string>} options.icon - The icon URL associated with the search term. If 2 icons are provided, they will be rendered on the right of the search term.
     * @param {Function} [options.onClick=null] - The function to handle click events.
     * @param {Function} [options.onDragStart=null] - The function to handle drag start events.
     * @param {Function} [options.onDragEnd=null] - The function to handle drag end events.
     * @param {Function} [options.match=null] - The function to match the search term against a query. If not provided, the name and keywords will be used to match the search term against a query.
     * @param {Function} [options.activateListeners=null] - The function to activate listeners for the search term.
     */

    constructor({ name, nameExtra = "", description = "", keywords = [], actions = [], dragData, type, data = {}, img, icon, onClick = null, onDragStart = null, onDragEnd = null, match = null, activateListeners = null }) {
        this._name = typeof name === "function" ? name.bind(this) : () => name;
        this._description = typeof description === "function" ? description.bind(this) : () => description;
        this._actions = typeof actions === "function" ? actions.bind(this) : () => actions;
        this.dragData = dragData;
        this.keywords = keywords.map((keyword) => keyword.toLowerCase());
        this.type = type;
        this.data = data;
        this.img = img;
        this.icon = icon;
        this._nameExtra = typeof nameExtra === "function" ? nameExtra.bind(this) : () => nameExtra;
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

    get nameExtra() {
        return this._nameExtra(this);
    }

    get description() {
        return this._description(this);
    }

    get actions() {
        return this._actions(this);
    }
}
