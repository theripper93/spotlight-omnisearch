import { MODULE_ID } from "../main.js";

export class DocumentFormApp extends FormApplication {
    constructor(document) {
        super();
        this.document = document;
    }

    static get APP_ID() {
        return this.name.split(/(?=[A-Z])/).join('-').toLowerCase();
    }

    get APP_ID() {
        return this.constructor.APP_ID;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: this.APP_ID,
            template: `modules/${MODULE_ID}/templates/${this.APP_ID}.hbs`,
            popOut: true,
            minimizable: true,
            title: game.i18n.localize(`${MODULE_ID}.${this.APP_ID}.title`),
            closeOnSubmit: true,
        });
    }

    async getData() {
        const data = {};
        return { data };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html = html[0] ?? html;
    }

    async _updateObject(event, formData) {
        formData = foundry.utils.expandObject(formData);
        return this.document.update(formData);
    }
}